/**
 * BlobStorageService
 *
 * Abstracts binary file storage across platforms:
 *   Mobile  → device filesystem via react-native-fs
 *   Web     → IndexedDB object store via idb-keyval
 *
 * Contract:
 *   - save(key, data) → stores binary data, returns the storage key
 *   - load(key)       → returns the binary data as a Blob/Buffer
 *   - loadAsDataURL(key) → returns a data: URI string suitable for <Image src>
 *   - remove(key)     → deletes the stored data
 *   - exists(key)     → checks if a key exists
 *
 * Key format:
 *   attachments/{cardId}/{uuid}.{ext}
 *   thumbnails/{cardId}/{uuid}_thumb.jpg
 *
 * On mobile the "key" is the full absolute filesystem path.
 * On web it is an opaque string used as the IndexedDB record key.
 */

import { Platform } from 'react-native';
import { generateUUID } from '@kanban/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveResult {
  key:       string;  // Storage reference to persist in AttachmentModel
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Web implementation — IndexedDB via idb-keyval
// ---------------------------------------------------------------------------

class WebBlobStorage {
  private dbName = 'kanban-blobs';
  private storeName = 'blobs';
  private db: IDBDatabase | null = null;

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(this.storeName);
      };
      req.onsuccess = () => { this.db = req.result; resolve(req.result); };
      req.onerror   = () => reject(req.error);
    });
  }

  private async tx(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest,
  ): Promise<unknown> {
    const db    = await this.openDB();
    const tx    = db.transaction(this.storeName, mode);
    const store = tx.objectStore(this.storeName);
    return new Promise((resolve, reject) => {
      const req   = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async save(blob: Blob, ext: string, prefix: string): Promise<SaveResult> {
    const key = `${prefix}/${generateUUID()}.${ext}`;
    await this.tx('readwrite', (store) => store.put(blob, key));
    return { key, sizeBytes: blob.size };
  }

  async load(key: string): Promise<Blob | null> {
    const result = await this.tx('readonly', (store) => store.get(key));
    return (result as Blob) ?? null;
  }

  async loadAsDataURL(key: string): Promise<string | null> {
    const blob = await this.load(key);
    if (!blob) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  async remove(key: string): Promise<void> {
    await this.tx('readwrite', (store) => store.delete(key));
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.tx('readonly', (store) => store.count(key));
    return (result as number) > 0;
  }
}

// ---------------------------------------------------------------------------
// Native implementation — filesystem via react-native-fs
// ---------------------------------------------------------------------------

class NativeBlobStorage {
  private baseDir: string | null = null;

  private async getBaseDir(): Promise<string> {
    if (this.baseDir) return this.baseDir;
    // Lazy import so web bundle never touches react-native-fs
    const RNFS = await import('react-native-fs');
    this.baseDir = `${RNFS.default.DocumentDirectoryPath}/kanban-attachments`;
    // Ensure directory exists
    const exists = await RNFS.default.exists(this.baseDir);
    if (!exists) await RNFS.default.mkdir(this.baseDir);
    return this.baseDir;
  }

  async save(
    sourcePath: string,
    ext: string,
    prefix: string,
  ): Promise<SaveResult> {
    const RNFS   = await import('react-native-fs');
    const base   = await this.getBaseDir();
    const subdir = `${base}/${prefix}`;

    const sdExists = await RNFS.default.exists(subdir);
    if (!sdExists) await RNFS.default.mkdir(subdir);

    const filename = `${generateUUID()}.${ext}`;
    const destPath = `${subdir}/${filename}`;

    await RNFS.default.copyFile(sourcePath, destPath);

    const stat = await RNFS.default.stat(destPath);
    return { key: destPath, sizeBytes: Number(stat.size) };
  }

  async loadAsDataURL(key: string): Promise<string | null> {
    try {
      const RNFS = await import('react-native-fs');
      const b64  = await RNFS.default.readFile(key, 'base64');
      // We don't have the mime type here — caller must prepend it
      return `data:application/octet-stream;base64,${b64}`;
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    const RNFS = await import('react-native-fs');
    const exists = await RNFS.default.exists(key);
    if (exists) await RNFS.default.unlink(key);
  }

  async exists(key: string): Promise<boolean> {
    const RNFS = await import('react-native-fs');
    return RNFS.default.exists(key);
  }
}

// ---------------------------------------------------------------------------
// Singleton instances
// ---------------------------------------------------------------------------

const webStorage    = new WebBlobStorage();
const nativeStorage = new NativeBlobStorage();

/**
 * Returns the appropriate storage implementation for the current platform.
 * Usage:
 *   const storage = getBlobStorage();
 *   const { key } = await storage.save(blob, 'jpg', 'attachments/card-id');
 */
export function getBlobStorage() {
  return Platform.OS === 'web' ? webStorage : nativeStorage;
}
