import { tauriClient } from '@/platform/tauri/client';
import configRepository from '@/repositories/configRepository';

import { requireHostCapability } from './hostCapabilityService';

type RegistryValue = {
    type?: unknown;
    data?: unknown;
};
type RegistryData = Record<string, RegistryValue>;
type RegistryBackup = {
    name: string;
    date: string;
    data: unknown;
};
type RegistryBackupSnapshot = RegistryBackup & {
    key: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object');
}

function safeJsonParse<TFallback>(value: unknown, fallback: TFallback): unknown {
    if (!value) {
        return fallback;
    }
    try {
        return JSON.parse(value as string);
    } catch {
        return fallback;
    }
}

function normalizeBackup(
    backup: Partial<RegistryBackup> | null | undefined,
    index: number
): RegistryBackupSnapshot {
    return {
        key: `${backup?.date || index}-${backup?.name || 'backup'}`,
        name: backup?.name || 'Backup',
        date: backup?.date || '',
        data: backup?.data || {}
    };
}

async function listVrcRegistryBackups(): Promise<RegistryBackupSnapshot[]> {
    const backups = safeJsonParse(
        await configRepository.getString('VRChatRegistryBackups', '[]'),
        []
    );
    return Array.isArray(backups)
        ? backups.map((backup: any, index: any) =>
              normalizeBackup(
                  isRecord(backup) ? (backup as Partial<RegistryBackup>) : null,
                  index
              )
          )
        : [];
}

async function saveVrcRegistryBackups(backups: RegistryBackup[]): Promise<void> {
    await configRepository.setString(
        'VRChatRegistryBackups',
        JSON.stringify(backups)
    );
}

async function backupVrcRegistry(
    name: any = 'Manual Backup'
): Promise<RegistryBackupSnapshot[]> {
    requireHostCapability('registryPrefs');
    const data = await tauriClient.app.GetVRChatRegistry();
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        throw new Error('No VRChat registry data was found to back up.');
    }
    const backups = await listVrcRegistryBackups();
    const nextBackups = [
        ...backups.map(({ key: _key, ...backup }: any) => backup),
        {
            name,
            date: new Date().toJSON(),
            data
        }
    ];
    await saveVrcRegistryBackups(nextBackups);
    return nextBackups.map((backup: any, index: any) => normalizeBackup(backup, index));
}

async function restoreVrcRegistryBackup(
    key: string
): Promise<RegistryBackupSnapshot> {
    requireHostCapability('registryPrefs');
    const backups = await listVrcRegistryBackups();
    const backup = backups.find((item: any) => item.key === key);
    if (!backup) {
        throw new Error('Registry backup not found.');
    }

    await tauriClient.app.SetVRChatRegistry(
        typeof backup.data === 'string'
            ? backup.data
            : JSON.stringify(backup.data || {})
    );
    await configRepository.setString(
        'VRChatRegistryLastRestoreCheck',
        backup.date || new Date().toJSON()
    );
    return backup;
}

async function saveVrcRegistryBackupToFile(key: string): Promise<unknown> {
    const backups = await listVrcRegistryBackups();
    const backup = backups.find((item: any) => item.key === key);
    if (!backup) {
        throw new Error('Registry backup not found.');
    }

    return tauriClient.app.SaveVrcRegJsonFile(
        null,
        `${backup.name || 'VRChat Registry Backup'}.json`,
        JSON.stringify(backup.data || {}, null, 2)
    );
}

async function restoreVrcRegistryBackupFromFile(): Promise<boolean> {
    requireHostCapability('registryPrefs');
    const filePath = await tauriClient.app.OpenFileSelectorDialog(
        null,
        '.json',
        'JSON Files (*.json)|*.json'
    );
    if (!filePath) {
        return false;
    }

    const json = await tauriClient.app.ReadVrcRegJsonFile(filePath);
    const data = JSON.parse(String(json)) as unknown;
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid registry backup JSON.');
    }

    for (const value of Object.values(data as RegistryData)) {
        if (
            !value ||
            typeof value !== 'object' ||
            typeof value.type !== 'number' ||
            typeof value.data === 'undefined'
        ) {
            throw new Error('Invalid registry backup JSON.');
        }
    }

    await tauriClient.app.SetVRChatRegistry(json);
    await configRepository.setString(
        'VRChatRegistryLastRestoreCheck',
        new Date().toJSON()
    );
    return true;
}

async function deleteVrcRegistryFolder(): Promise<unknown> {
    requireHostCapability('registryPrefs');
    return tauriClient.app.DeleteVRChatRegistryFolder();
}

async function deleteVrcRegistryBackup(
    key: string
): Promise<RegistryBackupSnapshot[]> {
    const backups = await listVrcRegistryBackups();
    const nextBackups = backups
        .filter((backup: any) => backup.key !== key)
        .map(({ key: _key, ...backup }: any) => backup);
    await saveVrcRegistryBackups(nextBackups);
    return nextBackups.map((backup: any, index: any) => normalizeBackup(backup, index));
}

export {
    backupVrcRegistry,
    deleteVrcRegistryBackup,
    deleteVrcRegistryFolder,
    listVrcRegistryBackups,
    restoreVrcRegistryBackup,
    restoreVrcRegistryBackupFromFile,
    saveVrcRegistryBackupToFile
};
