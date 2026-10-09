import { describe, expect, it } from 'vitest'
import { toOcrGrayscale } from '../prepareImage'

describe('toOcrGrayscale', () => {
  it('invierte una imagen oscura para que el texto quede oscuro sobre fondo claro', () => {
    // fondo casi negro con un pixel de texto claro
    const pixels = new Uint8ClampedArray([10, 10, 10, 255, 10, 10, 10, 255, 240, 240, 240, 255, 10, 10, 10, 255])

    toOcrGrayscale(pixels)

    expect(pixels[0]).toBe(245)
    expect(pixels[8]).toBe(15)
  })

  it('deja igual (en grises) una imagen clara', () => {
    const pixels = new Uint8ClampedArray([250, 250, 250, 255, 250, 250, 250, 255, 20, 20, 20, 255, 250, 250, 250, 255])

    toOcrGrayscale(pixels)

    expect(pixels[0]).toBe(250)
    expect(pixels[8]).toBe(20)
  })
})
