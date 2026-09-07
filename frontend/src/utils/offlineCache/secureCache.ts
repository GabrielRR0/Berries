// Cache de lectura offline (billeteras/movimientos/deudas/metas/categorías),
// cifrada en reposo: localStorage guarda todo en texto plano y es legible por
// cualquier código JS del mismo origen o por quien tenga acceso al perfil del
// navegador/backups del dispositivo, así que los datos financieros que se
// guardan para mostrarlos sin conexión se cifran antes de escribirse.
//
// La clave AES-GCM se genera UNA sola vez (extractable:false - ni la consola
// del navegador puede sacar el material crudo) y se guarda tal cual, como
// CryptoKey (no como bytes), en IndexedDB - los navegadores permiten guardar
// un CryptoKey directo vía structured clone. El blob cifrado (IV + texto
// cifrado en base64) es lo único que vive en localStorage.
//
// Qué SI protege: que alguien lea los archivos de localStorage del
// dispositivo/backup y vea datos financieros en texto plano.
// Qué NO protege: un ataque XSS corriendo en la misma página podría llamar a
// esta misma función de descifrado - esto no reemplaza sanitizar inputs ni
// CSP. Tampoco protege nada mientras viaja por red (eso ya lo cubre HTTPS).
//
// Mejor esfuerzo en todo: si crypto.subtle/IndexedDB no están disponibles
// (contexto no seguro, navegador viejo), se degrada a "sin cache" en vez de
// romper la app - mismo criterio que el resto del cacheo en este código.

const DB_NAME = 'berry_secure_cache'
const DB_VERSION = 1
const KEY_STORE = 'keys'
const KEY_ID = 'cache-key'

let cachedKeyPromise: Promise<CryptoKey | null> | null = null

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => request.result.createObjectStore(KEY_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadStoredKey(db: IDBDatabase): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly')
    const request = tx.objectStore(KEY_STORE).get(KEY_ID)
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function storeKey(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).put(key, KEY_ID)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getOrCreateKey(): Promise<CryptoKey | null> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = (async () => {
      try {
        const db = await openDatabase()
        const existing = await loadStoredKey(db)
        if (existing) return existing

        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
        await storeKey(db, key)
        return key
      } catch {
        return null
      }
    })()
  }
  return cachedKeyPromise
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const IV_LENGTH_BYTES = 12

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    const cryptoKey = await getOrCreateKey()
    if (!cryptoKey) return

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))
    const plaintext = new TextEncoder().encode(JSON.stringify(value))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext)

    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.length)

    localStorage.setItem(key, bytesToBase64(combined))
  } catch {
    // Mejor esfuerzo - si falla el cifrado (o no hay soporte), simplemente no
    // queda cache para este key, no debe romper el fetch que la llamó.
  }
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const cryptoKey = await getOrCreateKey()
    if (!cryptoKey) return null

    const combined = base64ToBytes(raw)
    const iv = combined.slice(0, IV_LENGTH_BYTES)
    const ciphertext = combined.slice(IV_LENGTH_BYTES)
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext)

    return JSON.parse(new TextDecoder().decode(plaintext)) as T
  } catch {
    return null
  }
}

export function clearCache(key: string): void {
  localStorage.removeItem(key)
}

export function clearCacheByPrefix(prefix: string): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(prefix)) localStorage.removeItem(key)
  }
}
