import { describe, expect, it } from 'vitest'
import { statementDescriptionRegion } from '../bankStatementParser'
import {
  SMALL_TEXT_HEIGHT,
  medianWordHeight,
  replaceWordsInRegion,
  scaleWords,
  upscaleFactorFor,
} from '../ocrLayout'
import type { OcrWord } from '../ocrLayout'
import { BANK_STATEMENT_WORDS } from './listFixtures'

function word(text: string, x0: number, y0: number, height: number, width = 40): OcrWord {
  return { text, x0, y0, x1: x0 + width, y1: y0 + height }
}

describe('medianWordHeight y upscaleFactorFor', () => {
  it('mide el alto tipico de las palabras, ignorando las vacias', () => {
    expect(medianWordHeight([word('a', 0, 0, 10), word('b', 0, 20, 12), word('c', 0, 40, 30), word(' ', 0, 60, 99)])).toBe(12)
  })

  it('una captura de escritorio con letra chica (~10 px) se vuelve a leer ampliada', () => {
    const small = Array.from({ length: 20 }, (_, index) => word('x', 0, index * 20, 10))

    expect(upscaleFactorFor(small, 1918, 889)).toBe(2)
  })

  it('una captura de celular, con texto grande, no se amplia', () => {
    const big = Array.from({ length: 20 }, (_, index) => word('x', 0, index * 40, SMALL_TEXT_HEIGHT + 12))

    expect(upscaleFactorFor(big, 1170, 2532)).toBe(1)
  })

  it('no se amplia si la imagen ya es demasiado grande para duplicarla', () => {
    const small = Array.from({ length: 20 }, (_, index) => word('x', 0, index * 20, 10))

    expect(upscaleFactorFor(small, 2800, 1500)).toBe(1)
  })

  it('sin palabras no hay nada que decidir', () => {
    expect(upscaleFactorFor([], 1918, 889)).toBe(1)
  })
})

describe('replaceWordsInRegion y scaleWords', () => {
  const region = { left: 100, top: 100, width: 200, height: 400 }

  it('cambia solo las palabras de la region y deja el resto', () => {
    const words = [word('fuera', 10, 120, 10), word('Eo', 150, 120, 10), word('dentro2', 160, 200, 10), word('derecha', 400, 120, 10)]
    const replacements = [word('OPERACION', 150, 118, 10), word('PAGOMOVIL', 150, 200, 10), word('  ', 150, 300, 10)]

    const result = replaceWordsInRegion(words, region, replacements)

    expect(result.map((item) => item.text).sort()).toEqual(['OPERACION', 'PAGOMOVIL', 'derecha', 'fuera'])
  })

  it('devuelve las posiciones a la imagen original al dividir por el factor de ampliacion', () => {
    const [scaled] = scaleWords([{ text: 'a', x0: 200, y0: 100, x1: 300, y1: 140 }], 2)

    expect(scaled).toEqual({ text: 'a', x0: 100, y0: 50, x1: 150, y1: 70 })
  })

  it('con factor 1 devuelve las mismas palabras', () => {
    const words = [word('a', 1, 2, 3)]

    expect(scaleWords(words, 1)).toBe(words)
  })
})

describe('statementDescriptionRegion', () => {
  it('es la columna de descripcion de la tabla, en enteros y dentro de la imagen', () => {
    const region = statementDescriptionRegion(BANK_STATEMENT_WORDS, 1918, 889)!

    expect(region).not.toBeNull()
    expect(Object.values(region).every(Number.isInteger)).toBe(true)
    // Empieza antes de donde empieza la descripcion (x = 800) y termina antes de la columna Debito/Credito (x = 957).
    expect(region.left).toBeLessThanOrEqual(800)
    expect(region.left + region.width).toBeLessThanOrEqual(957)
    expect(region.left + region.width).toBeGreaterThan(900)
    // Debajo de los titulos y sin pasar del borde de la imagen (si no, Tesseract falla con un error de memoria).
    expect(region.top).toBeGreaterThan(98)
    expect(region.top + region.height).toBeLessThanOrEqual(889)
    expect(region.left).toBeGreaterThanOrEqual(0)
  })

  it('se recorta a los limites cuando el texto llega casi al borde', () => {
    const region = statementDescriptionRegion(BANK_STATEMENT_WORDS, 1918, 880)!

    expect(region.top + region.height).toBeLessThanOrEqual(880)
  })

  it('sin tabla reconocida no hay region', () => {
    expect(statementDescriptionRegion([word('hola', 10, 10, 12)], 800, 600)).toBeNull()
  })
})
