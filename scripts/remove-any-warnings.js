const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Run a command asynchronously and return stdout/stderr
function runCmdAsync(cmd, args) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('close', (code) => {
            resolve({
                status: code,
                stdout,
                stderr
            });
        });
    });
}

// Normalize path to relative format with forward slashes
function normalizePath(p) {
    if (!p) return '';
    const resolved = path.resolve(p);
    return path.relative(process.cwd(), resolved).replace(/\\/g, '/');
}

// Normalize TypeScript errors to ignore line/column changes
function normalizeTSErrors(output) {
    const lines = output.split('\n');
    const errors = new Set();
    for (const line of lines) {
        // Match pattern like src/file.ts(45,29): error TS2554: ...
        const match = line.match(/^([^(]+)\(\d+,\d+\):\s*(error\s+TS\d+:.*)$/);
        if (match) {
            const normFile = normalizePath(match[1].trim());
            errors.add(`${normFile}: ${match[2].trim()}`);
        }
    }
    return errors;
}

// Get current TypeScript compilation errors
async function getTSCheckErrors() {
    const res = await runCmdAsync('bunx', [
        'tsgo',
        '-p',
        'tsconfig.app.json',
        '--noEmit'
    ]);
    return normalizeTSErrors(res.stdout + '\n' + res.stderr);
}

// Find preceding colon index before the given offset, skipping only whitespace
function findPrecedingColon(content, offset) {
    let i = offset - 1;
    while (i >= 0 && /\s/.test(content[i])) {
        i--;
    }
    if (i >= 0 && content[i] === ':') {
        return i;
    }
    return -1;
}

// Get oxlint diagnostics for a single file asynchronously in-memory
function getOxlintForFileAsync(filename) {
    return new Promise((resolve) => {
        const proc = spawn('bunx', ['oxlint', filename, '-f', 'json']);
        let stdout = '';
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        proc.on('close', () => {
            try {
                const data = JSON.parse(stdout);
                resolve({ filename, diagnostics: data.diagnostics || [] });
            } catch (e) {
                resolve({ filename, diagnostics: [] });
            }
        });
    });
}

// Scan all files in parallel with a concurrency limit
async function scanAllFiles(filenames) {
    const concurrencyLimit = 50;
    const results = [];
    const pool = new Set();

    for (const filename of filenames) {
        if (pool.size >= concurrencyLimit) {
            await Promise.race(pool);
        }
        const p = getOxlintForFileAsync(filename).then((res) => {
            pool.delete(p);
            return res;
        });
        pool.add(p);
        results.push(p);
    }

    return Promise.all(results);
}

// From a TS check error string like "src/features/foo.ts: error TS2554: message"
// we extract the normalized filename "src/features/foo.ts"
function getFilenameFromError(errStr) {
    const colonIdx = errStr.indexOf(':');
    if (colonIdx !== -1) {
        return normalizePath(errStr.substring(0, colonIdx).trim());
    }
    return null;
}

// Extract all relative/aliased imports from a file
function getImportsOfFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const imports = [];
        const regex = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        const dir = path.dirname(filePath);
        while ((match = regex.exec(content)) !== null) {
            let importPath = match[1];
            if (importPath.startsWith('@/')) {
                importPath = path.resolve('src', importPath.substring(2));
            } else if (importPath.startsWith('.')) {
                importPath = path.resolve(dir, importPath);
            } else {
                continue;
            }

            for (const ext of [
                '.ts',
                '.tsx',
                '.js',
                '.jsx',
                '/index.ts',
                '/index.tsx'
            ]) {
                const fullPath = importPath + ext;
                if (fs.existsSync(fullPath)) {
                    imports.push(normalizePath(fullPath));
                    break;
                }
            }
        }
        return imports;
    } catch (e) {
        return [];
    }
}

// Find which modified files are referenced/imported by a failing unmodified file transitively
function findModifiedDependencies(errorFile, modifiedFiles) {
    const visited = new Set();
    const queue = [normalizePath(errorFile)];
    const deps = new Set();

    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);

        if (modifiedFiles.has(current)) {
            deps.add(current);
        }

        const imports = getImportsOfFile(current);
        for (const imp of imports) {
            if (!visited.has(imp)) {
                queue.push(imp);
            }
        }
    }
    return deps;
}

// Heuristics for checking if a warning is definitely unsafe (fails strict compiler settings)
function isDeclarationWithoutInitializer(content, offset) {
    let i = offset + 3;
    while (i < content.length && /\s/.test(content[i])) {
        i++;
    }
    if (i < content.length && (content[i] === ';' || content[i] === '}')) {
        return true;
    }
    return false;
}

function isTypeOrInterfaceProperty(content, offset) {
    let i = offset - 1;
    let depth = 0;
    while (i >= 0) {
        const char = content[i];
        if (char === '}') depth++;
        else if (char === '{') {
            depth--;
            if (depth < 0) {
                let j = i - 1;
                while (j >= 0 && /\s/.test(content[j])) j--;
                let word = '';
                while (j >= 0 && /[a-zA-Z0-9_$]/.test(content[j])) {
                    word = content[j] + word;
                    j--;
                }
                while (j >= 0 && /\s/.test(content[j])) j--;
                let prevWord = '';
                while (j >= 0 && /[a-zA-Z0-9_$]/.test(content[j])) {
                    prevWord = content[j] + prevWord;
                    j--;
                }
                if (
                    word === 'interface' ||
                    prevWord === 'interface' ||
                    word === 'type' ||
                    prevWord === 'type'
                ) {
                    return true;
                }
                break;
            }
        }
        i--;
    }
    return false;
}

function isAtTopLevel(content, offset) {
    let depth = 0;
    for (let i = 0; i < offset; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') depth--;
    }
    return depth === 0;
}

function getParameterContext(content, offset) {
    let i = offset - 1;
    let depth = 0;
    while (i >= 0) {
        const char = content[i];
        if (char === ')' || char === '}' || char === ']') {
            depth++;
        } else if (char === '(' || char === '{' || char === '[') {
            depth--;
        }
        if (depth < 0) {
            let j = i - 1;
            while (j >= 0 && /\s/.test(content[j])) j--;
            let word = '';
            while (j >= 0 && /[a-zA-Z0-9_$]/.test(content[j])) {
                word = content[j] + word;
                j--;
            }
            while (j >= 0 && /\s/.test(content[j])) j--;
            let prevWord = '';
            while (j >= 0 && /[a-zA-Z0-9_$]/.test(content[j])) {
                prevWord = content[j] + prevWord;
                j--;
            }
            if (word === 'function' || prevWord === 'function') {
                return 'function_declaration';
            }
            break;
        }
        i--;
    }
    return 'unknown';
}

function isDefinitelyUnsafe(content, offset) {
    if (isDeclarationWithoutInitializer(content, offset)) return true;
    if (isTypeOrInterfaceProperty(content, offset)) return true;
    if (isAtTopLevel(content, offset)) {
        const ctx = getParameterContext(content, offset);
        if (ctx === 'function_declaration') {
            let i = offset + 3;
            while (i < content.length && /\s/.test(content[i])) i++;
            if (i < content.length && content[i] !== '=') {
                return true;
            }
        }
    }
    return false;
}

async function main() {
    console.log('=== Phase 1: Getting Baseline TypeScript Errors ===');
    const baselineTSErrors = await getTSCheckErrors();
    console.log(`Baseline has ${baselineTSErrors.size} typecheck errors.`);

    console.log(
        '\n=== Phase 2: Finding TS files and running oxlint in parallel ==='
    );
    const gitFilesRes = await runCmdAsync('git', ['ls-files']);
    const files = gitFilesRes.stdout
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

    console.log(`Scanning ${files.length} TypeScript files...`);
    const scanResults = await scanAllFiles(files);

    // Group candidates by file
    const fileSafeDiags = {};
    let totalWarnings = 0;
    let totalCandidates = 0;

    for (const res of scanResults) {
        const filename = normalizePath(res.filename);
        const diags = res.diagnostics.filter(
            (d) => d.code === 'typescript(no-explicit-any)'
        );
        if (diags.length === 0) continue;

        totalWarnings += diags.length;

        let content;
        try {
            content = fs.readFileSync(filename, 'utf8');
        } catch (e) {
            continue;
        }

        const safeDiags = [];
        for (const diag of diags) {
            const offset = diag.labels?.[0]?.span?.offset;
            if (offset === undefined) continue;
            if (content.substring(offset, offset + 3) !== 'any') continue;

            const colonIdx = findPrecedingColon(content, offset);
            if (colonIdx === -1) continue;

            if (isDefinitelyUnsafe(content, offset)) continue;

            safeDiags.push({ diag, offset, colonIdx });
        }

        if (safeDiags.length > 0) {
            fileSafeDiags[filename] = safeDiags;
            totalCandidates += safeDiags.length;
        }
    }

    console.log(`Found ${totalWarnings} warnings across the codebase.`);
    console.log(
        `Identified ${totalCandidates} candidate ': any' warnings in ${Object.keys(fileSafeDiags).length} files.`
    );

    if (totalCandidates === 0) {
        console.log('No candidate warnings to clean up!');
        return;
    }

    console.log(
        '\n=== Phase 3: Applying Modifications to All Files Simultaneously ==='
    );
    const modifiedFiles = new Set();
    const failedFiles = new Set();
    const originalContents = {};

    for (const filename in fileSafeDiags) {
        const safeDiags = fileSafeDiags[filename];
        const originalContent = fs.readFileSync(filename, 'utf8');
        originalContents[filename] = originalContent;

        let content = originalContent;
        for (const item of safeDiags) {
            const originalSlice = content.slice(item.colonIdx, item.offset + 3);
            const replacementSpaces = ' '.repeat(originalSlice.length);
            content =
                content.slice(0, item.colonIdx) +
                replacementSpaces +
                content.slice(item.offset + 3);
        }

        fs.writeFileSync(filename, content, 'utf8');
        modifiedFiles.add(filename);
    }

    console.log(
        `Applied space-replacement cleanup to ${modifiedFiles.size} files. Validating...`
    );

    // Loop: check and revert failing files
    let pass = false;
    let iterations = 0;
    while (!pass && modifiedFiles.size > 0 && iterations < 5) {
        iterations++;
        const currentErrors = await getTSCheckErrors();

        const newErrors = [];
        for (const err of currentErrors) {
            if (!baselineTSErrors.has(err)) {
                newErrors.push(err);
            }
        }

        if (newErrors.length === 0) {
            pass = true;
            break;
        }

        const currentFailed = new Set();
        for (const err of newErrors) {
            const filename = getFilenameFromError(err);
            if (filename) {
                if (modifiedFiles.has(filename)) {
                    currentFailed.add(filename);
                } else {
                    const deps = findModifiedDependencies(
                        filename,
                        modifiedFiles
                    );
                    for (const dep of deps) {
                        currentFailed.add(dep);
                    }
                }
            }
        }

        if (currentFailed.size === 0 || iterations === 5) {
            console.log(
                `Unresolved compilation errors or cross-file errors. Reverting all remaining files.`
            );
            for (const file of modifiedFiles) {
                fs.writeFileSync(file, originalContents[file], 'utf8');
                failedFiles.add(file);
            }
            modifiedFiles.clear();
            break;
        }

        console.log(
            `Iteration ${iterations}: Typecheck failed. Reverting ${currentFailed.size} files...`
        );
        for (const file of currentFailed) {
            fs.writeFileSync(file, originalContents[file], 'utf8');
            modifiedFiles.delete(file);
            failedFiles.add(file);
        }
    }

    // Phase 4: Warning-Level Fallback for Failed Files
    if (failedFiles.size > 0) {
        console.log(
            `\n=== Phase 4: Warning-Level Fallback for ${failedFiles.size} Failed Files ===`
        );
        let checkedCount = 0;
        for (const filename of failedFiles) {
            const safeDiags = fileSafeDiags[filename];
            console.log(
                `Processing file ${filename} (${safeDiags.length} warnings)...`
            );

            let currentContent = originalContents[filename];
            const sortedDiags = [...safeDiags].sort(
                (a, b) => b.offset - a.offset
            );

            for (const item of sortedDiags) {
                checkedCount++;
                // Apply this single space-replacement
                const originalSlice = currentContent.slice(
                    item.colonIdx,
                    item.offset + 3
                );
                const replacementSpaces = ' '.repeat(originalSlice.length);
                const testContent =
                    currentContent.slice(0, item.colonIdx) +
                    replacementSpaces +
                    currentContent.slice(item.offset + 3);

                fs.writeFileSync(filename, testContent, 'utf8');

                // Validate
                const currentErrors = await getTSCheckErrors();
                let passed = true;
                for (const err of currentErrors) {
                    if (!baselineTSErrors.has(err)) {
                        passed = false;
                        break;
                    }
                }

                if (passed) {
                    console.log(
                        `  [SUCCESS] Removed warning at offset ${item.offset}.`
                    );
                    currentContent = testContent;
                    modifiedFiles.add(filename);
                } else {
                    console.log(
                        `  [REVERT] Reverted warning at offset ${item.offset}.`
                    );
                    fs.writeFileSync(filename, currentContent, 'utf8');
                }
            }
        }
    }

    // Phase 5: Final verification
    const finalFiles = Array.from(modifiedFiles);
    if (finalFiles.length > 0) {
        console.log(
            `\n=== Phase 5: Verifying Final Clean Status for ${finalFiles.length} Files ===`
        );
        const finalOxlintResults = await scanAllFiles(finalFiles);
        for (const res of finalOxlintResults) {
            const filename = normalizePath(res.filename);
            const diagnostics = res.diagnostics;
            const otherErrors = diagnostics.filter(
                (d) => d.code !== 'typescript(no-explicit-any)'
            );

            if (otherErrors.length > 0) {
                console.log(`  [REVERT] ${filename} due to new lint warnings.`);
                fs.writeFileSync(filename, originalContents[filename], 'utf8');
                modifiedFiles.delete(filename);
            } else {
                const removedCount = fileSafeDiags[filename].length;
                console.log(`  [SUCCESS] ${filename} updated.`);
            }
        }
    }

    console.log('\n=== Summary ===');
    console.log(`Successfully cleaned up ${modifiedFiles.size} files.`);
}

main();
