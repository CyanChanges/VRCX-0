import { commands } from '@/platform/tauri/bindings';
import type {
    RuntimeAppSnapshot,
    RuntimeBackgroundJobSnapshot,
    RuntimeDiagnosticsSnapshot,
    RuntimeLifecycleSnapshot,
    RuntimeSyncSnapshot
} from '@/platform/tauri/bindings';

async function getAppSnapshot(): Promise<RuntimeAppSnapshot> {
    return commands.appRuntimeAppSnapshotGet();
}

async function getRuntimeSnapshot(): Promise<RuntimeLifecycleSnapshot> {
    return commands.appRuntimeLifecycleSnapshotGet();
}

async function getBackgroundJobsSnapshot(): Promise<
    RuntimeBackgroundJobSnapshot[]
> {
    return commands.appRuntimeBackgroundJobsSnapshotGet();
}

async function getSyncSnapshot(): Promise<RuntimeSyncSnapshot> {
    return commands.appRuntimeSyncSnapshotGet();
}

async function getDiagnostics(): Promise<RuntimeDiagnosticsSnapshot> {
    return commands.appRuntimeDiagnosticsGet();
}

const runtimeDiagnosticsRepository = Object.freeze({
    getAppSnapshot,
    getBackgroundJobsSnapshot,
    getDiagnostics,
    getRuntimeSnapshot,
    getSyncSnapshot
});

export {
    getAppSnapshot,
    getBackgroundJobsSnapshot,
    getDiagnostics,
    getRuntimeSnapshot,
    getSyncSnapshot
};

export default runtimeDiagnosticsRepository;
