import type { AppSettings, LibraryData } from '../types/domain';

const DB_NAME = 'note-library-db';
const STORE_NAME = 'app-state';
const DB_VERSION = 1;
const SNAPSHOT_KEY = 'library';
const SETTINGS_KEY = 'settings';
const RESTORE_RECOVERY_SNAPSHOT_KEY = 'restore-recovery-snapshot';

export interface RestoreRecoverySnapshot {
  kind: 'restore-recovery-snapshot';
  createdAt: string;
  data: LibraryData;
  settings: AppSettings;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window) || !window.indexedDB) {
      reject(createStorageException('IndexedDB is unavailable in this browser context.', 'InvalidStateError'));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      try {
        const db = request.result;
        // One key-value store is enough because LibNote persists whole
        // snapshots rather than querying individual books, chapters, or pages.
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      } catch (error) {
        reject(error);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? createStorageException('IndexedDB could not be opened.', 'UnknownError'));
    request.onblocked = () => {
      reject(createStorageException('IndexedDB could not be opened because another tab is blocking the upgrade.', 'InvalidStateError'));
    };
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
    const settle = createSettler(resolve, reject, db);
    let transaction: IDBTransaction;
    let request: IDBRequest;

    try {
      transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      request = store.get(SNAPSHOT_KEY);
    } catch (error) {
      settle.reject(error);
      return;
    }

    request.onsuccess = () => {
      const result = request.result;
      if (result === undefined || result === null) {
        settle.resolve(null);
        return;
      }

      if (!isLibraryDataSnapshot(result)) {
        settle.reject(createStorageException('Stored library data is not a readable LibNote snapshot.', 'DataError'));
        return;
      }

      settle.resolve(result);
    };
    request.onerror = () => settle.reject(request.error ?? createStorageException('IndexedDB could not read the library snapshot.', 'UnknownError'));
    transaction.onerror = () => settle.reject(transaction.error ?? createStorageException('IndexedDB read transaction failed.', 'UnknownError'));
    transaction.onabort = () => settle.reject(transaction.error ?? createStorageException('IndexedDB read transaction was aborted.', 'AbortError'));
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
    const settle = createSettler(resolve, reject, db);
    let transaction: IDBTransaction;
    let request: IDBRequest;

    try {
      transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      request = store.put(data, SNAPSHOT_KEY);
    } catch (error) {
      settle.reject(error);
      return;
    }

    transaction.oncomplete = () => settle.resolve(undefined);
    transaction.onerror = () => settle.reject(transaction.error ?? createStorageException('IndexedDB save transaction failed.', 'UnknownError'));
    transaction.onabort = () => settle.reject(transaction.error ?? createStorageException('IndexedDB save transaction was aborted.', 'AbortError'));
    request.onerror = () => settle.reject(request.error ?? createStorageException('IndexedDB could not write the library snapshot.', 'UnknownError'));
  });
}

export async function loadAppSettings(): Promise<AppSettings | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const settle = createSettler(resolve, reject, db);
    let transaction: IDBTransaction;
    let request: IDBRequest;

    try {
      transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      request = store.get(SETTINGS_KEY);
    } catch (error) {
      settle.reject(error);
      return;
    }

    request.onsuccess = () => settle.resolve((request.result as AppSettings | undefined) ?? null);
    request.onerror = () => settle.reject(request.error ?? createStorageException('IndexedDB could not read app settings.', 'UnknownError'));
    transaction.onerror = () => settle.reject(transaction.error ?? createStorageException('IndexedDB settings read transaction failed.', 'UnknownError'));
    transaction.onabort = () => settle.reject(transaction.error ?? createStorageException('IndexedDB settings read transaction was aborted.', 'AbortError'));
  });
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const settle = createSettler(resolve, reject, db);
    let transaction: IDBTransaction;
    let request: IDBRequest;

    try {
      transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      request = store.put(settings, SETTINGS_KEY);
    } catch (error) {
      settle.reject(error);
      return;
    }

    transaction.oncomplete = () => settle.resolve(undefined);
    transaction.onerror = () => settle.reject(transaction.error ?? createStorageException('IndexedDB settings save transaction failed.', 'UnknownError'));
    transaction.onabort = () => settle.reject(transaction.error ?? createStorageException('IndexedDB settings save transaction was aborted.', 'AbortError'));
    request.onerror = () => settle.reject(request.error ?? createStorageException('IndexedDB could not write app settings.', 'UnknownError'));
  });
}

export async function loadRestoreRecoverySnapshot(): Promise<RestoreRecoverySnapshot | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const settle = createSettler(resolve, reject, db);
    let transaction: IDBTransaction;
    let request: IDBRequest;

    try {
      transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      request = store.get(RESTORE_RECOVERY_SNAPSHOT_KEY);
    } catch (error) {
      settle.reject(error);
      return;
    }

    request.onsuccess = () => {
      const result = request.result;
      if (result === undefined || result === null) {
        settle.resolve(null);
        return;
      }

      if (!isRestoreRecoverySnapshot(result)) {
        settle.reject(createStorageException('Stored restore recovery snapshot is not readable.', 'DataError'));
        return;
      }

      settle.resolve(result);
    };
    request.onerror = () =>
      settle.reject(request.error ?? createStorageException('IndexedDB could not read the restore recovery snapshot.', 'UnknownError'));
    transaction.onerror = () =>
      settle.reject(transaction.error ?? createStorageException('IndexedDB restore recovery read transaction failed.', 'UnknownError'));
    transaction.onabort = () =>
      settle.reject(transaction.error ?? createStorageException('IndexedDB restore recovery read transaction was aborted.', 'AbortError'));
  });
}

/**
 * Stores the last-known-good local library before a restore replaces it.
 * This internal snapshot is separate from exported backup JSON and exists only
 * so an interrupted or partially failed restore can be rolled back by the user.
 */
export async function saveRestoreRecoverySnapshot(snapshot: RestoreRecoverySnapshot): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const settle = createSettler(resolve, reject, db);
    let transaction: IDBTransaction;
    let request: IDBRequest;

    try {
      transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      request = store.put(snapshot, RESTORE_RECOVERY_SNAPSHOT_KEY);
    } catch (error) {
      settle.reject(error);
      return;
    }

    transaction.oncomplete = () => settle.resolve(undefined);
    transaction.onerror = () =>
      settle.reject(transaction.error ?? createStorageException('IndexedDB restore recovery save transaction failed.', 'UnknownError'));
    transaction.onabort = () =>
      settle.reject(transaction.error ?? createStorageException('IndexedDB restore recovery save transaction was aborted.', 'AbortError'));
    request.onerror = () =>
      settle.reject(request.error ?? createStorageException('IndexedDB could not write the restore recovery snapshot.', 'UnknownError'));
  });
}

export async function clearRestoreRecoverySnapshot(): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const settle = createSettler(resolve, reject, db);
    let transaction: IDBTransaction;
    let request: IDBRequest;

    try {
      transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      request = store.delete(RESTORE_RECOVERY_SNAPSHOT_KEY);
    } catch (error) {
      settle.reject(error);
      return;
    }

    transaction.oncomplete = () => settle.resolve(undefined);
    transaction.onerror = () =>
      settle.reject(transaction.error ?? createStorageException('IndexedDB restore recovery clear transaction failed.', 'UnknownError'));
    transaction.onabort = () =>
      settle.reject(transaction.error ?? createStorageException('IndexedDB restore recovery clear transaction was aborted.', 'AbortError'));
    request.onerror = () =>
      settle.reject(request.error ?? createStorageException('IndexedDB could not clear the restore recovery snapshot.', 'UnknownError'));
  });
}

function createSettler<T>(
  resolve: (value: T) => void,
  reject: (reason?: unknown) => void,
  db: IDBDatabase
): { resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let settled = false;

  function closeDb(): void {
    db.close();
  }

  // IndexedDB can report both request and transaction failures. Settle once and
  // close the connection so duplicate events do not race callers.
  return {
    resolve(value) {
      if (settled) {
        return;
      }

      settled = true;
      closeDb();
      resolve(value);
    },
    reject(reason) {
      if (settled) {
        return;
      }

      settled = true;
      closeDb();
      reject(reason);
    }
  };
}

function isLibraryDataSnapshot(value: unknown): value is LibraryData {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.books) && Array.isArray(value.chapters) && Array.isArray(value.pages);
}

function isRestoreRecoverySnapshot(value: unknown): value is RestoreRecoverySnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.kind === 'restore-recovery-snapshot' &&
    typeof value.createdAt === 'string' &&
    isLibraryDataSnapshot(value.data) &&
    isRecord(value.settings)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createStorageException(message: string, name: string): DOMException {
  return new DOMException(message, name);
}
