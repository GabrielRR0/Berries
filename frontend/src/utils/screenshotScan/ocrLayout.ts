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
