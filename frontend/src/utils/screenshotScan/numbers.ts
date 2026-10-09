import type { NumberLocale } from './types'

// Lee un numero con separadores de miles/decimales segun el idioma de la
// captura: en espanol "1.006,513" es 1006.513 y "26.600" es 26600; en ingles
// "1,006.513" es 1006.513. Con los dos separadores presentes manda el ultimo
// (es el decimal); con uno solo se usa el idioma para desempatar.
export function parseLocalizedNumber(token: string, locale: NumberLocale): number | null {
  const cleaned = token.replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '')
  if (cleaned === '') return null

  const dotCount = (cleaned.match(/\./g) ?? []).length
  const commaCount = (cleaned.match(/,/g) ?? []).length
  let normalized: string

  if (dotCount > 0 && commaCount > 0) {
    const decimalSeparator = cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',') ? '.' : ','
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.'
    normalized = cleaned.split(thousandsSeparator).join('').replace(decimalSeparator, '.')
  } else if (dotCount > 0 || commaCount > 0) {
    const separator = dotCount > 0 ? '.' : ','
    const count = dotCount > 0 ? dotCount : commaCount
    const digitsAfter = cleaned.length - cleaned.lastIndexOf(separator) - 1
    const thousandsSeparator = locale === 'es' ? '.' : ','
    const isThousands = count > 1 || (separator === thousandsSeparator && digitsAfter === 3)
    normalized = isThousands ? cleaned.split(separator).join('') : cleaned.replace(separator, '.')
  } else {
    normalized = cleaned
  }

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

// Primera fecha reconocible del texto, devuelta como YYYY-MM-DD. Acepta
// 2026-10-08, 08/10/2026 (dia primero en espanol) y 10/08/2026 (mes primero
// en ingles). Una fecha imposible (31/02) se descarta en vez de corregirse.
export function parseDateToIso(text: string, locale: NumberLocale): string | null {
  const isoMatch = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  const localMatch = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)

  let year: number
  let month: number
  let day: number
  if (isoMatch) {
    ;[year, month, day] = [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
  } else if (localMatch) {
    const first = Number(localMatch[1])
    const second = Number(localMatch[2])
    year = Number(localMatch[3])
    ;[day, month] = locale === 'es' ? [first, second] : [second, first]
  } else {
    return null
  }

  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
