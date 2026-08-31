// Servicio fetch-based del dominio receipt-scanner - mismo patron que
// services/voiceEntry/voice-entry.service.ts (multipart/form-data, no JSON).
// Ver berry/backend - POST /api/receipt-scanner devuelve un Draft (misma
// forma reexportada desde transactions.service.ts) con source: "ocr". Hoy,
// en este entorno, responde 503 porque el proveedor real de OCR todavia no
// esta configurado - es el caso esperado (ver ReceiptUpload.vue), no un bug.
import { useAuthStore } from '../../stores/auth.store'
import type { Draft } from '../transactions/interfaces/transactions.interface'

interface DraftWire {
  id: string
  source: string
  raw_input: string | null
  parsed_amount: number | string | null
  parsed_currency: string | null
  parsed_category: string | null
  parsed_description: string | null
  suggested_wallet_id: string | null
  status: string
  created_at: string
}

export class ReceiptScannerApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ReceiptScannerApiError'
    this.status = status
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function mapDraft(wire: DraftWire): Draft {
  return {
    id: wire.id,
    source: wire.source,
    rawInput: wire.raw_input,
    parsedAmount: wire.parsed_amount === null ? null : Number(wire.parsed_amount),
    parsedCurrency: wire.parsed_currency,
    parsedCategory: wire.parsed_category,
    parsedDescription: wire.parsed_description,
    suggestedWalletId: wire.suggested_wallet_id,
    status: wire.status,
    createdAt: wire.created_at,
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  return body?.detail ?? fallback
}

export async function submitReceiptScan(imageFile: File): Promise<Draft> {
  const token = useAuthStore().token
  const formData = new FormData()
  // El File ya trae su propio nombre (el elegido por el usuario o la
  // camara) - no hace falta forzar uno como en voice-entry.service.ts (ahi
  // el Blob crudo del MediaRecorder no tiene nombre propio).
  formData.append('image', imageFile)

  const response = await fetch(`${API_BASE_URL}/api/receipt-scanner`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) {
    throw new ReceiptScannerApiError(
      await parseErrorMessage(response, 'El escaneo de recibos todavía no está disponible.'),
      response.status,
    )
  }

  return mapDraft((await response.json()) as DraftWire)
}
