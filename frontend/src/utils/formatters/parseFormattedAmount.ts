export interface ParsedAmount {
  /** Todo lo que va ANTES del bloque numerico (ej. "$"). */
  prefix: string
  /** Solo los caracteres 0-9 del bloque numerico, en orden. */
  digits: number[]
  /** Comas/puntos de miles o decimales, con su posicion (cuantos digitos
   * llevaba contados cuando aparece ese separador). */
  separators: { afterDigitIndex: number; char: string }[]
  /** Todo lo que va DESPUES del bloque numerico (ej. " USDT", " €"). */
  suffix: string
}

// Separa un string ya formateado (formatCurrency) en sus digitos vs el resto
// (simbolo de moneda, separadores de miles/decimales, codigo de moneda como
// sufijo) - pensado para el efecto "odometro" de AnimatedCurrency.vue: cada
// digito rota en su propio reel, pero el simbolo/separadores/sufijo quedan
// estaticos.
export function parseFormattedAmount(formatted: string): ParsedAmount {
  const coreMatch = formatted.match(/[0-9.,]+/)
  if (!coreMatch || coreMatch.index === undefined) {
    return { prefix: formatted, digits: [], separators: [], suffix: '' }
  }

  const core = coreMatch[0]
  const prefix = formatted.slice(0, coreMatch.index)
  const suffix = formatted.slice(coreMatch.index + core.length)

  const digits: number[] = []
  const separators: ParsedAmount['separators'] = []
  for (const char of core) {
    if (char >= '0' && char <= '9') {
      digits.push(Number(char))
    } else {
      separators.push({ afterDigitIndex: digits.length, char })
    }
  }

  return { prefix, digits, separators, suffix }
}

// Digitos de "value" (siempre con 2 decimales, igual criterio que
// formatCurrency) rellenados con ceros a la izquierda hasta "digitCount"
// posiciones - para que el "punto de partida" de la animacion del odometro
// tenga la MISMA cantidad de digitos que el valor final (sus separadores de
// miles/decimales, tomados del valor final, quedan fijos toda la animacion).
export function padDigitsToLength(value: number, digitCount: number): number[] {
  if (digitCount <= 0) return []
  const cents = Math.round(Math.abs(value) * 100)
  const raw = String(cents).padStart(digitCount, '0')
  return raw.slice(-digitCount).split('').map(Number)
}
