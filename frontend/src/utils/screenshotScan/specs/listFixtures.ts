import { groupSegments } from '../ocrLayout'
import type { OcrBox, OcrWord } from '../ocrLayout'

// Fixtures de las capturas reales (palabras del OCR con su posicion), compartidos por
// los specs de los parsers y del flujo de registro.

// Una linea de texto en la imagen, repartida en palabras a lo ancho de [x0, x1].
export function line(text: string, x0: number, x1: number, y0: number, y1: number): OcrWord[] {
  const parts = text.split(' ')
  const total = parts.reduce((sum, part) => sum + part.length + 1, 0)
  let cursor = x0
  return parts.map((part) => {
    const width = ((part.length + 1) / total) * (x1 - x0)
    const word = { text: part, x0: cursor, x1: cursor + width - 2, y0, y1 }
    cursor += width
    return word
  })
}

export const TODAY = new Date(2026, 9, 9) // 9 de octubre de 2026

// Captura "Movimientos" del banco (924 px de ancho): montos y horas a la derecha, texto a la izquierda.
export const BANK_WORDS: OcrWord[] = [
  ...line('Movimientos', 172, 472, 155, 200),
  ...line('AYER', 30, 100, 513, 538),
  ...line('Cobro comision pag movil', 117, 443, 588, 612),
  ...line('bdv a bdv', 117, 241, 626, 650),
  ...line('68,54 Bs', 787, 900, 588, 614),
  ...line('10:25 PM', 798, 900, 624, 648),
  ...line('Operacion pagomovil bdv', 117, 441, 765, 790),
  ...line('22.848,00 Bs', 729, 900, 747, 773),
  ...line('10:25 PM', 798, 900, 783, 807),
  ...line('Abono recibido otr bcos', 117, 417, 925, 949),
  ...line('26.600,00 Bs', 729, 900, 906, 932),
  ...line('09:58 PM', 798, 900, 942, 966),
  ...line('Cobro comision pag movil', 117, 443, 1065, 1089),
  ...line('bdv a bdv', 117, 241, 1103, 1127),
  ...line('27,00 Bs', 787, 900, 1065, 1091),
  ...line('07:57 PM', 798, 900, 1101, 1125),
  ...line('Operacion pagomovil bdv', 117, 441, 1242, 1266),
  ...line('9.000,00 Bs', 745, 900, 1224, 1250),
  ...line('07:57 PM', 798, 900, 1260, 1284),
  ...line('Operacion pagomovil bdv', 117, 441, 1401, 1425),
  ...line('10.000,00 Bs', 729, 900, 1383, 1409),
  ...line('07:51 PM', 798, 900, 1419, 1443),
  ...line('Cobro comision pag movil', 117, 443, 1542, 1566),
  ...line('bdv a bdv', 117, 241, 1580, 1604),
  ...line('31,50 Bs', 787, 900, 1542, 1568),
  ...line('07:49 PM', 798, 900, 1578, 1602),
  ...line('Operacion pagomovil bdv', 117, 441, 1719, 1743),
  ...line('10.500,00 Bs', 729, 900, 1701, 1727),
  ...line('07:49 PM', 798, 900, 1737, 1761),
]

// Montos escritos en verde en la captura: abono recibido y el pagomovil de 10.000.
export const GREEN_AMOUNTS_Y = [906, 1383]
export const isGreen = (box: { y0: number }) => GREEN_AMOUNTS_Y.includes(box.y0)

// Historial de ordenes de Binance P2P (1170 px de ancho).
export const P2P_WORDS: OcrWord[] = [
  ...line('Historial de órdenes', 342, 828, 185, 235),
  ...line('Tienes mensajes sin leer', 150, 540, 555, 590),
  ...line('Vender USDT', 45, 333, 725, 770),
  ...line('Completado', 910, 1105, 733, 765),
  ...line('Importe', 45, 186, 818, 855),
  ...line('Bs26.600', 920, 1124, 815, 860),
  ...line('Precio', 45, 160, 896, 933),
  ...line('Bs1.006,513', 889, 1124, 896, 933),
  ...line('Cantidad total', 45, 300, 971, 1008),
  ...line('26,48 USDT', 902, 1124, 971, 1008),
  ...line('Orden', 45, 160, 1046, 1083),
  ...line('22941692196588679168', 591, 1064, 1046, 1083),
  ...line('Nelasurej 5', 76, 297, 1135, 1170),
  ...line('10-08 21:55:19', 877, 1124, 1135, 1170),
  ...line('Vender USDT', 45, 333, 1320, 1365),
  ...line('Completado', 910, 1105, 1328, 1360),
  ...line('Importe', 45, 186, 1437, 1475),
  ...line('Bs10.000', 920, 1124, 1435, 1480),
  ...line('Precio', 45, 160, 1516, 1553),
  ...line('Bs991,001', 925, 1124, 1516, 1553),
  ...line('Cantidad total', 45, 300, 1591, 1628),
  ...line('10,15 USDT', 902, 1124, 1591, 1628),
  ...line('Orden', 45, 160, 1666, 1703),
  ...line('22941660938720776192', 591, 1064, 1666, 1703),
  ...line('OikonomiaDigital 10', 76, 435, 1755, 1790),
  ...line('10-08 19:51:07', 877, 1124, 1755, 1790),
  ...line('Vender USDT', 45, 333, 1915, 1960),
  ...line('Completado', 910, 1105, 1923, 1955),
  ...line('Importe', 45, 186, 2009, 2045),
  ...line('Bs10.000', 920, 1124, 2007, 2052),
  ...line('Precio', 45, 160, 2085, 2122),
  ...line('Bs990,551', 925, 1124, 2085, 2122),
  ...line('Cantidad total', 45, 300, 2160, 2197),
  ...line('10,15 USDT', 902, 1124, 2160, 2197),
  ...line('Orden', 45, 160, 2235, 2272),
  ...line('22941660068861431808', 591, 1064, 2235, 2272),
]


// Una captura ya leida, como la devuelve el servicio de OCR: texto + palabras + color.
export function layoutOf(words: OcrWord[], width: number, isGreenAt: (box: OcrBox) => boolean | null = () => null) {
  const lines = new Map<number, string[]>()
  for (const segment of groupSegments(words, width)) {
    lines.set(segment.line, [...(lines.get(segment.line) ?? []), segment.text])
  }
  const text = [...lines.entries()].sort(([a], [b]) => a - b).map(([, parts]) => parts.join(' ')).join('\n')
  return { text, words, width, height: 2000, isGreen: isGreenAt }
}
