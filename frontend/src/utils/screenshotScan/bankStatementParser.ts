import { mergeFees } from './bankListParser'
import {
  STATEMENT_COLUMN_SYNONYMS,
  STATEMENT_CREDIT,
  STATEMENT_CURRENCY,
  STATEMENT_DATE,
  STATEMENT_DEBIT,
  STATEMENT_DEBIT_OR_CREDIT_START,
  STATEMENT_TIME,
} from './dictionary/bankStatementLabels'
import type { StatementColumn, StatementMode } from './dictionary/bankStatementLabels'
import { FEE_CATEGORY } from './dictionary/feeWords'
import { isFeeText, suggestCategory } from './movementDictionary'
import { makeRow, to24h } from './movementRows'
import type { ScanRow } from './movementRows'
import { centerY } from './ocrLayout'
import type { OcrRegion, OcrWord } from './ocrLayout'
import { parseLocalizedNumber } from './numbers'
import { normalizeForMatch } from './textLines'

// Lee un estado de cuenta en TABLA (ver dictionary/bankStatementLabels.ts). A diferencia de las capturas
// del celular, las columnas van muy juntas y el texto de una celda se pega con el de la vecina, asi que
// no se puede separar por huecos: se ubican las columnas por la posicion de sus titulos y cada palabra se
// asigna a la columna donde empieza. Los titulos se reconocen por sinonimos, asi que sirve para cualquier
// banco cuya tabla use nombres parecidos.
export interface BankStatementOptions {
  imageWidth: number
  // Fecha para una fila cuya fecha no se pudo leer.
  defaultDate: string | null
  // false = descartar las comisiones en vez de unirlas a su operacion.
  includeFees?: boolean
}

interface Columns {
  mode: StatementMode
  // Donde empieza cada columna reconocida (en 'typed' el tipo Debito / Credito se guarda como `debit`).
  starts: Partial<Record<StatementColumn, number>>
  headerBottom: number
}

interface HeaderHit {
  word: OcrWord
  column: StatementColumn
}

function headerHits(words: OcrWord[]): HeaderHit[] {
  const hits: HeaderHit[] = []
  for (const word of words) {
    const text = normalizeForMatch(word.text)
    for (const [column, patterns] of Object.entries(STATEMENT_COLUMN_SYNONYMS) as [StatementColumn, RegExp[]][]) {
      if (patterns.some((pattern) => pattern.test(text))) hits.push({ word, column })
    }
  }
  return hits
}

// La fila de titulos es la que junta mas columnas distintas (un "Fecha desde" de un filtro, arriba de la
// tabla, no se confunde con ella). Devuelve null si no hay una combinacion legible.
function findColumns(words: OcrWord[]): Columns | null {
  const hits = headerHits(words)
  if (hits.length === 0) return null

  const height = Math.max(...words.map((word) => word.y1 - word.y0), 1)
  const clusters: HeaderHit[][] = []
  for (const hit of [...hits].sort((a, b) => centerY(a.word) - centerY(b.word))) {
    const cluster = clusters.find((group) => Math.abs(centerY(group[0]!.word) - centerY(hit.word)) <= height * 0.8)
    if (cluster) cluster.push(hit)
    else clusters.push([hit])
  }
  const best = clusters.reduce((current, candidate) =>
    new Set(candidate.map((hit) => hit.column)).size > new Set(current.map((hit) => hit.column)).size ? candidate : current,
  )

  // Por columna se queda la palabra mas a la izquierda de la fila de titulos.
  const found = new Map<StatementColumn, OcrWord>()
  for (const { word, column } of best) {
    const current = found.get(column)
    if (!current || word.x0 < current.x0) found.set(column, word)
  }
  if (!found.has('date') || !found.has('description')) return null

  const debit = found.get('debit')
  const credit = found.get('credit')
  const amount = found.get('amount')

  // "Debito / Credito" en una columna: el titulo trae una barra entre las dos palabras.
  const combined =
    debit !== undefined &&
    credit !== undefined &&
    words.some(
      (word) =>
        word.text.trim() === '/' &&
        centerY(word) >= centerY(debit) - height &&
        centerY(word) <= centerY(debit) + height &&
        word.x0 >= debit.x0 &&
        word.x1 <= credit.x1,
    )

  let mode: StatementMode
  const starts: Partial<Record<StatementColumn, number>> = {}
  for (const [column, word] of found) starts[column] = word.x0
  if (combined) {
    // "Debito / Credito" con barra es UNA sola columna de tipo (no dos de monto): sin la columna del
    // monto no hay nada que leer.
    if (!amount) return null
    mode = 'typed'
    // La columna de tipo empieza donde empieza "Debito"; "Credito" es parte del mismo titulo.
    delete starts.credit
  } else if (debit !== undefined && credit !== undefined) {
    mode = 'split'
    delete starts.amount
  } else if (amount) {
    mode = 'signed'
    delete starts.debit
    delete starts.credit
  } else {
    return null
  }

  const headerBottom = Math.max(...best.map((hit) => hit.word.y1))
  return { mode, starts, headerBottom }
}

function columnOf(word: OcrWord, columns: Columns, tolerance: number): StatementColumn | null {
  let found: StatementColumn | null = null
  let foundStart = -Infinity
  for (const [column, start] of Object.entries(columns.starts) as [StatementColumn, number][]) {
    // La columna cuyo inicio esta mas cerca (por la izquierda) de la palabra.
    if (word.x0 >= start - tolerance && start > foundStart) {
      found = column
      foundStart = start
    }
  }
  return found
}

function cellText(words: OcrWord[]): string {
  if (words.length === 0) return ''
  // Por lineas (de arriba a abajo) y de izquierda a derecha dentro de cada una.
  const ordered = [...words].sort((a, b) => centerY(a) - centerY(b) || a.x0 - b.x0)
  const lineHeight = Math.max(...ordered.map((word) => word.y1 - word.y0), 1)
  const lines: OcrWord[][] = []
  for (const word of ordered) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(centerY(word) - centerY(last[0]!)) <= lineHeight * 0.6) last.push(word)
    else lines.push([word])
  }
  return lines
    .map((line) => [...line].sort((a, b) => a.x0 - b.x0).map((word) => word.text).join(' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAmount(text: string): { value: number; negative: boolean } | null {
  const token = text.match(/-?\s*\d[\d.,]*/)?.[0]
  if (!token) return null
  const value = parseLocalizedNumber(token, 'es')
  return value === null ? null : { value, negative: token.trim().startsWith('-') }
}

interface Entry {
  row: ScanRow
  signedAmount: number
  balance: number | null
}

const BALANCE_TOLERANCE = 0.011
const BALANCE_FLAG = 'El saldo del banco no cuadra con este movimiento: revisa el monto.'

// El saldo permite comprobar la lectura: la lista va de lo mas nuevo a lo mas viejo, asi que el saldo
// de una fila debe ser el saldo de la siguiente MAS su movimiento (con signo). Si no cuadra, el OCR
// leyo mal algun numero y la fila se marca.
function checkBalanceChain(entries: Entry[]): void {
  for (let index = 0; index < entries.length - 1; index++) {
    const current = entries[index]!
    const previous = entries[index + 1]!
    if (current.balance === null || previous.balance === null) continue
    if (Math.abs(previous.balance + current.signedAmount - current.balance) > BALANCE_TOLERANCE) {
      current.row.flags.push(BALANCE_FLAG)
    }
  }
}

const NUMERIC = /\d/

// Region (en coordenadas de la imagen) de la columna de descripcion de una tabla ya reconocida. Tesseract
// lee mal las celdas de varias lineas cuando va con el resto de la pagina ("Eo BDV", "OM DON FAG"); si se
// relee esta columna sola, como un bloque, el texto sale casi perfecto. Null si no hay tabla o columna.
// Tesseract falla (error de memoria de WASM) con una region con decimales o que se sale de la imagen:
// por eso las medidas son enteros y se recortan a los limites.
export function statementDescriptionRegion(words: OcrWord[], imageWidth: number, imageHeight: number): OcrRegion | null {
  const columns = findColumns(words)
  const start = columns?.starts.description
  if (!columns || start === undefined) return null

  const margin = imageWidth * 0.004
  const nextStart = Math.min(...Object.values(columns.starts).filter((other): other is number => other !== undefined && other > start))
  const left = Math.max(0, Math.floor(start - margin))
  const right = Math.min(imageWidth, Math.ceil(Number.isFinite(nextStart) ? nextStart - margin : start + imageWidth * 0.15))
  const top = Math.max(0, Math.floor(columns.headerBottom + 2))
  const bottom = Math.min(imageHeight, Math.ceil(Math.max(...words.map((word) => word.y1)) + 10))
  if (right <= left || bottom <= top) return null
  return { left, top, width: right - left, height: bottom - top }
}

// Cuantas cifras finales de la referencia comparten una comision y su operacion (ej. 0210086173620 y
// 0677286173620 terminan igual): el banco las genera de la misma operacion.
const REFERENCE_SUFFIX_DIGITS = 7

// Une cada comision con su operacion por la referencia: misma fecha y hora y las mismas cifras finales
// en la referencia; la de menor monto es la comision. Es independiente de lo que el OCR haya leido en la
// descripcion (que es lo mas fragil), asi que funciona aunque el texto salga deformado.
function pairFeesByReference(rows: ScanRow[]): ScanRow[] {
  const groups = new Map<string, ScanRow[]>()
  for (const row of rows) {
    if (row.direction !== 'out' || !row.reference || !row.time || !row.occurredOn) continue
    const key = `${row.occurredOn}|${row.time}|${row.reference.slice(-REFERENCE_SUFFIX_DIGITS)}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const merged = new Set<ScanRow>()
  for (const group of groups.values()) {
    if (group.length !== 2) continue
    const [fee, operation] = [...group].sort((a, b) => a.amount - b.amount) as [ScanRow, ScanRow]
    operation.fee = Math.round((operation.fee + fee.amount) * 100) / 100
    merged.add(fee)
  }
  return rows.filter((row) => !merged.has(row))
}

export function parseBankStatement(words: OcrWord[], options: BankStatementOptions): ScanRow[] {
  const columns = findColumns(words)
  if (!columns) return []

  const tolerance = options.imageWidth * 0.012
  const body = words.filter((word) => centerY(word) > columns.headerBottom)
  const inColumn = (...keys: StatementColumn[]) =>
    body.filter((word) => {
      const key = columnOf(word, columns, tolerance)
      return key !== null && keys.includes(key)
    })

  // Cada fila abre con una ancla; los limites de una fila son los puntos medios entre anclas. La ancla
  // preferida es el dato que aparece UNA vez por fila y casi nunca se lee mal: la palabra de tipo
  // (Debito/Credito), o el monto en las demas variantes; si no hay ninguna, la fecha. Asi una fecha
  // ilegible no hace que los datos de dos filas se mezclen.
  let anchorWords: OcrWord[]
  if (columns.mode === 'typed') {
    anchorWords = inColumn('debit').filter((word) => STATEMENT_DEBIT_OR_CREDIT_START.test(normalizeForMatch(word.text)))
  } else if (columns.mode === 'split') {
    anchorWords = inColumn('debit', 'credit').filter((word) => NUMERIC.test(word.text))
  } else {
    anchorWords = inColumn('amount').filter((word) => NUMERIC.test(word.text))
  }
  if (anchorWords.length === 0) anchorWords = inColumn('date').filter((word) => STATEMENT_DATE.test(word.text))
  const anchors = [...anchorWords].sort((a, b) => centerY(a) - centerY(b))
  if (anchors.length === 0) return []

  const bounds = anchors.map((anchor, index) => ({
    top: index === 0 ? columns.headerBottom : (centerY(anchors[index - 1]!) + centerY(anchor)) / 2,
    bottom: index === anchors.length - 1 ? Infinity : (centerY(anchor) + centerY(anchors[index + 1]!)) / 2,
  }))

  const entries: Entry[] = []
  for (const { top, bottom } of bounds) {
    const byColumn = new Map<StatementColumn, OcrWord[]>()
    for (const word of body) {
      const y = centerY(word)
      if (y <= top || y > bottom) continue
      const key = columnOf(word, columns, tolerance)
      if (key) byColumn.set(key, [...(byColumn.get(key) ?? []), word])
    }
    const cell = (key: StatementColumn) => cellText(byColumn.get(key) ?? [])

    const flags: string[] = []

    const dateText = cell('date')
    const dateMatch = dateText.match(STATEMENT_DATE)
    const occurredOn = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : options.defaultDate
    if (!dateMatch) flags.push(occurredOn ? 'No se leyó la fecha: se usó la elegida al inicio.' : 'Falta la fecha.')
    const time = dateText.replace(STATEMENT_DATE, '').match(STATEMENT_TIME)?.[1]

    // Monto y sentido segun la variante de la tabla.
    let amount: { value: number; negative: boolean } | null = null
    let direction: 'in' | 'out'
    if (columns.mode === 'split') {
      const out = parseAmount(cell('debit'))
      const into = parseAmount(cell('credit'))
      amount = out ?? into
      direction = out ? 'out' : 'in'
    } else {
      amount = parseAmount(cell('amount'))
      if (columns.mode === 'typed') {
        const type = normalizeForMatch(cell('debit'))
        if (STATEMENT_CREDIT.test(type)) direction = 'in'
        else if (STATEMENT_DEBIT.test(type)) direction = 'out'
        else {
          direction = amount?.negative ? 'out' : 'in'
          flags.push('No se leyó si fue débito o crédito: se dedujo del signo del monto. Revisa.')
        }
      } else {
        direction = amount?.negative ? 'out' : 'in'
      }
    }
    if (!amount || amount.value <= 0) continue

    const description = cell('description')
    const balance = parseAmount(cell('balance'))
    const row = makeRow({
      source: 'bank',
      amount: amount.value,
      currency: STATEMENT_CURRENCY,
      direction,
      occurredOn,
      time: time ? to24h(time) : null,
      description,
      reference: cell('reference').match(/\d{6,}/)?.[0] ?? null,
      flags,
      category: direction === 'out' ? (suggestCategory(description) ?? '') : '',
    })
    entries.push({
      row,
      signedAmount: direction === 'in' ? amount.value : -amount.value,
      balance: balance ? (balance.negative ? -balance.value : balance.value) : null,
    })
  }

  checkBalanceChain(entries)

  // Primero por referencia (no depende del texto leido) y despues por descripcion, para lo que quede.
  let merged = mergeFees(pairFeesByReference(entries.map((entry) => entry.row)))
  if (options.includeFees === false) {
    merged = merged.filter((row) => !(isFeeText(row.description) && row.direction === 'out'))
    for (const row of merged) row.fee = 0
  }
  // Una comision sin operacion a la que unirse se registra como su propio gasto.
  for (const row of merged) {
    if (isFeeText(row.description) && row.direction === 'out' && row.category === '') row.category = FEE_CATEGORY
  }
  return merged
}
