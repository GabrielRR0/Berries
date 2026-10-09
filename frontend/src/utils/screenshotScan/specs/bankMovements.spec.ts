import { describe, expect, it } from 'vitest'
import { classifyDocument } from '../classifyDocument'
import { scanText } from '../scanText'

// Texto OCR de las capturas reales: Pago Movil BDV (gasto en Bs) y detalle de
// movimiento Facebank (debito en USD).
const BDV_PAGO_MOVIL = `Comprobante de operación
PagomóvilBDV
22.848,00 Bs
Fecha: 08/10/2026
Operación: 007608296806
Identificación: 28318932
Origen: 04123690558
Destino: 04221765498
Concepto: PagomóvilBDV`

const FACEBANK_DEBITO = `Detalle de movimiento
N.D. PAGO A TERCERO POR INTERNET
$ 100.00
Fecha 29/09/2026
Hora 19:52:00
No. de referencia 1043063494
Tipo de mov. Débito
Descripción NOTA DE DEBITO COMUN
Código de causa 146
Causa N.D. PAGO A TERCERO POR INTERNET
Reportar movimiento`

const BINANCE_METODO_PAGO_MOVIL = `Detalles de la orden
Vender USDT
Importe en fiat Bs26.600
Precio de USDT Bs1.006,513
Cantidad total 26,48 USDT
Método de pago Pago Movil VES`

describe('movimientos bancarios', () => {
  it('Pago Movil BDV: monto en Bs, fecha, operacion y concepto', () => {
    expect(classifyDocument(BDV_PAGO_MOVIL)).toBe('bdv_pago_movil')

    expect(scanText(BDV_PAGO_MOVIL)).toMatchObject({
      kind: 'bank_movement',
      bank: 'bdv',
      direction: 'debit',
      amount: 22848,
      currency: 'VEF',
      occurredOn: '2026-10-08',
      reference: '007608296806',
      description: 'PagomóvilBDV',
    })
  })

  it('Facebank: monto en USD, fecha, referencia, debito y causa', () => {
    expect(classifyDocument(FACEBANK_DEBITO)).toBe('facebank_movement')

    expect(scanText(FACEBANK_DEBITO)).toMatchObject({
      kind: 'bank_movement',
      bank: 'facebank',
      direction: 'debit',
      amount: 100,
      currency: 'USD',
      occurredOn: '2026-09-29',
      reference: '1043063494',
      description: 'N.D. PAGO A TERCERO POR INTERNET',
    })
  })

  it('Facebank: un credito se reconoce como ingreso', () => {
    expect(scanText(FACEBANK_DEBITO.replace('Débito', 'Crédito'))).toMatchObject({ direction: 'credit' })
  })

  it('el "Pago Movil" que Binance muestra como metodo de pago no se confunde con BDV', () => {
    expect(classifyDocument(BINANCE_METODO_PAGO_MOVIL)).toBe('binance_p2p')
  })

  it('si la captura no trae la fecha, queda vacia', () => {
    expect(scanText(BDV_PAGO_MOVIL.replace('Fecha: 08/10/2026\n', ''))).toMatchObject({
      kind: 'bank_movement',
      occurredOn: null,
    })
  })
})
