// Estado de una orden o movimiento segun su texto. Minusculas y sin tildes.
export const COMPLETED_PATTERN = /\b(completado|completed)\b/

// Cancelada, vencida o en apelacion: no movio dinero y no se debe registrar.
export const CANCELLED_PATTERN = /\b(cancelado|cancelled|canceled|expirado|expired|apelacion|appeal)\b/
