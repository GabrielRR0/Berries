export interface TrendPathResult {
  linePath: string
  areaPath: string
  /** Coordenadas del ultimo punto de la linea (viewBox units) - util para anclar
   * un elemento decorativo (ej. un punto pulsante) en la punta del trazo. */
  endPoint: [number, number]
}

// Convierte una serie de valores (importa la FORMA relativa, no la escala real -
// siempre se normaliza a min/max de la propia serie) en dos paths SVG suaves: la
// linea del trend y el area rellena debajo. Suavizado con quadratic bezier a traves
// de puntos medios entre puntos consecutivos (tecnica liviana, sin libreria de
// charts) - da una curva organica en vez del aspecto de zigzag de segmentos rectos.
export function buildTrendPath(
  values: number[],
  viewBoxWidth: number,
  viewBoxHeight: number,
  paddingY = 8,
): TrendPathResult {
  if (values.length < 2) {
    return { linePath: '', areaPath: '', endPoint: [0, 0] }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const usableHeight = viewBoxHeight - paddingY * 2

  const points: [number, number][] = values.map((value, index) => {
    const x = (index / (values.length - 1)) * viewBoxWidth
    const y = paddingY + usableHeight - ((value - min) / range) * usableHeight
    return [x, y]
  })

  let linePath = `M ${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const midX = (x0 + x1) / 2
    const midY = (y0 + y1) / 2
    linePath += ` Q ${x0},${y0} ${midX},${midY}`
  }
  const [lastX, lastY] = points[points.length - 1]
  linePath += ` L ${lastX},${lastY}`

  const areaPath = `${linePath} L ${viewBoxWidth},${viewBoxHeight} L 0,${viewBoxHeight} Z`

  return { linePath, areaPath, endPoint: [lastX, lastY] }
}
