import type { ScanRow } from './movementRows'

function stampKey(row: ScanRow): string | null {
  return row.stamp ? `${row.currency ?? ''}|${row.direction}|${row.amount.toFixed(2)}|${row.stamp}` : null
}

// El mismo movimiento puede llegar en dos capturas (la lista de Binance Pay y su "Detalles del
// pago"). Si una fila nueva tiene la misma hora al segundo, sentido y monto que una ya leida, no se
// agrega otra: se completa la existente con lo que solo trae el detalle (id de orden, nota).
// Devuelve las filas nuevas que si hay que agregar; modifica las existentes en el lugar.
export function mergeRepeatedRows(existing: ScanRow[], incoming: ScanRow[]): ScanRow[] {
  const byKey = new Map<string, ScanRow>()
  for (const row of existing) {
    const key = stampKey(row)
    if (key) byKey.set(key, row)
  }

  const added: ScanRow[] = []
  for (const row of incoming) {
    const key = stampKey(row)
    const match = key ? byKey.get(key) : undefined
    if (!match) {
      added.push(row)
      continue
    }
    match.reference = match.reference ?? row.reference
    // La descripcion mas larga es la del detalle (trae la nota).
    if (row.description.length > match.description.length) match.description = row.description
  }
  return added
}
