import { readLocal, readSync, writeLocal, writeSync, LocalStorage, SyncStorage } from '../shared/storage';

const DEFAULT_SYNC_SETTINGS: Partial<SyncStorage> = {
  defaultEnabled: true,
  translationTone: 'رسمی',
  translationModel: 'gemini-2.5-flash-preview-04-17'
};

const DEFAULT_LOCAL_SETTINGS: Partial<LocalStorage> = {
  useCustomFont: false
};

export async function ensureDefaultSettings(): Promise<void> {
  const syncSettings = await readSync(['defaultEnabled', 'translationTone', 'translationModel']);
  const syncUpdates: Partial<SyncStorage> = {};
  for (const [key, value] of Object.entries(DEFAULT_SYNC_SETTINGS)) {
    const typedKey = key as keyof SyncStorage;
    if (syncSettings[typedKey] === undefined) {
      syncUpdates[typedKey] = value as SyncStorage[keyof SyncStorage];
    }
  }
  if (Object.keys(syncUpdates).length > 0) {
    await writeSync(syncUpdates);
  }

  const localSettings = await readLocal(['useCustomFont']);
  const localUpdates: Partial<LocalStorage> = {};
  for (const [key, value] of Object.entries(DEFAULT_LOCAL_SETTINGS)) {
    const typedKey = key as keyof LocalStorage;
    if (localSettings[typedKey] === undefined) {
      localUpdates[typedKey] = value as LocalStorage[keyof LocalStorage];
    }
  }
  if (Object.keys(localUpdates).length > 0) {
    await writeLocal(localUpdates);
  }
}
