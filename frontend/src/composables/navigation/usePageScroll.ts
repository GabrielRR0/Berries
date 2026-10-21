// Memoria de scroll por ruta (pedido explicito del usuario: si te quedaste
// leyendo mas abajo en Movimientos y volves despues de visitar otra seccion,
// tiene que mantenerse donde lo dejaste). Vive en un Map a nivel de modulo,
// no en sessionStorage: solo necesita sobrevivir mientras dura la pestaña
// abierta, igual que el resto del estado en memoria de la app (Pinia).
const scrollPositions = new Map<string, number>()

export function saveScrollPosition(path: string): void {
  scrollPositions.set(path, window.scrollY)
}

export function hasScrollPosition(path: string): boolean {
  return scrollPositions.has(path)
}

// Por que no alcanza con un window.scrollTo() una sola vez al entrar: el
// contenido de la pantalla suele llegar de forma async (fetchTransactions(),
// etc.) y el alto real de la pagina sigue cambiando un momento despues del
// mount. Aplicar el scroll antes de que ese contenido termine de entrar hace
// que el navegador lo recorte al maximo scrolleable de ESE instante - recien
// cuando el contenido termina de cargar (tipicamente ~1s despues) el alto
// crece y el scroll "brinca" de golpe al valor real. ResizeObserver reaplica
// la posicion cada vez que el alto del documento cambia, durante una ventana
// acotada que se corta sola 400ms despues del ultimo resize (contenido ya
// asentado) o a los 3s como tope, lo que pase primero. Si el usuario arranca
// a scrollear/tocar la pantalla por su cuenta durante esa ventana, se cancela
// al toque para no pelearle el gesto.
//
// Bug real encontrado probando esto: si se navega de nuevo ANTES de que la
// restauracion anterior se haya terminado de asentar (ej. Movimientos ->
// Inicio -> Movimientos en menos de 3s), su ResizeObserver seguia vivo
// escuchando resizes de document.body - que es UNO SOLO, compartido por toda
// la SPA - y de golpe volvia a aplicar SU propio target viejo por encima del
// de la restauracion nueva, dejando el scroll en cualquier valor intermedio
// segun quien ganara la carrera. Solo puede haber una restauracion viva a la
// vez: la siguiente cancela a la anterior apenas arranca.
let cancelActive: (() => void) | null = null

export function restoreScrollPosition(path: string): void {
  cancelActive?.()
  cancelActive = null

  const target = scrollPositions.get(path)
  if (target === undefined) return

  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const maxTimer = setTimeout(stop, 3000)

  const observer = new ResizeObserver(apply)

  function stop() {
    observer.disconnect()
    clearTimeout(settleTimer)
    clearTimeout(maxTimer)
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchstart', stop)
    if (cancelActive === stop) cancelActive = null
  }

  function apply() {
    window.scrollTo(0, target as number)
    clearTimeout(settleTimer)
    settleTimer = setTimeout(stop, 400)
  }

  observer.observe(document.body)
  window.addEventListener('wheel', stop, { passive: true })
  window.addEventListener('touchstart', stop, { passive: true })
  cancelActive = stop

  apply()
}
