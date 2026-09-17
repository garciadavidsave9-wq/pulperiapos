const DB_NAME = 'pulperia-pos'
const DB_VERSION = 1

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sales')) {
        const sales = db.createObjectStore('sales', { keyPath: 'id' })
        sales.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function getAll(storeName) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getById(storeName, id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putItem(storeName, item) {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  tx.objectStore(storeName).put(item)
  await txDone(tx)
}

export async function deleteItem(storeName, id) {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  tx.objectStore(storeName).delete(id)
  await txDone(tx)
}

export async function getMeta(key) {
  const row = await getById('meta', key)
  return row?.value
}

export async function setMeta(key, value) {
  await putItem('meta', { key, value })
}

export async function exportAll() {
  const [products, sales, meta] = await Promise.all([
    getAll('products'),
    getAll('sales'),
    getAll('meta'),
  ])
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    products,
    sales,
    meta,
  }
}

export async function importAll(payload) {
  if (!payload || !Array.isArray(payload.products)) {
    throw new Error('Archivo de respaldo inválido')
  }
  const db = await openDb()
  const tx = db.transaction(['products', 'sales', 'meta'], 'readwrite')
  tx.objectStore('products').clear()
  tx.objectStore('sales').clear()
  tx.objectStore('meta').clear()
  for (const product of payload.products) tx.objectStore('products').put(product)
  for (const sale of payload.sales || []) tx.objectStore('sales').put(sale)
  for (const row of payload.meta || []) tx.objectStore('meta').put(row)
  await txDone(tx)
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
