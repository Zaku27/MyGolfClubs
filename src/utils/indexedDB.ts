const DB_NAME = 'GolfBagDB';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

interface AttachmentBlob {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDBの初期化に失敗しました'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

export const saveFileToDB = async (id: string, blob: Blob, mimeType: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    const attachment: AttachmentBlob = {
      id,
      blob,
      mimeType,
      createdAt: new Date().toISOString(),
    };

    const request = objectStore.put(attachment);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('ファイルの保存に失敗しました'));
    };
  });
};

export const getFileFromDB = async (id: string): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(id);

    request.onsuccess = () => {
      const result = request.result as AttachmentBlob | undefined;
      if (result) {
        resolve(result.blob);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };
  });
};

export const deleteFileFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error('ファイルの削除に失敗しました'));
    };
  });
};

export const createObjectUrlFromDB = async (id: string): Promise<string | null> => {
  const blob = await getFileFromDB(id);
  if (blob) {
    return URL.createObjectURL(blob);
  }
  return null;
};
