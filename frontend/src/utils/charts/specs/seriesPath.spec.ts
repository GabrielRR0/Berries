import { describe, expect, it } from 'vitest'
import { buildSeriesGeometry } from '../seriesPath'

const BOX = { width: 100, height: 100, padTop: 10, padBottom: 10 }

describe('buildSeriesGeometry', () => {
  it('el eje siempre incluye el cero: una serie positiva apoya su minimo sobre la linea de cero', () => {
    const geometry = buildSeriesGeometry([10, 20, 40], BOX)

    expect(geometry.zeroY).toBe(90)
    expect(geometry.points[2][1]).toBe(10)
  })

  it('un valor negativo queda por debajo de la linea de cero', () => {
    const geometry = buildSeriesGeometry([50, -50], BOX)

    expect(geometry.points[1][1]).toBeGreaterThan(geometry.zeroY)
  })

  it('reparte los puntos de borde a borde', () => {
    const geometry = buildSeriesGeometry([1, 2, 3], BOX)

    expect(geometry.points.map((point) => point[0])).toEqual([0, 50, 100])
  })

  it('el area se cierra contra la linea de cero', () => {
    const geometry = buildSeriesGeometry([1, 2], BOX)

    expect(geometry.areaPath.endsWith('Z')).toBe(true)
    expect(geometry.areaPath).toContain(`L ${geometry.points[1][0]},${geometry.zeroY}`)
  })

  it('con menos de dos puntos no dibuja linea', () => {
    expect(buildSeriesGeometry([5], BOX).linePath).toBe('')
    expect(buildSeriesGeometry([], BOX).points).toEqual([])
  })
})
