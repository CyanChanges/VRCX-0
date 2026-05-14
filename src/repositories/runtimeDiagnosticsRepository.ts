import { tauriClient } from '@/platform/tauri/client';
import type {
    RuntimeAppSnapshot,
    RuntimeBackgroundJobSnapshot,
    RuntimeDiagnosticsSnapshot,
    RuntimeLifecycleSnapshot,
    RuntimeSyncSnapshot
} from '@/platform/tauri/client';

async function getAppSnapshot(): Promise<RuntimeAppSnapshot> {
    return tauriClient.app.RuntimeAppSnapshotGet();
}

async function getRuntimeSnapshot(): Promise<RuntimeLifecycleSnapshot> {
    return tauriClient.app.RuntimeLifecycleSnapshotGet();
}

async function getBackgroundJobsSnapshot(): Promise<
    RuntimeBackgroundJobSnapshot[]
> {
    return tauriClient.app.RuntimeBackgroundJobsSnapshotGet();
}

async function getSyncSnapshot(): Promise<RuntimeSyncSnapshot> {
    return tauriClient.app.RuntimeSyncSnapshotGet();
}

async function getDiagnostics(): Promise<RuntimeDiagnosticsSnapshot> {
    return tauriClient.app.RuntimeDiagnosticsGet();
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
