const IDB_NAME = 'sudo-backup';
const IDB_STORE = 'handles';
const HANDLE_KEY = 'folder';
const FOLDER_NAME_KEY = 'sudo_backup_folder_name';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as T | undefined);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(key: string, value: unknown) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

async function idbDelete(key: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).delete(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export function isFolderBackupSupported() {
  return typeof window.showDirectoryPicker === 'function';
}

export function getStoredFolderName(): string | null {
  return localStorage.getItem(FOLDER_NAME_KEY);
}

export async function getBackupFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY)) ?? null;
  } catch {
    return null;
  }
}

async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  const h = handle as FileSystemDirectoryHandle & {
    queryPermission: (o: typeof opts) => Promise<PermissionState>;
    requestPermission: (o: typeof opts) => Promise<PermissionState>;
  };
  if ((await h.queryPermission(opts)) === 'granted') return true;
  return (await h.requestPermission(opts)) === 'granted';
}

/** Prompt the user to pick a folder for daily backups. Returns the folder display name. */
export async function pickBackupFolder(): Promise<string | null> {
  if (!isFolderBackupSupported()) return null;

  const handle = await window.showDirectoryPicker!({ mode: 'readwrite' });
  const granted = await verifyPermission(handle);
  if (!granted) throw new Error('Folder access was not granted.');

  await idbSet(HANDLE_KEY, handle);
  localStorage.setItem(FOLDER_NAME_KEY, handle.name);
  return handle.name;
}

export async function clearBackupFolder() {
  await idbDelete(HANDLE_KEY);
  localStorage.removeItem(FOLDER_NAME_KEY);
}

/** Write a backup JSON file into the saved folder. Returns true on success. */
export async function writeBackupToFolder(json: string, filename: string): Promise<boolean> {
  const handle = await getBackupFolderHandle();
  if (!handle) return false;

  try {
    const granted = await verifyPermission(handle);
    if (!granted) return false;

    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(json);
    await writable.close();
    return true;
  } catch (e) {
    console.warn('Folder backup failed', e);
    return false;
  }
}
