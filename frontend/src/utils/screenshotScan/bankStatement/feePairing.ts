import type { ScanRow } from '../movementRows'

// Une cada comision con su operacion por la referencia: misma fecha y hora y las mismas cifras finales
// en la referencia (cuantas, lo dice el perfil del banco); la de menor monto es la comision. Es independiente
// de lo que el OCR haya leido en la descripcion (que es lo mas fragil), asi que funciona aunque el texto
// salga deformado. Recibe todas las filas y devuelve las que quedan (sin las comisiones unidas).
export function pairFeesByReference(rows: ScanRow[], suffixDigits: number): ScanRow[] {
  const groups = new Map<string, ScanRow[]>()
  for (const row of rows) {
    if (row.direction !== 'out' || !row.reference || !row.time || !row.occurredOn) continue
    const key = `${row.occurredOn}|${row.time}|${row.reference.slice(-suffixDigits)}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const merged = new Set<ScanRow>()
  for (const group of groups.values()) {
    if (group.length !== 2) continue
    const [fee, operation] = [...group].sort((a, b) => a.amount - b.amount) as [ScanRow, ScanRow]
    operation.fee = Math.round((operation.fee + fee.amount) * 100) / 100
    merged.add(fee)
  }
  return rows.filter((row) => !merged.has(row))
}
