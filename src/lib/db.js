// Minimal promisified IndexedDB wrapper.
// Stores: characters (blobs included), history, tournaments, settings.

const DB_NAME = 'nexus-fg'
const DB_VERSION = 2
const STORES = ['characters', 'history', 'tournaments', 'settings', 'stats']

let dbPromise = null

export function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store)
}

function reqp(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGetAll(store) {
  const db = await openDB()
  return reqp(tx(db, store, 'readonly').getAll())
}

export async function idbGet(store, id) {
  const db = await openDB()
  return reqp(tx(db, store, 'readonly').get(id))
}

export async function idbPut(store, value) {
  const db = await openDB()
  return reqp(tx(db, store, 'readwrite').put(value))
}

export async function idbPutMany(store, values) {
  const db = await openDB()
  const t = db.transaction(store, 'readwrite')
  const os = t.objectStore(store)
  for (const v of values) os.put(v)
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function idbDelete(store, id) {
  const db = await openDB()
  return reqp(tx(db, store, 'readwrite').delete(id))
}

export async function idbClear(store) {
  const db = await openDB()
  return reqp(tx(db, store, 'readwrite').clear())
}

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
