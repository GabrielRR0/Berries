import type { ScanRow } from './movementRows'
import { normalizeForMatch } from './textLines'

// Huella de un movimiento importado desde una captura, para no registrarlo dos veces.
// Se prefiere lo que es unico en el origen:
//  - orden P2P: su numero de orden (una sola huella para la orden y para el abono del banco
//    con el que se enlazo, asi el segundo intento se detecta desde cualquiera de las dos capturas);
//  - comprobante suelto: el numero de operacion o referencia;
//  - fila de una lista: billetera + sentido + monto + fecha + hora + descripcion.
// Sin fecha no hay huella: el resultado seria demasiado ambiguo.
function orderNumberOf(row: ScanRow): string | null {
  const candidate = row.p2p?.orderNumber ?? row.linkedOrderNumber
  return candidate && /^\d{10,}$/.test(candidate) ? candidate : null
}

export function rowFingerprint(row: ScanRow): string | null {
  const orderNumber = orderNumberOf(row)
  if (orderNumber) return `p2p|${orderNumber}`

  if (row.source === 'bank' && row.reference) return `ref|${row.currency ?? ''}|${row.reference}|${row.direction}`

  if (!row.occurredOn) return null
  return [
    'bank',
    row.walletId,
    row.direction,
    row.amount.toFixed(2),
    row.occurredOn,
    row.time ?? '',
    normalizeForMatch(row.description).replace(/\s+/g, ' ').trim(),
  ].join('|')
}

// SHA-256 en hexadecimal. El servidor lo vuelve a firmar con una clave propia antes de guardarlo
// (ver seal_import_key en el backend), asi que el hash por si solo no revela montos ni fechas.
export async function hashFingerprint(raw: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function importKeyFor(row: ScanRow): Promise<string | null> {
  const raw = rowFingerprint(row)
  return raw ? hashFingerprint(raw) : null
}
