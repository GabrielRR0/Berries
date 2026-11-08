import { BDV_PROFILE } from './bdv'
import type { BankId, StatementProfile } from './types'

export type { BankId, StatementProfile }

// Banco que se usa mientras el usuario no elija otro en Ajustes.
export const DEFAULT_BANK_ID: BankId = 'bdv'

// Todos los perfiles disponibles. Para agregar un banco: su archivo en esta carpeta + una linea aqui.
export const STATEMENT_PROFILES: StatementProfile[] = [BDV_PROFILE]

export interface BankOption {
  id: BankId
  label: string
}

// Lo que ofrece la pantalla de Ajustes.
export const BANK_OPTIONS: BankOption[] = STATEMENT_PROFILES.map((profile) => ({ id: profile.id, label: profile.label }))

// Devuelve el perfil del banco; sin banco, o con uno desconocido, el de por defecto.
export function getProfile(id?: BankId | null): StatementProfile {
  return STATEMENT_PROFILES.find((profile) => profile.id === id) ?? BDV_PROFILE
}

// Convierte un texto guardado (por ejemplo de localStorage) en un banco valido; si no lo es, el de por defecto.
export function toBankId(value: string | null | undefined): BankId {
  return STATEMENT_PROFILES.find((profile) => profile.id === value)?.id ?? DEFAULT_BANK_ID
}
