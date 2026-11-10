export interface SeriesGeometry {
  points: [number, number][]
  linePath: string
  areaPath: string
  /** Altura (en unidades del viewBox) de la linea de cero. */
  zeroY: number
}

export interface SeriesBox {
  width: number
  height: number
  padX?: number
  padTop?: number
  padBottom?: number
}

// Curva suave de una serie que SI respeta el cero (a diferencia de buildTrendPath, que
// normaliza al min/max de la propia serie): el eje siempre incluye 0 para que un ahorro
// negativo se vea por debajo de la linea.
export function buildSeriesGeometry(values: number[], box: SeriesBox): SeriesGeometry {
  const { width, height, padX = 0, padTop = 8, padBottom = 8 } = box
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  const usable = height - padTop - padBottom
  const toY = (value: number) => padTop + (1 - (value - min) / range) * usable
  const zeroY = toY(0)

  const points: [number, number][] = values.map((value, index) => [
    values.length === 1 ? width / 2 : padX + (index / (values.length - 1)) * (width - padX * 2),
    toY(value),
  ])
  if (points.length < 2) return { points, linePath: '', areaPath: '', zeroY }

  let linePath = `M ${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    linePath += ` Q ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`
  }
  const [lastX, lastY] = points[points.length - 1]
  linePath += ` L ${lastX},${lastY}`
  const areaPath = `${linePath} L ${lastX},${zeroY} L ${points[0][0]},${zeroY} Z`
  return { points, linePath, areaPath, zeroY }
}
