import { describe, expect, it } from 'vitest'
import { buildDonutSegments, groupSlices, sliceColor } from '../donut'

const item = (category: string, total: number) => ({ category, total, percentage: 0 })

describe('donut', () => {
  it('agrupa lo que pasa de las 5 mayores en "Otros"', () => {
    const slices = groupSlices(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name, i) => item(name, 100 - i * 10)))

    expect(slices).toHaveLength(6)
    expect(slices[5].category).toBe('Otros')
    expect(slices[5].total).toBe(50 + 40)
    expect(slices.reduce((sum, slice) => sum + slice.percentage, 0)).toBeCloseTo(100)
  })

  it('no agrega "Otros" si todo cabe', () => {
    expect(groupSlices([item('A', 1), item('B', 1)]).map((s) => s.category)).toEqual(['A', 'B'])
  })

  it('los segmentos se encadenan sin dejar huecos entre desplazamientos', () => {
    const segments = buildDonutSegments(groupSlices([item('A', 50), item('B', 30), item('C', 20)]), null)

    expect(segments[0].dashOffset).toBe(25)
    expect(segments[1].dashOffset).toBe(-25)
    expect(segments[2].dashOffset).toBe(-55)
  })

  it('la mayor lleva el acento y el resto grises cada vez mas tenues', () => {
    expect(sliceColor(0, null)).toBe('var(--accent)')
    const opacity = (index: number) => Number(sliceColor(index, null).match(/([\d.]+)\)$/)?.[1])
    expect(opacity(1)).toBeGreaterThan(opacity(2))
    expect(opacity(2)).toBeGreaterThan(opacity(3))
  })

  it('con una categoria seleccionada solo esa conserva color', () => {
    expect(sliceColor(2, 2)).toBe('var(--accent)')
    expect(sliceColor(0, 2)).not.toBe('var(--accent)')
  })

  it('sin datos no devuelve segmentos', () => {
    expect(buildDonutSegments([], null)).toEqual([])
  })
})
