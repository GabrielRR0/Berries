// Agrupado en vivo mientras se escribe un monto (pedido explicito del usuario:
// "1300" se ve feo sin separador, deberia verse "1,300") - misma convencion de
// coma que ya usa formatCurrency.ts para USD en el resto de la app (resumen de
// la meta, tarjetas, etc.), asi el monto se ve igual mientras se escribe que
// despues de guardado. Solo agrupa la parte ENTERA - la parte decimal (y un
// punto final sin digitos despues, mientras el usuario todavia lo esta
// escribiendo) queda tal cual, sin tocar.
export function groupAmountThousands(raw: string): string {
  if (!raw) return raw
  const [integerPart, ...rest] = raw.split('.')
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimalPart = rest.length > 0 ? `.${rest.join('')}` : ''
  return `${groupedInteger}${decimalPart}`
}

// Inversa: le saca las comas de agrupamiento (y cualquier otro caracter que no
// sea digito o punto) a lo que el usuario ve/escribe, para volver al string
// numerico "crudo" que el resto del componente usa para calcular. Conserva
// como mucho un punto decimal (el primero que aparece).
export function ungroupAmountThousands(display: string): string {
  const cleaned = display.replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
}
