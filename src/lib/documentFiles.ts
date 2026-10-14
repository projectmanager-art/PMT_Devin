const DATABASE_NAME = 'nexora-document-files'
const DATABASE_VERSION = 1
const STORE_NAME = 'files'

interface StoredDocumentFile {
  id: string
  name: string
  type: string
  blob: Blob
}

let databasePromise: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Persistent file storage is not available in this browser.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open document storage.'))
    request.onblocked = () => reject(new Error('Document storage is busy in another tab. Close the other tab and retry.'))
  })
  databasePromise = opening.catch((error) => {
    databasePromise = undefined
    throw error
  })
  return databasePromise
}

export async function storeDocumentFile(id: string, file: File) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({ id, name: file.name, type: file.type || 'application/octet-stream', blob: file } satisfies StoredDocumentFile)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the document file.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Saving the document file was cancelled.'))
  })
}

export async function getDocumentFile(id: string) {
  const database = await openDatabase()
  return new Promise<StoredDocumentFile | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(id)
    let result: StoredDocumentFile | undefined
    request.onsuccess = () => { result = request.result as StoredDocumentFile | undefined }
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not read the document file.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Reading the document file was cancelled.'))
  })
}

export async function deleteDocumentFile(id: string) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove the document file.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Removing the document file was cancelled.'))
  })
}

export async function downloadDocumentFile(id: string, name: string) {
  const stored = await getDocumentFile(id)
  if (!stored) throw new Error('The attached file was not found in this browser. Edit the document and attach it again.')
  const url = URL.createObjectURL(stored.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = (name || stored.name).replace(/[\\/:*?"<>|]/g, '_')
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
