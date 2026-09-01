import { describe, expect, it } from 'vitest'
import { updatePageTransitionName, usePageTransitionName } from '../usePageTransition'

function route(name: string, path: string) {
  return { name, path }
}

describe('usePageTransition', () => {
  it('moverse a una seccion mas a la derecha desliza para adelante', () => {
    updatePageTransitionName(route('deudas', '/deudas'), route('dashboard', '/'))

    expect(usePageTransitionName().value).toBe('slide-left')
  })

  it('moverse a una seccion mas a la izquierda desliza para atras', () => {
    updatePageTransitionName(route('dashboard', '/'), route('deudas', '/deudas'))

    expect(usePageTransitionName().value).toBe('slide-right')
  })

  it('quedarse en la misma seccion no tiene direccion (fade)', () => {
    updatePageTransitionName(route('dashboard', '/'), route('dashboard', '/'))

    expect(usePageTransitionName().value).toBe('fade')
  })

  it('rutas fuera del orden conocido (login/register) usan fade', () => {
    updatePageTransitionName(route('login', '/login'), route('register', '/register'))

    expect(usePageTransitionName().value).toBe('fade')
  })

  // Metas/Categorias ya estan en el orden de secciones (agregadas junto con
  // esas pantallas) - mismo criterio que el resto.
  it('metas y categorias tambien participan del orden de secciones', () => {
    updatePageTransitionName(route('metas', '/metas'), route('dashboard', '/'))

    expect(usePageTransitionName().value).toBe('slide-left')
  })

  // Sub-rutas anidadas dentro de una misma seccion (ej. el alta/edicion de una
  // meta) no estan en SECTION_ORDER - el fallback por profundidad de path
  // cubre "entrar mas profundo desliza para adelante, salir desliza para atras".
  describe('fallback por profundidad de path (rutas anidadas fuera de SECTION_ORDER)', () => {
    it('entrar a una sub-ruta mas profunda desliza para adelante', () => {
      updatePageTransitionName(route('metas-nueva', '/metas/nueva'), route('metas', '/metas'))

      expect(usePageTransitionName().value).toBe('slide-left')
    })

    it('volver a la ruta padre desliza para atras', () => {
      updatePageTransitionName(route('metas', '/metas'), route('metas-nueva', '/metas/nueva'))

      expect(usePageTransitionName().value).toBe('slide-right')
    })

    it('una sub-ruta con mas segmentos todavia (editar) tambien desliza para adelante', () => {
      updatePageTransitionName(route('metas-editar', '/metas/goal-1/editar'), route('metas', '/metas'))

      expect(usePageTransitionName().value).toBe('slide-left')
    })

    it('misma profundidad entre secciones desconocidas usa fade', () => {
      updatePageTransitionName(route('foo', '/foo'), route('bar', '/bar'))

      expect(usePageTransitionName().value).toBe('fade')
    })
  })

  // Bug real reportado por el usuario: el gesto nativo de "volver" del
  // telefono (o el boton de atras del navegador) ya anima la pagina por su
  // cuenta - si nuestro <Transition> tambien la animaba desde cero quedaba
  // como si se arrastrara sola una segunda vez. popstate marca la bandera
  // que hace que la proxima navegacion no repita esa animacion.
  describe('navegacion via popstate (gesto nativo de volver / boton atras)', () => {
    it('la navegacion que sigue a un popstate no repite la animacion (none)', () => {
      window.dispatchEvent(new PopStateEvent('popstate'))

      updatePageTransitionName(route('dashboard', '/'), route('deudas', '/deudas'))

      expect(usePageTransitionName().value).toBe('none')
    })

    it('la bandera se consume - la navegacion siguiente vuelve a animar normal', () => {
      window.dispatchEvent(new PopStateEvent('popstate'))
      updatePageTransitionName(route('dashboard', '/'), route('deudas', '/deudas'))

      updatePageTransitionName(route('deudas', '/deudas'), route('dashboard', '/'))

      expect(usePageTransitionName().value).toBe('slide-left')
    })
  })
})
