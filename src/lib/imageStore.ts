const DB_NAME = 'elegance-home-style'
const DB_VERSION = 1
const STORE_NAME = 'product-images'
const PREFIX = 'ehs-image://'

export const isStoredImage = (source: string) => source.startsWith(PREFIX)

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB is unavailable'))
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME)
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('Unable to decode image'))
  image.src = source
})

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode image')), 'image/webp', 0.82)
})

/** Compresses an uploaded product image and applies the exact store logo. */
async function prepareImage(file: File, logoSource: string) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const maxSide = 1400
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas is unavailable')
    context.fillStyle = '#f7f3eb'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    try {
      const logo = await loadImage(logoSource)
      const logoWidth = Math.max(86, Math.min(width * .18, 210))
      const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth)
      const padding = Math.max(12, width * .018)
      context.save()
      context.globalAlpha = .9
      context.drawImage(logo, width - logoWidth - padding, height - logoHeight - padding, logoWidth, logoHeight)
      context.restore()
    } catch {
      // A failed logo request should not prevent the merchant from saving a photo.
    }

    return canvasBlob(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

export async function storeProductImage(file: File, logoSource: string) {
  const blob = await prepareImage(file, logoSource)
  const id = `${PREFIX}${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(blob, id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
    return id
  } catch {
    // Data URLs keep image upload usable on browsers that block IndexedDB.
    return blobToDataUrl(blob)
  }
}

export async function getStoredImage(source: string) {
  if (!isStoredImage(source)) return null
  const database = await openDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(source)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

export async function deleteStoredImage(source: string) {
  if (!isStoredImage(source)) return
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(source)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  } catch {
    // Missing images do not block product deletion.
  }
}
