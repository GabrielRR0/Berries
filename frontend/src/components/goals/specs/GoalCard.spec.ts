import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Goal, SavingsCapacity } from '../../../services/goals/interfaces/goals.interface'
import GoalCard from '../GoalCard.vue'

const GOAL: Goal = {
  id: 'goal-1',
  userId: 'user-1',
  title: 'TV',
  targetAmount: 240,
  currency: 'USD',
  targetDate: '2026-11-28',
  totalSaved: 80,
  status: 'active',
  goalType: 'computer',
  createdAt: '2026-08-01T00:00:00Z',
  completedAt: null,
  suggestedMonthlyContribution: 53.33,
  lastCheckInPostponed: false,
}

// El menu de acciones se teletransporta a <body> (ver GoalCard.vue - escapa el
// contexto de apilamiento que crea el backdrop-filter de BaseCard). attachTo:
// document.body monta la card en el DOM real (necesario para que el click-
// afuera-cierra funcione, ya que ese listener escucha sobre document real) -
// ademas hay que limpiar cada wrapper despues para no dejar dropdowns huerfanos
// pegados al body real entre tests.
const mountedWrappers: ReturnType<typeof mount>[] = []
function mountCard(props: { goal: Goal; savingsCapacity?: SavingsCapacity | null }) {
  const wrapper = mount(GoalCard, { props, attachTo: document.body })
  mountedWrappers.push(wrapper)
  return wrapper
}

// El menu se teletransporta a <body> (Teleport) - wrapper.find() solo busca
// dentro de la raiz del componente montado, que ya no incluye ese contenido una
// vez teletransportado. new DOMWrapper(document.body) consulta el DOM real
// directo, que es la forma que recomienda Vue Test Utils para esto.
function menuDropdown() {
  return new DOMWrapper(document.body).find('.goal-menu-dropdown')
}
function menuItems() {
  return new DOMWrapper(document.body).findAll('.goal-menu-item')
}

async function openMenu(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.goal-menu-trigger').trigger('click')
}

async function clickMenuItem(wrapper: ReturnType<typeof mount>, label: string) {
  await openMenu(wrapper)
  await menuItems().find((item) => item.text() === label)!.trigger('click')
}

describe('GoalCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.setItem('berry_auth_token', 'jwt-token')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      }),
    )
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('muestra el titulo y el aporte sugerido', () => {
    const wrapper = mountCard({ goal: GOAL })

    expect(wrapper.text()).toContain('TV')
    expect(wrapper.text()).toContain('Aporte sugerido')
  })

  it('calcula el porcentaje de progreso segun reunido/objetivo', () => {
    const wrapper = mountCard({ goal: GOAL })

    expect(wrapper.find('.goal-ring-percent').text()).toBe('33%')
  })

  it('no supera el 100% aunque lo reunido exceda el objetivo', () => {
    const wrapper = mountCard({ goal: { ...GOAL, totalSaved: 500 } })

    expect(wrapper.find('.goal-ring-percent').text()).toBe('100%')
  })

  it('muestra el icono correspondiente al tipo de meta', () => {
    const wrapper = mountCard({ goal: GOAL })

    expect(wrapper.find('.goal-ring-icon').exists()).toBe(true)
  })

  it('muestra la nota de posposicion solo si el ultimo check-in pospuso', () => {
    const wrapper = mountCard({ goal: { ...GOAL, lastCheckInPostponed: true } })

    expect(wrapper.find('.goal-postponed-note').exists()).toBe(true)
    expect(wrapper.text()).toContain('seguimos reuniendo')
  })

  it('no muestra la nota de posposicion cuando no aplica', () => {
    const wrapper = mountCard({ goal: GOAL })

    expect(wrapper.find('.goal-postponed-note').exists()).toBe(false)
  })

  it('muestra la insignia "Meta cumplida" cuando esta completada', () => {
    const wrapper = mountCard({ goal: { ...GOAL, status: 'completed' } })

    expect(wrapper.text()).toContain('Meta cumplida')
  })

  it('muestra la insignia "Abandonada" cuando fue abandonada', () => {
    const wrapper = mountCard({ goal: { ...GOAL, status: 'abandoned' } })

    expect(wrapper.text()).toContain('Abandonada')
  })

  describe('menu de acciones', () => {
    it('el menu esta cerrado por defecto', () => {
      mountCard({ goal: GOAL })

      expect(menuDropdown().exists()).toBe(false)
    })

    it('abre y cierra al tocar el boton de tres puntos', async () => {
      const wrapper = mountCard({ goal: GOAL })

      await openMenu(wrapper)
      expect(menuDropdown().exists()).toBe(true)

      await openMenu(wrapper)
      expect(menuDropdown().exists()).toBe(false)
    })

    it('un click afuera del menu lo cierra', async () => {
      const wrapper = mountCard({ goal: GOAL })
      await openMenu(wrapper)
      expect(menuDropdown().exists()).toBe(true)

      document.body.click()
      await wrapper.vm.$nextTick()

      expect(menuDropdown().exists()).toBe(false)
    })

    it('meta activa: ofrece agregar aporte, ver historial, editar y abandonar', async () => {
      const wrapper = mountCard({ goal: GOAL })

      await openMenu(wrapper)
      const labels = menuItems().map((item) => item.text())

      expect(labels).toEqual(['+ Agregar aporte', 'Ver historial', 'Editar', 'Abandonar', 'Eliminar'])
    })

    it('meta no activa: solo ofrece ver historial y eliminar', async () => {
      const wrapper = mountCard({ goal: { ...GOAL, status: 'completed' } })

      await openMenu(wrapper)
      const labels = menuItems().map((item) => item.text())

      expect(labels).toEqual(['Ver historial', 'Eliminar'])
    })
  })

  it('agregar aporte desde el menu revela el formulario y emite "addContribution"', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, '+ Agregar aporte')
    expect(wrapper.find('.goal-add-contribution-form').exists()).toBe(true)

    await wrapper.find('.goal-add-contribution-form input').setValue('50')
    await wrapper.find('.goal-add-contribution-form').trigger('submit')

    expect(wrapper.emitted('addContribution')).toEqual([[50]])
  })

  it('no emite "addContribution" con un monto invalido', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, '+ Agregar aporte')
    await wrapper.find('.goal-add-contribution-form input').setValue('0')
    await wrapper.find('.goal-add-contribution-form').trigger('submit')

    expect(wrapper.emitted('addContribution')).toBeFalsy()
  })

  // Idea de la sesion de brainstorm de UI: "Abandonar" ahora pide
  // confirmacion en 2 pasos, igual que "Eliminar" - antes disparaba el
  // evento directo desde el menu sin ningun paso intermedio.
  it('abandonar desde el menu pide confirmacion primero, sin emitir "abandon"', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, 'Abandonar')

    expect(wrapper.emitted('abandon')).toBeFalsy()
    expect(wrapper.find('.goal-confirm-text').text()).toBe('¿Abandonar meta?')
  })

  it('emite "abandon" solo despues de confirmar', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, 'Abandonar')
    await wrapper.find('.goal-confirm-delete').trigger('click')

    expect(wrapper.emitted('abandon')).toBeTruthy()
  })

  it('cancelar el abandono no emite "abandon"', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, 'Abandonar')
    await wrapper.find('.goal-confirm-cancel').trigger('click')

    expect(wrapper.find('.goal-confirm').exists()).toBe(false)
    expect(wrapper.emitted('abandon')).toBeFalsy()
  })

  it('emite "edit" al elegir Editar desde el menu', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, 'Editar')

    expect(wrapper.emitted('edit')).toBeTruthy()
  })

  it('eliminar desde el menu pide confirmacion primero, sin emitir "remove"', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, 'Eliminar')

    expect(wrapper.emitted('remove')).toBeFalsy()
    expect(wrapper.find('.goal-confirm-text').text()).toBe('¿Eliminar meta?')
  })

  it('emite "remove" solo despues de confirmar', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, 'Eliminar')
    await wrapper.find('.goal-confirm-delete').trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
  })

  it('cancelar vuelve a cerrar el confirm sin emitir "remove"', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, 'Eliminar')
    await wrapper.find('.goal-confirm-cancel').trigger('click')

    expect(wrapper.find('.goal-confirm').exists()).toBe(false)
    expect(wrapper.emitted('remove')).toBeFalsy()
  })

  it('el historial esta oculto hasta que se pide desde el menu, y carga perezosamente al abrirlo', async () => {
    const wrapper = mountCard({ goal: GOAL })

    expect(wrapper.find('.check-in-history').exists()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()

    await clickMenuItem(wrapper, 'Ver historial')
    await flushPromises()

    expect(wrapper.find('.check-in-history').exists()).toBe(true)
    expect(fetch).toHaveBeenCalled()
  })

  it('vuelve a ocultar el historial al elegir la opcion de nuevo', async () => {
    const wrapper = mountCard({ goal: GOAL })

    await clickMenuItem(wrapper, 'Ver historial')
    await clickMenuItem(wrapper, 'Ocultar historial')

    expect(wrapper.find('.check-in-history').exists()).toBe(false)
  })

  it('avisa cuando el aporte sugerido supera el disponible promedio', () => {
    const capacity: SavingsCapacity = { avgMonthlyIncome: 500, avgMonthlyExpense: 470, avgMonthlyAvailable: 30, hasEnoughHistory: true }
    const wrapper = mountCard({ goal: GOAL, savingsCapacity: capacity })

    expect(wrapper.find('.goal-capacity-warning').exists()).toBe(true)
    expect(wrapper.text()).toContain('Supera tu disponible promedio')
  })

  it('no avisa cuando el aporte sugerido entra en el disponible promedio', () => {
    const capacity: SavingsCapacity = { avgMonthlyIncome: 900, avgMonthlyExpense: 200, avgMonthlyAvailable: 700, hasEnoughHistory: true }
    const wrapper = mountCard({ goal: GOAL, savingsCapacity: capacity })

    expect(wrapper.find('.goal-capacity-warning').exists()).toBe(false)
  })

  // Pedido explicito del usuario: una cuenta nueva (el mes en curso todavia no
  // termino) no tiene un "promedio" real todavia - no avisar nada con eso, aunque
  // el numero de ese unico mes parcial superaria el aporte sugerido.
  it('no avisa aunque el aporte sugerido "supere" el disponible, si la cuenta no tiene suficiente historial', () => {
    const capacity: SavingsCapacity = { avgMonthlyIncome: 0, avgMonthlyExpense: 5510.01, avgMonthlyAvailable: -5510.01, hasEnoughHistory: false }
    const wrapper = mountCard({ goal: GOAL, savingsCapacity: capacity })

    expect(wrapper.find('.goal-capacity-warning').exists()).toBe(false)
  })
})
