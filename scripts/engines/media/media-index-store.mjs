// The media library's index, kept in this browser's IndexedDB so reopening a world does not
// rescan every sound pack and folder source. One record: the last index and the key it was built
// for (MediaLibraryLoader's state key); a different key reads as nothing saved.
const DB = "animater", STORE = "media-index", RECORD = "library";

const request = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export function mediaIndexStore(idb = globalThis.indexedDB) {
  if (!idb?.open) return null;
  let db = null;
  const handle = () => (db ??= new Promise((resolve, reject) => {
    const req = idb.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { db = null; reject(req.error); };
  }));
  const store = async (mode) => (await handle()).transaction(STORE, mode).objectStore(STORE);
  return {
    async get(key) {
      const row = await request((await store("readonly")).get(RECORD));
      return row?.key === key ? row.result : null;
    },
    async set(key, result) {
      await request((await store("readwrite")).put({ key, result }, RECORD));
    },
  };
}
