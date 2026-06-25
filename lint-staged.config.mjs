export default {
    '*.{js,jsx,ts,tsx,json,jsonc,css,md,mdx,yml,yaml,html}': 'oxfmt --write',
    '*.rs': () => 'cargo fmt --all'
};
