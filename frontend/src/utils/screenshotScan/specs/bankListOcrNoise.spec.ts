import { describe, expect, it } from 'vitest'
import { parseBankList } from '../bankListParser'
import { groupSegments } from '../ocrLayout'
import type { OcrWord } from '../ocrLayout'
import { BANK_WORDS, TODAY, isGreen, line } from './listFixtures'

// Errores reales del OCR en la lista "Movimientos": los iconos de flecha de la izquierda se leen
// como caracteres sueltos (", q") y a veces se pierde la hora o media linea de una fila.
function parse(words: OcrWord[]) {
  return parseBankList(groupSegments(words, 924), { today: TODAY, defaultDate: null, isGreen, imageWidth: 924 })
}

// Coloca ", q" junto al inicio de la descripcion de la fila con ese y0 (donde va la flecha).
function withArrowNoise(words: OcrWord[], descriptionY0: number): OcrWord[] {
  return [...words, ...line(', q', 70, 100, descriptionY0, descriptionY0 + 24)]
}

function withoutWord(words: OcrWord[], predicate: (word: OcrWord) => boolean): OcrWord[] {
  return words.filter((word) => !predicate(word))
}

describe('lista del banco con ruido de OCR', () => {
  it('quita los caracteres sueltos que deja el icono de flecha al inicio de la descripcion', () => {
    // La descripcion de "Operacion pagomovil bdv" de 9.000 esta en y = 1242.
    const rows = parse(withArrowNoise(BANK_WORDS, 1242))

    expect(rows.find((row) => row.amount === 9000)!.description).toBe('Operacion pagomovil bdv')
  })

  it('quita tambien un caracter suelto al final ("Cobro comision pag movil 4")', () => {
    // Una comision cuya segunda linea ("bdv a bdv") se leyo como un "4" suelto.
    const noisy = BANK_WORDS.map((word) =>
      word.y0 === 1103 ? { ...word, text: word.text === 'bdv' && word.x0 < 130 ? '4' : word.text } : word,
    ).filter((word) => !(word.y0 === 1103 && ['a'].includes(word.text)) && !(word.y0 === 1103 && word.x0 > 130))
    const rows = parse(noisy)

    // La comision de 27,00 se une a su operacion y su texto no estorba.
    expect(rows.find((row) => row.amount === 9000)!.fee).toBe(27)
    expect(rows.every((row) => !/\s\d$/.test(row.description))).toBe(true)
  })

  it('una comision sin hora leida se une con la operacion que viene justo despues', () => {
    // Se pierde la hora "07:57 PM" de la fila de comision de 27,00 (y = 1101).
    const rows = parse(withoutWord(BANK_WORDS, (word) => word.y0 === 1101))

    const nine = rows.find((row) => row.amount === 9000)!
    expect(nine.fee).toBe(27)
    expect(rows.some((row) => row.amount === 27)).toBe(false)
  })

  it('tambien si la hora que falta es la de la operacion', () => {
    // Se pierde la hora "07:57 PM" de la operacion de 9.000 (y = 1260).
    const rows = parse(withoutWord(BANK_WORDS, (word) => word.y0 === 1260))

    expect(rows.find((row) => row.amount === 9000)!.fee).toBe(27)
    expect(rows.some((row) => row.amount === 27)).toBe(false)
  })

  it('con las dos comisiones sin hora, cada una se une a su operacion y ninguna queda suelta', () => {
    // Faltan las horas de las comisiones de 68,54 (y = 624) y 27,00 (y = 1101) y 31,50 (y = 1578).
    const rows = parse(withoutWord(BANK_WORDS, (word) => [624, 1101, 1578].includes(word.y0)))

    expect(rows.map((row) => [row.amount, row.fee])).toEqual([
      [22848, 68.54],
      [26600, 0],
      [9000, 27],
      [10000, 0],
      [10500, 31.5],
    ])
  })

  it('no une una comision sin hora con una operacion de otro dia', () => {
    const words = withoutWord(BANK_WORDS, (word) => word.y0 === 1101)
    // La operacion que sigue a la comision de 27,00 pasa a ser de otro dia: el encabezado se mueve antes de ella.
    const withHeader = [...words, ...line('HOY', 30, 88, 1190, 1215)]
    const rows = parse(withHeader)

    expect(rows.find((row) => row.amount === 9000)!.occurredOn).toBe('2026-10-09')
    expect(rows.some((row) => row.amount === 27)).toBe(true)
  })

  it('una comision seguida de un recibido no se une a el (los recibidos no llevan comision)', () => {
    // La comision de 68,54 (sin hora) va seguida de la operacion de 22.848; el abono de 26.600 viene despues.
    const rows = parse(withoutWord(BANK_WORDS, (word) => word.y0 === 624))

    expect(rows.find((row) => row.amount === 22848)!.fee).toBe(68.54)
    expect(rows.find((row) => row.amount === 26600)!.fee).toBe(0)
  })
})
