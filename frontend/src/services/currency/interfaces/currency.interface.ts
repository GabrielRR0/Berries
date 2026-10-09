// Forma publica del dominio currency. La forma "sobre el cable"
// (ConversionWire/RateHistoryWire) y CurrencyApiError son detalle de
// implementacion de currency.service.ts.
export interface ConversionResult {
  convertedAmount: number
  rateUsed: number
}

export interface RateHistoryPoint {
  fetchedAt: string
  rate: number
  // null en filas viejas, previas a que el backend guardara procedencia - la
  // pagina "Tasas" trata null como "no se sabe" (no como "si es real").
  source: string | null
  isEstimated: boolean
}

export interface RateHistoryResult {
  code: string
  quote: string
  points: RateHistoryPoint[]
}
