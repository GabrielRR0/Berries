// Palabras que devuelve el OCR con su posicion en la imagen. Una lista de
// movimientos tiene dos columnas por fila (texto a la izquierda, monto y hora a
// la derecha), y el texto plano las mezcla; con las posiciones se puede separar
// cada pieza y saber a que fila pertenece.
export interface OcrBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrWord extends OcrBox {
  text: string
}

// Pieza de texto contigua dentro de una linea visual (ej. la descripcion de la
// izquierda, o el monto de la derecha).
export interface Segment extends OcrBox {
  text: string
  // Indice de la linea visual a la que pertenece.
  line: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

// Une palabras en lineas visuales (mismo alto) y parte cada linea en segmentos
// donde hay un hueco horizontal grande entre palabras.
export function groupSegments(words: OcrWord[], imageWidth: number): Segment[] {
  const usable = words.filter((word) => word.text.trim() !== '')
  if (usable.length === 0) return []

  const medianHeight = median(usable.map((word) => word.y1 - word.y0))
  const sorted = [...usable].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2)

  const lines: OcrWord[][] = []
  let lineCenter = -Infinity
  for (const word of sorted) {
    const center = (word.y0 + word.y1) / 2
    if (lines.length === 0 || Math.abs(center - lineCenter) > medianHeight * 0.6) {
      lines.push([word])
      lineCenter = center
    } else {
      lines[lines.length - 1]!.push(word)
      const current = lines[lines.length - 1]!
      lineCenter = current.reduce((sum, w) => sum + (w.y0 + w.y1) / 2, 0) / current.length
    }
  }

  const gapThreshold = Math.max(imageWidth * 0.06, medianHeight * 2.5)
  const segments: Segment[] = []
  lines.forEach((line, lineIndex) => {
    const ordered = [...line].sort((a, b) => a.x0 - b.x0)
    let current: OcrWord[] = []
    const flush = () => {
      if (current.length === 0) return
      segments.push({
        text: current.map((word) => word.text).join(' '),
        x0: Math.min(...current.map((word) => word.x0)),
        y0: Math.min(...current.map((word) => word.y0)),
        x1: Math.max(...current.map((word) => word.x1)),
        y1: Math.max(...current.map((word) => word.y1)),
        line: lineIndex,
      })
      current = []
    }
    for (const word of ordered) {
      const previous = current[current.length - 1]
      if (previous && word.x0 - previous.x1 > gapThreshold) flush()
      current.push(word)
    }
    flush()
  })
  return segments
}

export function centerY(box: OcrBox): number {
  return (box.y0 + box.y1) / 2
}

export interface OcrRegion {
  left: number
  top: number
  width: number
  height: number
}

// Alto tipico de una palabra leida, en pixeles: mide que tan chico es el texto de la imagen.
export function medianWordHeight(words: OcrWord[]): number {
  return median(words.filter((word) => word.text.trim() !== '').map((word) => word.y1 - word.y0))
}

// Tesseract lee mal el texto muy chico (una captura de escritorio con letras de ~12 px pierde hasta
// los titulos de la tabla). Si el texto es chico se vuelve a leer la imagen ampliada. Solo se amplia
// cuando hace falta (una captura de celular ya trae texto grande) y sin pasar de un tamano manejable.
export const SMALL_TEXT_HEIGHT = 18
export const UPSCALED_MAX_SIDE = 4200

export function upscaleFactorFor(words: OcrWord[], width: number, height: number): number {
  if (words.length === 0) return 1
  if (medianWordHeight(words) >= SMALL_TEXT_HEIGHT) return 1
  return Math.max(width, height) * 2 <= UPSCALED_MAX_SIDE ? 2 : 1
}

// Cambia las palabras que caen dentro de `region` por las de una lectura aparte de esa region (ambas
// en las mismas coordenadas de la imagen). Sirve para releer una columna con otro modo de segmentacion.
export function replaceWordsInRegion(words: OcrWord[], region: OcrRegion, replacements: OcrWord[]): OcrWord[] {
  const inside = (word: OcrWord) => {
    const cx = (word.x0 + word.x1) / 2
    const cy = centerY(word)
    return cx >= region.left && cx <= region.left + region.width && cy >= region.top && cy <= region.top + region.height
  }
  return [...words.filter((word) => !inside(word)), ...replacements.filter((word) => word.text.trim() !== '')]
}

export function scaleWords(words: OcrWord[], factor: number): OcrWord[] {
  if (factor === 1) return words
  return words.map((word) => ({
    text: word.text,
    x0: word.x0 / factor,
    y0: word.y0 / factor,
    x1: word.x1 / factor,
    y1: word.y1 / factor,
  }))
}
