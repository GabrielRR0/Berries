// Servicio fetch-based del dominio currency (mismo patron que el resto de
// services/) - un unico endpoint de conversion sobre la tasa cacheada del
// backend (ver berry/backend/app/services/currency/currency_service.py).
import { useAuthStore } from '../../stores/auth.store'
import type { ConversionResult, RateHistoryResult } from './interfaces/currency.interface'

// "converted_amount"/"rate_used" son Decimal de Pydantic - mismo criterio de
// normalizacion a number que el resto de services/ (solo para mostrar).
interface ConversionWire {
  converted_amount: number | string
  rate_used: number | string
}

interface RateHistoryPointWire {
  fetched_at: string
  rate: number | string
  source: string | null
  is_estimated: boolean
}

interface RateHistoryWire {
  code: string
  quote: string
  points: RateHistoryPointWire[]
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

// "against" default "USD" trae la serie oficial/de mercado. "USDT" trae en cambio la
// serie de tasas IMPLÍCITAS reales que el propio usuario obtuvo en sus
// transferencias USDT<->code (ver transfer_service.py del backend) - pedido
// explícito del usuario: poder comparar la tasa oficial contra la que él de verdad
// consigue.
export async function getRateHistory(code: string, months = 6, against = 'USD'): Promise<RateHistoryResult> {
  const token = useAuthStore().token
  const query = new URLSearchParams({ code, months: String(months), against })

  const response = await fetch(`${API_BASE_URL}/api/currency/history?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new CurrencyApiError(await parseErrorMessage(response, 'No se pudo obtener el historial de tasas.'), response.status)
  }

  const wire = (await response.json()) as RateHistoryWire
  return {
    code: wire.code,
    quote: wire.quote,
    points: wire.points.map((point) => ({
      fetchedAt: point.fetched_at,
      rate: Number(point.rate),
      source: point.source,
      isEstimated: point.is_estimated,
    })),
  }
}
