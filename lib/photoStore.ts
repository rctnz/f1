// Photos added in the browser live in IndexedDB on this machine only.
const DB = "a10-grand-prix";
const STORE = "photos";
/** fired on window when a photo is added or removed, so other views (the calendar) can refresh */
export const PHOTO_EVENT = "a10-photo";
const notify = () => window.dispatchEvent(new Event(PHOTO_EVENT));

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }
  return dbp;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export const getPhoto = (id: string) => run<Blob>("readonly", (s) => s.get(id)).catch(() => undefined);
export const setPhoto = (id: string, blob: Blob) => run("readwrite", (s) => s.put(blob, id)).then(notify, () => undefined);
export const deletePhoto = (id: string) => run("readwrite", (s) => s.delete(id)).then(notify, () => undefined);

/** downscale to at most 1600px on the long side so the store stays light */
export async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d");
    if (!g) return file;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((r) => c.toBlob((b) => r(b ?? file), "image/jpeg", 0.86));
  } catch {
    return file;
  }
}
