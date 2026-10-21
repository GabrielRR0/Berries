// Una sola lectura de la preferencia del sistema para todas las animaciones
// de Motion de esta carpeta (el CSS ya la respeta por su cuenta, ver
// style.css): quien pide menos movimiento ve el estado final al instante.
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}
