import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { CategoryBreakdown } from '../../../services/analytics/interfaces/analytics.interface'
import CategoryPieChart from '../CategoryPieChart.vue'

function swatchColors(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('.legend-swatch').map((swatch) => (swatch.element as HTMLElement).style.backgroundColor)
}

describe('CategoryPieChart', () => {
  it('con 6+ categorías, cada porción recibe un tono distinto - ninguna repite el color de otra', () => {
    const data: CategoryBreakdown[] = [
      { category: 'Renta', total: 500, percentage: 53.5 },
      { category: 'Mercado', total: 300, percentage: 32.1 },
      { category: 'Gasolina', total: 60, percentage: 6.4 },
      { category: 'Ocio', total: 40, percentage: 4.3 },
      { category: 'Streaming', total: 20, percentage: 2.1 },
      { category: 'Otros', total: 15, percentage: 1.6 },
    ]

    const wrapper = mount(CategoryPieChart, { props: { data } })

    const colors = swatchColors(wrapper)
    expect(colors).toHaveLength(6)
    expect(new Set(colors).size).toBe(6)
  })

  it('la categoria mas grande queda con el tono mas brillante, la mas chica con el mas tenue', () => {
    const data: CategoryBreakdown[] = [
      { category: 'Renta', total: 500, percentage: 80 },
      { category: 'Otros', total: 125, percentage: 20 },
    ]

    const wrapper = mount(CategoryPieChart, { props: { data } })

    const colors = swatchColors(wrapper)
    // jsdom normaliza rgba(...,1) a rgb(...) al leer el estilo computado.
    expect(colors[0]).toBe('rgb(246, 246, 247)')
    expect(colors[1]).toBe('rgba(246, 246, 247, 0.12)')
  })

  it('con una sola categoria no rompe (division por cero evitada) - queda al tono maximo', () => {
    const data: CategoryBreakdown[] = [{ category: 'Renta', total: 500, percentage: 100 }]

    const wrapper = mount(CategoryPieChart, { props: { data } })

    expect(swatchColors(wrapper)).toEqual(['rgb(246, 246, 247)'])
  })

  it('sin categorias muestra el estado vacío en vez de una lista/torta rota', () => {
    const wrapper = mount(CategoryPieChart, { props: { data: [] } })

    expect(wrapper.find('.category-empty').exists()).toBe(true)
    expect(wrapper.findAll('.legend-swatch')).toHaveLength(0)
  })
})
