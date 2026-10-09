// Minusculas y sin tildes: el OCR a veces pierde o inventa acentos
// ("Comision"/"Comisión"), y las etiquetas se comparan sin ellos.
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

// Valor que acompana a una etiqueta. En una captura las etiquetas y valores
// van en columnas, y el OCR los devuelve casi siempre en la misma linea
// ("Comision 0,06 USDT"); si la etiqueta quedo sola en su linea, el valor es
// la linea siguiente.
export function findValueAfterLabel(lines: string[], label: RegExp): string | null {
  for (let index = 0; index < lines.length; index++) {
    const normalized = normalizeForMatch(lines[index]!)
    const match = normalized.match(label)
    if (!match) continue

    // normalizeForMatch conserva la longitud (NFD solo separa tildes que se
    // borran 1 a 1 en el texto original), asi que el indice sirve sobre la linea original.
    const sameLine = lines[index]!.slice(match[0].length).trim()
    if (sameLine !== '') return sameLine
    return lines[index + 1] ?? null
  }
  return null
}
