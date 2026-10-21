import { describe, expect, it } from 'vitest'
import { classifySwipe, resolveSwipeBack } from '../useLooseRouteSwipe'

describe('classifySwipe', () => {
  it('un arrastre horizontal largo cuenta, con el signo de la direccion del dedo', () => {
    expect(classifySwipe(120, 10, 400)).toBe(1)
    expect(classifySwipe(-120, 10, 400)).toBe(-1)
  })

  it('un arrastre corto y lento no cuenta', () => {
    expect(classifySwipe(30, 2, 600)).toBe(0)
  })

  it('un flick rapido corto si cuenta', () => {
    expect(classifySwipe(50, 3, 60)).toBe(1)
    expect(classifySwipe(-50, 3, 60)).toBe(-1)
  })

  it('un gesto mas vertical que horizontal es scroll, no deslizar de pagina', () => {
    expect(classifySwipe(100, 130, 300)).toBe(0)
    expect(classifySwipe(100, 200, 300)).toBe(0)
  })

  it('una diagonal leve (un pulgar que barre de costado) todavia cuenta, igual que en el paginador', () => {
    expect(classifySwipe(100, 90, 300)).toBe(1)
  })
})

describe('resolveSwipeBack', () => {
  it('vuelve a la pagina anterior del historial si es de la app', () => {
    expect(resolveSwipeBack('/ajustes')).toBe('back')
    expect(resolveSwipeBack('/metas')).toBe('back')
  })

  it('sin pagina anterior (se abrio directo) va a Inicio', () => {
    expect(resolveSwipeBack(null)).toBe('home')
    expect(resolveSwipeBack(undefined)).toBe('home')
    expect(resolveSwipeBack('')).toBe('home')
  })

  it('si la anterior era el login o el registro va a Inicio', () => {
    expect(resolveSwipeBack('/login')).toBe('home')
    expect(resolveSwipeBack('/register')).toBe('home')
    expect(resolveSwipeBack('/login?next=/metas')).toBe('home')
  })
})
