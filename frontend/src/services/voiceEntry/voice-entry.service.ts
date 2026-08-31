// Servicio fetch-based del dominio voice-entry (mismo patron general que
// services/transactions/transactions.service.ts). La transcripción ya viene
// hecha del lado del navegador (Web Speech API, ver VoiceRecorderModal.vue)
// - el backend nunca recibe audio, solo el texto ya reconocido como JSON.
// POST /api/voice-entry devuelve un Draft (misma forma que
// transactions.service.ts, reexportado desde ahi sin redefinir el tipo) con
// source: "voice".
import { useAuthStore } from '../../stores/auth.store'
import type { Draft } from '../transactions/interfaces/transactions.interface'

// Misma forma "sobre el cable" que DraftWire en transactions.service.ts (no
// se puede importar de ahi porque esa interfaz no esta exportada - se
// duplica aca a proposito, igual criterio que otros servicios del proyecto).
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

export class VoiceEntryApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'VoiceEntryApiError'
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

export async function submitVoiceEntry(transcript: string): Promise<Draft> {
  const token = useAuthStore().token

  const response = await fetch(`${API_BASE_URL}/api/voice-entry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ transcript }),
  })

  if (!response.ok) {
    throw new VoiceEntryApiError(
      await parseErrorMessage(response, 'No se pudo registrar el movimiento por voz.'),
      response.status,
    )
  }

  return mapDraft((await response.json()) as DraftWire)
}
