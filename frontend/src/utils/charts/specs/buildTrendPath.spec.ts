import { describe, expect, it } from 'vitest'
import { buildTrendPath } from '../buildTrendPath'

describe('buildTrendPath', () => {
  it('devuelve paths vacios con menos de 2 valores', () => {
    expect(buildTrendPath([], 100, 50)).toEqual({ linePath: '', areaPath: '', endPoint: [0, 0] })
    expect(buildTrendPath([5], 100, 50)).toEqual({ linePath: '', areaPath: '', endPoint: [0, 0] })
  })

  it('no explota con una serie plana (range 0)', () => {
    const { linePath } = buildTrendPath([10, 10, 10], 100, 50)
    expect(linePath).not.toContain('NaN')
    expect(linePath).not.toContain('Infinity')
  })

  it('arranca en x=0 y termina en el ancho total', () => {
    const { linePath } = buildTrendPath([0, 5, 2, 8], 300, 100)
    expect(linePath.startsWith('M 0,')).toBe(true)
    expect(linePath.endsWith('L 300,' + linePath.match(/L 300,([\d.]+)/)?.[1])).toBe(true)
  })

  it('el area cierra el path hacia las esquinas inferiores', () => {
    const { linePath, areaPath } = buildTrendPath([0, 5, 2, 8], 300, 100)
    expect(areaPath.startsWith(linePath)).toBe(true)
    expect(areaPath).toContain('L 300,100 L 0,100 Z')
  })

  it('endPoint coincide con el ultimo punto del path', () => {
    const { linePath, endPoint } = buildTrendPath([0, 5, 2, 8], 300, 100)
    expect(linePath.endsWith(`L 300,${endPoint[1]}`)).toBe(true)
    expect(endPoint[0]).toBe(300)
  })

  it('el valor minimo cae cerca del borde inferior util y el maximo cerca del superior', () => {
    const { linePath } = buildTrendPath([0, 100], 200, 100, 10)
    // primer punto (valor minimo) cerca de y=90 (100 - padding 10), segundo (max) cerca de y=10
    const firstY = Number(linePath.match(/^M 0,([\d.]+)/)?.[1])
    const lastY = Number(linePath.match(/L 200,([\d.]+)$/)?.[1])
    expect(firstY).toBeCloseTo(90, 0)
    expect(lastY).toBeCloseTo(10, 0)
  })
})
