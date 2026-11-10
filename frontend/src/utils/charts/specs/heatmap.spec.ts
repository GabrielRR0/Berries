import { describe, expect, it } from 'vitest'
import { buildHeatGrid, buildWeekdayBars } from '../heatmap'

describe('buildHeatGrid', () => {
  it('rellena con celdas vacias los dias que aun no llegan', () => {
    const heat = Array.from({ length: 8 }, (_, i) => ({ day: `d${i}`, total: i * 10 }))
    const grid = buildHeatGrid(heat, 2)

    expect(grid).toHaveLength(14)
    expect(grid.slice(0, 8).every((cell) => !cell.empty)).toBe(true)
    expect(grid.slice(8).every((cell) => cell.empty)).toBe(true)
  })

  it('el dia de mayor gasto tiene intensidad 1 y los demas menos', () => {
    const grid = buildHeatGrid(
      [
        { day: 'a', total: 100 },
        { day: 'b', total: 25 },
        { day: 'c', total: 0 },
      ],
      1,
    )

    expect(grid[0].level).toBe(1)
    expect(grid[1].level).toBeCloseTo(0.5)
    expect(grid[2].level).toBe(0)
  })

  it('sin gasto no divide por cero', () => {
    expect(buildHeatGrid([{ day: 'a', total: 0 }], 1)[0].level).toBe(0)
  })
})

describe('buildWeekdayBars', () => {
  it('ordena de lunes a domingo y marca el pico', () => {
    const bars = buildWeekdayBars([
      { weekday: 5, average: 96 },
      { weekday: 0, average: 34 },
      { weekday: 4, average: 78 },
    ])

    expect(bars.map((bar) => bar.weekday)).toEqual([0, 4, 5])
    expect(bars.find((bar) => bar.isPeak)?.weekday).toBe(5)
    expect(bars[0].ratio).toBeCloseTo(34 / 96)
  })

  it('sin gasto no hay pico', () => {
    expect(buildWeekdayBars([{ weekday: 0, average: 0 }]).some((bar) => bar.isPeak)).toBe(false)
  })
})
