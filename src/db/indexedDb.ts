import type { AppSettings, LibraryData } from '../types/domain';

const DB_NAME = 'note-library-db';
const STORE_NAME = 'app-state';
const DB_VERSION = 1;
const SNAPSHOT_KEY = 'library';
const SETTINGS_KEY = 'settings';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Loads the most recent normalized library snapshot.
 * The store layer performs any cleanup/reconciliation after hydration so the
 * persistence boundary can stay intentionally dumb.
 */
export async function loadLibraryData(): Promise<LibraryData | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(SNAPSHOT_KEY);

    request.onsuccess = () => resolve((request.result as LibraryData | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists the entire library graph as a single snapshot.
 * Keeping writes coarse-grained avoids merge logic during hydration and matches
 * the app's small, client-only data model.
 */
export async function saveLibraryData(data: LibraryData): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, SNAPSHOT_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadAppSettings(): Promise<AppSettings | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(SETTINGS_KEY);

    request.onsuccess = () => resolve((request.result as AppSettings | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(settings, SETTINGS_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
