export interface SyncStorage {
  disabledSites?: string[];
  enabledSites?: string[];
  defaultEnabled?: boolean;
  translationTone?: string;
  translationModel?: string;
}

export interface LocalStorage {
  useCustomFont?: boolean;
  customFontData?: string;
  customFontFamily?: string;
  customFontName?: string;
  geminiApiKey?: string;
}

function readStorageArea<T extends object>(
  area: chrome.storage.StorageArea,
  keys: (keyof T)[]
): Promise<Partial<T>> {
  return new Promise((resolve, reject) => {
    try {
      area.get(keys as string[], (items) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(items as Partial<T>);
      });
    } catch (error) {
      reject(error as Error);
    }
  });
}

function writeStorageArea<T extends object>(
  area: chrome.storage.StorageArea,
  values: Partial<T>
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      area.set(values, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error as Error);
    }
  });
}

export function readSync<K extends keyof SyncStorage>(keys: K[]): Promise<Partial<Pick<SyncStorage, K>>> {
  return readStorageArea<SyncStorage>(chrome.storage.sync, keys).then((items) => {
    return keys.reduce((acc, key) => {
      if (items[key] !== undefined) {
        acc[key] = items[key] as SyncStorage[K];
      }
      return acc;
    }, {} as Partial<Pick<SyncStorage, K>>);
  });
}

export function writeSync(values: Partial<SyncStorage>): Promise<void> {
  return writeStorageArea<SyncStorage>(chrome.storage.sync, values);
}

export function readLocal<K extends keyof LocalStorage>(keys: K[]): Promise<Partial<Pick<LocalStorage, K>>> {
  return readStorageArea<LocalStorage>(chrome.storage.local, keys).then((items) => {
    return keys.reduce((acc, key) => {
      if (items[key] !== undefined) {
        acc[key] = items[key] as LocalStorage[K];
      }
      return acc;
    }, {} as Partial<Pick<LocalStorage, K>>);
  });
}

export function writeLocal(values: Partial<LocalStorage>): Promise<void> {
  return writeStorageArea<LocalStorage>(chrome.storage.local, values);
}

export function removeLocal(keys: (keyof LocalStorage)[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(keys as string[], () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error as Error);
    }
  });
}
