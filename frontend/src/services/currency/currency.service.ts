// Servicio fetch-based del dominio currency (mismo patron que el resto de
// services/) - un unico endpoint de conversion sobre la tasa cacheada del
// backend (ver berry/backend/app/services/currency/currency_service.py).
import { useAuthStore } from '../../stores/auth.store'
import type { ConversionResult } from './interfaces/currency.interface'

// "converted_amount"/"rate_used" son Decimal de Pydantic - mismo criterio de
// normalizacion a number que el resto de services/ (solo para mostrar).
interface ConversionWire {
  converted_amount: number | string
  rate_used: number | string
}

export class CurrencyApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CurrencyApiError'
    this.status = status
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapConversion(wire: ConversionWire): ConversionResult {
  return {
    convertedAmount: Number(wire.converted_amount),
    rateUsed: Number(wire.rate_used),
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

export async function convertAmount(amount: number, from: string, to: string): Promise<ConversionResult> {
  const token = useAuthStore().token
  const query = new URLSearchParams({ amount: String(amount), from, to })

  const response = await fetch(`${API_BASE_URL}/api/currency/convert?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new CurrencyApiError(await parseErrorMessage(response, 'No se pudo convertir el monto.'), response.status)
  }

  return mapConversion((await response.json()) as ConversionWire)
}
