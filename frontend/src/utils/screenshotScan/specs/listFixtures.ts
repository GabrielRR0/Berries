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


// "Movimientos" con dos dias (HOY y AYER). Hoy es el 9 de octubre de 2026.
export const BANK_HOY_AYER_WORDS: OcrWord[] = [
  ...line('Movimientos', 172, 472, 155, 200),
  ...line('HOY', 30, 88, 513, 538),
  ...line('Cobro comision pag movil', 117, 443, 588, 612),
  ...line('bdv a bdv', 117, 241, 626, 650),
  ...line('14,00 Bs', 787, 900, 588, 614),
  ...line('11:25 AM', 798, 900, 624, 648),
  ...line('Operacion pagomovil bdv', 117, 441, 765, 790),
  ...line('1.200,00 Bs', 747, 900, 747, 773),
  ...line('11:25 AM', 798, 900, 783, 807),
  ...line('AYER', 30, 100, 893, 918),
  ...line('Cobro comision pag movil', 117, 443, 967, 991),
  ...line('bdv a bdv', 117, 241, 1005, 1029),
  ...line('68,54 Bs', 787, 900, 967, 993),
  ...line('10:25 PM', 798, 900, 1003, 1027),
  ...line('Operacion pagomovil bdv', 117, 441, 1144, 1168),
  ...line('22.848,00 Bs', 729, 900, 1126, 1152),
  ...line('10:25 PM', 798, 900, 1162, 1186),
  ...line('Abono recibido otr bcos', 117, 417, 1303, 1327),
  ...line('26.600,00 Bs', 729, 900, 1285, 1311),
  ...line('09:58 PM', 798, 900, 1321, 1345),
]
export const BANK_HOY_AYER_GREEN_Y = [1285]

// "Movimientos" con el encabezado "MIERCOLES, 7 DE OCTUBRE" (dia de la semana + fecha escrita).
export const BANK_WEEKDAY_WORDS: OcrWord[] = [
  ...line('Movimientos', 172, 472, 155, 200),
  ...line('MIERCOLES, 7 DE OCTUBRE', 30, 400, 503, 530),
  ...line('Cobro comision pag movil', 117, 443, 577, 601),
  ...line('bdv a bdv', 117, 241, 615, 639),
  ...line('21,00 Bs', 787, 900, 577, 603),
  ...line('07:57 PM', 798, 900, 613, 637),
  ...line('Operacion pagomovil bdv', 117, 441, 755, 779),
  ...line('7.000,00 Bs', 745, 900, 737, 763),
  ...line('07:57 PM', 798, 900, 773, 797),
  ...line('Cobro comision pag movil', 117, 443, 895, 919),
  ...line('bdv a bdv', 117, 241, 933, 957),
  ...line('60,00 Bs', 787, 900, 895, 921),
  ...line('07:44 PM', 798, 900, 931, 955),
  ...line('Operacion pagomovil bdv', 117, 441, 1073, 1097),
  ...line('20.000,00 Bs', 729, 900, 1055, 1081),
  ...line('07:44 PM', 798, 900, 1091, 1115),
  ...line('Operacion pagomovil bdv', 117, 441, 1232, 1256),
  ...line('20.039,90 Bs', 729, 900, 1214, 1240),
  ...line('07:39 PM', 798, 900, 1250, 1274),
  ...line('Cobro comision pag movil', 117, 443, 1372, 1396),
  ...line('bdv a bdv', 117, 241, 1410, 1434),
  ...line('120,00 Bs', 770, 900, 1372, 1398),
  ...line('07:26 PM', 798, 900, 1408, 1432),
  ...line('Operacion pagomovil bdv', 117, 441, 1549, 1573),
  ...line('40.000,00 Bs', 729, 900, 1531, 1557),
  ...line('07:26 PM', 798, 900, 1567, 1591),
  ...line('Abono recibido otr bcos', 117, 417, 1708, 1732),
  ...line('40.107,74 Bs', 729, 900, 1690, 1716),
  ...line('07:22 PM', 798, 900, 1726, 1750),
]
export const BANK_WEEKDAY_GREEN_Y = [1214, 1690]

// "Historico de operaciones" del inicio de la app (924 px): sin colores ni flechas, con el saldo
// de la cuenta arriba ("Bs. 3.848,10") que NO es un movimiento.
export const BANK_HISTORICO_WORDS: OcrWord[] = [
  ...line('Inicio', 172, 298, 155, 200),
  ...line('Saldo Cuenta Corriente', 87, 382, 318, 346),
  ...line('Bs. 3.848,10', 87, 288, 378, 414),
  ...line('0102****4075', 87, 273, 443, 471),
  ...line('Movimientos en línea', 532, 800, 443, 471),
  ...line('Accesos Directos', 37, 252, 650, 676),
  ...line('Histórico de operaciones', 24, 388, 938, 972),
  ...line('Actualizar', 746, 900, 938, 972),
  ...line('MIERCOLES, 7 DE OCTUBRE', 24, 396, 1038, 1066),
  ...line('PagomóvilBDV', 112, 304, 1119, 1151),
  ...line('7.000,00 Bs', 741, 896, 1103, 1133),
  ...line('07:57 PM', 793, 896, 1141, 1165),
  ...line('PagomóvilBDV', 112, 304, 1259, 1291),
  ...line('20.000,00 Bs', 724, 896, 1243, 1273),
  ...line('07:44 PM', 793, 896, 1281, 1305),
  ...line('PagomóvilBDV', 112, 304, 1399, 1431),
  ...line('40.000,00 Bs', 724, 896, 1383, 1413),
  ...line('07:26 PM', 793, 896, 1421, 1445),
  ...line('PagomóvilBDV', 112, 304, 1539, 1571),
  ...line('1.100,00 Bs', 741, 896, 1523, 1553),
  ...line('06:43 PM', 793, 896, 1561, 1585),
  ...line('Pago de Servicios', 112, 336, 1688, 1720),
  ...line('500,00 Bs', 765, 896, 1672, 1702),
  ...line('06:32 PM', 793, 896, 1710, 1734),
  ...line('Inicio Transfer... Pagos Servicios Divisas Tarjeta', 40, 890, 1865, 1900),
]

// "Movimientos" con DOS dias con filas y un TERCER encabezado ("VIERNES, 2 DE OCTUBRE") al final sin
// ninguna fila visible debajo: no genera nada. Lunes 5 y sabado 3 de octubre de 2026.
export const BANK_TWO_DATES_WORDS: OcrWord[] = [
  ...line('Movimientos', 172, 472, 155, 200),
  ...line('LUNES, 5 DE OCTUBRE', 30, 335, 527, 553),
  ...line('Cobro comision pag movil', 117, 443, 601, 625),
  ...line('bdv a bdv', 117, 241, 639, 663),
  ...line('21,00 Bs', 787, 900, 601, 627),
  ...line('03:04 PM', 798, 900, 637, 661),
  ...line('Operacion pagomovil bdv', 117, 441, 779, 803),
  ...line('7.000,00 Bs', 745, 900, 761, 787),
  ...line('03:04 PM', 798, 900, 797, 821),
  ...line('Operacion pagomovil bdv', 117, 441, 937, 961),
  ...line('10.000,00 Bs', 729, 900, 919, 945),
  ...line('03:03 PM', 798, 900, 955, 979),
  ...line('Operacion pagomovil bdv', 117, 441, 1096, 1120),
  ...line('8.000,00 Bs', 745, 900, 1078, 1104),
  ...line('02:59 PM', 798, 900, 1114, 1138),
  ...line('SABADO, 3 DE OCTUBRE', 30, 365, 1223, 1249),
  ...line('Cobro comision pag movil', 117, 443, 1298, 1322),
  ...line('bdv a bdv', 117, 241, 1336, 1360),
  ...line('57,00 Bs', 787, 900, 1298, 1324),
  ...line('07:38 PM', 798, 900, 1334, 1358),
  ...line('Operacion pagomovil bdv', 117, 441, 1476, 1500),
  ...line('19.000,00 Bs', 729, 900, 1458, 1484),
  ...line('07:38 PM', 798, 900, 1494, 1518),
  ...line('Abono recibido otr bcos', 117, 417, 1635, 1659),
  ...line('20.000,00 Bs', 729, 900, 1617, 1643),
  ...line('07:25 PM', 798, 900, 1653, 1677),
  ...line('VIERNES, 2 DE OCTUBRE', 30, 362, 1762, 1788),
]
// Montos en verde (recibidos): 10.000, 8.000 y 20.000.
export const BANK_TWO_DATES_GREEN_Y = [919, 1078, 1617]

// Estado de cuenta en TABLA ("BDVenlinea personas", 1918 px de ancho): una fila por movimiento con las
// columnas Fecha, Referencia, Descripcion, Debito / Credito, Monto y Saldo. De lo mas nuevo a lo mas viejo.
interface StatementRowData {
  y: number
  date: string
  time: string
  ref: string
  desc: string[]
  dc: 'DEBITO' | 'CREDITO'
  amount: string
  balance: string
}

export const STATEMENT_ROWS: StatementRowData[] = [
  { y: 144, date: '20-09-2026', time: '19:58', ref: '0677241403397', desc: ['OPERACION', 'PAGOMOVIL BDV'], dc: 'CREDITO', amount: '16.000,00', balance: '51.957,86' },
  { y: 203, date: '20-09-2026', time: '19:52', ref: '0677208897420', desc: ['OPERACION', 'PAGOMOVIL BDV'], dc: 'CREDITO', amount: '20.000,00', balance: '35.957,86' },
  { y: 262, date: '20-09-2026', time: '19:45', ref: '0677208813375', desc: ['OPERACION', 'PAGOMOVIL BDV'], dc: 'CREDITO', amount: '10.000,00', balance: '15.957,86' },
  { y: 321, date: '18-09-2026', time: '19:48', ref: '0210086173620', desc: ['COBRO COMISION PAG', 'MOVIL BDV A BDV'], dc: 'DEBITO', amount: '-15,30', balance: '5.957,86' },
  { y: 380, date: '18-09-2026', time: '19:48', ref: '0677286173620', desc: ['OPERACION', 'PAGOMOVIL BDV'], dc: 'DEBITO', amount: '-5.100,00', balance: '5.973,16' },
  { y: 439, date: '18-09-2026', time: '18:51', ref: '0210085322989', desc: ['COBRO COMISION PAG', 'MOVIL BDV A BDV'], dc: 'DEBITO', amount: '-14,00', balance: '11.073,16' },
  { y: 498, date: '18-09-2026', time: '18:51', ref: '0677285322989', desc: ['OPERACION', 'PAGOMOVIL BDV'], dc: 'DEBITO', amount: '-500,00', balance: '11.087,16' },
  { y: 557, date: '18-09-2026', time: '09:56', ref: '0027277649985', desc: ['COMISION', 'PAGOMOVILBDV'], dc: 'DEBITO', amount: '-14,00', balance: '11.587,16' },
  { y: 625, date: '18-09-2026', time: '09:56', ref: '0050377649985', desc: ['OPERACION', 'PAGOMOVILBDV', 'OTROS BANCO'], dc: 'DEBITO', amount: '-2.500,00', balance: '11.601,16' },
  { y: 694, date: '17-09-2026', time: '20:53', ref: '0210074279899', desc: ['COBRO COMISION PAG', 'MOVIL BDV A BDV'], dc: 'DEBITO', amount: '-14,55', balance: '14.101,16' },
  { y: 753, date: '17-09-2026', time: '20:53', ref: '0677274279899', desc: ['OPERACION', 'PAGOMOVIL BDV'], dc: 'DEBITO', amount: '-4.850,00', balance: '14.115,71' },
  { y: 812, date: '17-09-2026', time: '19:53', ref: '0677273495969', desc: ['OPERACION', 'PAGOMOVIL BDV'], dc: 'CREDITO', amount: '6.000,00', balance: '18.965,71' },
  { y: 871, date: '16-09-2026', time: '20:26', ref: '0677260573326', desc: ['OPERACION', 'PAGOMOVIL BDV'], dc: 'CREDITO', amount: '12.697,70', balance: '12.965,71' },
]

const STATEMENT_HEADER_WORDS: OcrWord[] = [
  ...line('Fecha', 485, 517, 82, 98),
  ...line('Referencia', 642, 699, 82, 98),
  ...line('Descripción', 800, 862, 82, 98),
  ...line('Débito / Crédito', 957, 1043, 82, 98),
  ...line('Monto', 1115, 1150, 82, 98),
  ...line('Saldo', 1273, 1304, 82, 98),
]

export function statementWords(rows: StatementRowData[] = STATEMENT_ROWS): OcrWord[] {
  const words: OcrWord[] = [...STATEMENT_HEADER_WORDS]
  for (const row of rows) {
    const top = row.y - 8
    const bottom = row.y + 8
    words.push(...line(row.date, 485, 566, top, bottom), ...line('-', 572, 578, top, bottom), ...line(row.time, 584, 614, top, bottom))
    words.push(...line(row.ref, 642, 751, top, bottom))
    // Cada linea de la descripcion; las de varias lineas se reparten alrededor del centro de la fila.
    const offsets = row.desc.length === 1 ? [0] : row.desc.length === 2 ? [-10, 9] : [-19, 0, 19]
    row.desc.forEach((text, index) => {
      words.push(...line(text, 800, 800 + text.length * 8.2, row.y + offsets[index]! - 8, row.y + offsets[index]! + 8))
    })
    words.push(...line(row.dc, 957, 1017, top, bottom))
    words.push(...line(row.amount, 1115, 1115 + row.amount.length * 8, top, bottom))
    words.push(...line(row.balance, 1273, 1273 + row.balance.length * 8, top, bottom))
  }
  return words
}

export const BANK_STATEMENT_WORDS: OcrWord[] = statementWords()

// Otros estados de cuenta en tabla, para comprobar que el lector no depende de los titulos exactos de BDV.
// Cada columna es [titulo, x del inicio]; cada fila es la lista de celdas en el mismo orden.
export function genericTableWords(
  columns: [string, number][],
  rows: { y: number; cells: (string | string[])[] }[],
  extraHeaderWords: OcrWord[] = [],
): OcrWord[] {
  const words: OcrWord[] = [...extraHeaderWords]
  for (const [title, x] of columns) words.push(...line(title, x, x + title.length * 8, 82, 98))
  for (const row of rows) {
    row.cells.forEach((cell, index) => {
      const x = columns[index]![1]
      const lines = Array.isArray(cell) ? cell : [cell]
      const offsets = lines.length === 1 ? [0] : lines.length === 2 ? [-10, 9] : [-19, 0, 19]
      lines.forEach((text, lineIndex) => {
        if (text === '') return
        words.push(...line(text, x, x + text.length * 8, row.y + offsets[lineIndex]! - 8, row.y + offsets[lineIndex]! + 8))
      })
    })
  }
  return words
}

// Una captura ya leida, como la devuelve el servicio de OCR: texto + palabras + color.
export function layoutOf(words: OcrWord[], width: number, isGreenAt: (box: OcrBox) => boolean | null = () => null) {
  const lines = new Map<number, string[]>()
  for (const segment of groupSegments(words, width)) {
    lines.set(segment.line, [...(lines.get(segment.line) ?? []), segment.text])
  }
  const text = [...lines.entries()].sort(([a], [b]) => a - b).map(([, parts]) => parts.join(' ')).join('\n')
  return { text, words, width, height: 2000, isGreen: isGreenAt }
}
