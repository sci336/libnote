import { afterEach, describe, expect, it } from 'vitest';
import { loadLibraryData, saveLibraryData } from './indexedDb';
import type { LibraryData } from '../types/domain';

describe('indexedDb persistence', () => {
  const originalIndexedDb = window.indexedDB;

  afterEach(() => {
    setIndexedDb(originalIndexedDb);
  });

  it('rejects clearly when IndexedDB is unavailable', async () => {
    setIndexedDb(undefined);

    await expect(loadLibraryData()).rejects.toMatchObject({
      name: 'InvalidStateError',
      message: 'IndexedDB is unavailable in this browser context.'
    });
  });

  it('rejects failed database opens', async () => {
    setIndexedDb(createIndexedDbMock({ openError: new DOMException('Open failed', 'UnknownError') }));

    await expect(loadLibraryData()).rejects.toMatchObject({
      name: 'UnknownError',
      message: 'Open failed'
    });
  });

  it('rejects failed snapshot reads', async () => {
    setIndexedDb(createIndexedDbMock({ getError: new DOMException('Read failed', 'UnknownError') }));

    await expect(loadLibraryData()).rejects.toMatchObject({
      name: 'UnknownError',
      message: 'Read failed'
    });
  });

  it('rejects malformed stored library snapshots', async () => {
    setIndexedDb(createIndexedDbMock({ getResult: { books: null, chapters: [], pages: [] } }));

    await expect(loadLibraryData()).rejects.toMatchObject({
      name: 'DataError',
      message: 'Stored library data is not a readable LibNote snapshot.'
    });
  });

  it('rejects failed snapshot writes', async () => {
    setIndexedDb(createIndexedDbMock({ putError: new DOMException('Storage full', 'QuotaExceededError') }));

    await expect(saveLibraryData(emptyData)).rejects.toMatchObject({
      name: 'QuotaExceededError',
      message: 'Storage full'
    });
  });

  it('rejects aborted save transactions', async () => {
    setIndexedDb(createIndexedDbMock({ abortOnPut: new DOMException('Transaction aborted', 'AbortError') }));

    await expect(saveLibraryData(emptyData)).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Transaction aborted'
    });
  });
});

const emptyData: LibraryData = {
  books: [],
  chapters: [],
  pages: []
};

interface IndexedDbMockOptions {
  openError?: DOMException;
  getResult?: unknown;
  getError?: DOMException;
  putError?: DOMException;
  abortOnPut?: DOMException;
}

function setIndexedDb(value: IDBFactory | undefined): void {
  Object.defineProperty(window, 'indexedDB', {
    configurable: true,
    value
  });
}

function createIndexedDbMock(options: IndexedDbMockOptions): IDBFactory {
  return ({
    open: () => {
      const request = createRequest<IDBDatabase>();
      const db = createDb(options);

      setTimeout(() => {
        if (options.openError) {
          request.error = options.openError;
          request.onerror?.(new Event('error'));
          return;
        }

        request.result = db;
        request.onsuccess?.(new Event('success'));
      }, 0);

      return request as unknown as IDBOpenDBRequest;
    }
  } as unknown) as IDBFactory;
}

function createDb(options: IndexedDbMockOptions): IDBDatabase {
  return ({
    close: () => undefined,
    objectStoreNames: {
      contains: () => true
    },
    transaction: () => createTransaction(options)
  } as unknown) as IDBDatabase;
}

function createTransaction(options: IndexedDbMockOptions): IDBTransaction {
  const transaction: MutableTransaction = {
    error: null,
    objectStore: () => ({
      get: () => {
        const request = createRequest();
        setTimeout(() => {
          if (options.getError) {
            request.error = options.getError;
            request.onerror?.(new Event('error'));
            return;
          }

          request.result = options.getResult;
          request.onsuccess?.(new Event('success'));
        }, 0);
        return request as IDBRequest;
      },
      put: () => {
        const request = createRequest();
        setTimeout(() => {
          if (options.putError) {
            request.error = options.putError;
            request.onerror?.(new Event('error'));
            return;
          }

          if (options.abortOnPut) {
            transaction.error = options.abortOnPut;
            transaction.onabort?.(new Event('abort'));
            return;
          }

          transaction.oncomplete?.(new Event('complete'));
        }, 0);
        return request as IDBRequest;
      }
    }),
    onabort: null,
    oncomplete: null,
    onerror: null
  };

  return (transaction as unknown) as IDBTransaction;
}

interface MutableTransaction {
  error: DOMException | null;
  objectStore: () => {
    get: () => IDBRequest;
    put: () => IDBRequest;
  };
  onabort: ((event: Event) => void) | null;
  oncomplete: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
}

interface MutableRequest<T = unknown> {
  error: DOMException | null;
  result: T | undefined;
  onerror: ((event: Event) => void) | null;
  onsuccess: ((event: Event) => void) | null;
}

function createRequest<T = unknown>(): MutableRequest<T> {
  return {
    error: null,
    result: undefined,
    onerror: null,
    onsuccess: null
  };
}
