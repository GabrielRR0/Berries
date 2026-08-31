// Dos cuentas de porcentaje independientes entre si - cada una toma sus
// propios inputs, no encadenan resultado de una a la otra.

// "¿Cuanto es el X% de MONTO?" (ej. propina del 10% sobre $45).
export function percentOfAmount(amount: number, percent: number): number | null {
  if (!Number.isFinite(amount) || !Number.isFinite(percent)) return null
  return amount * (percent / 100)
}

// "MONTO es que % de TOTAL" (ej. "gaste $120 de un presupuesto de $500,
// ¿que porcentaje es?").
export function amountAsPercentOfTotal(amount: number, total: number): number | null {
  if (!Number.isFinite(amount) || !Number.isFinite(total) || total === 0) return null
  return (amount / total) * 100
}
