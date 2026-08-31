// Forma publica del dominio currency. La forma "sobre el cable"
// (ConversionWire) y CurrencyApiError son detalle de implementacion de
// currency.service.ts.
export interface ConversionResult {
  convertedAmount: number
  rateUsed: number
}
