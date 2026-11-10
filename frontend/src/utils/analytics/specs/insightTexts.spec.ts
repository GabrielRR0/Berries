import { describe, expect, it } from 'vitest'
import type { Insight } from '../../../services/analytics/interfaces/analytics.interface'
import { describeInsight } from '../insightTexts'

function insight(overrides: Partial<Insight>): Insight {
  return {
    code: 'on_track',
    level: 'info',
    category: null,
    amount: null,
    referenceAmount: null,
    percent: null,
    weekday: null,
    ...overrides,
  }
}

describe('describeInsight', () => {
  it('una alerta de proyeccion nombra las cifras y se marca como alerta', () => {
    const view = describeInsight(
      insight({ code: 'projected_overspend', level: 'alert', amount: 1777, referenceAmount: 1502, percent: 18.3 }),
      'USD',
    )

    expect(view.tone).toBe('alert')
    expect(view.badge).toBe('Alerta')
    expect(view.body).toContain('18%')
    expect(view.body).toContain('1,777.00')
  })

  it('una categoria que sube muestra la diferencia', () => {
    const view = describeInsight(
      insight({ code: 'category_spike', level: 'warning', category: 'Restaurantes', amount: 128, referenceAmount: 61, percent: 109.8 }),
      'USD',
    )

    expect(view.title).toBe('Restaurantes subió 110%')
    expect(view.body).toContain('+$67.00')
  })

  it('el fin de semana nombra el dia mas caro', () => {
    const view = describeInsight(insight({ code: 'weekend_heavy', level: 'warning', percent: 47, weekday: 5 }), 'USD')

    expect(view.body).toContain('sábado')
  })

  it('las buenas noticias salen como "Buen dato"', () => {
    expect(describeInsight(insight({ code: 'on_track' }), 'USD').badge).toBe('Buen dato')
    expect(describeInsight(insight({ code: 'category_drop', category: 'Transporte', percent: -9 }), 'USD').tone).toBe('good')
  })

  it('la falta de historial es informativa, no una buena noticia', () => {
    expect(describeInsight(insight({ code: 'not_enough_history' }), 'USD').badge).toBe('Info')
  })
})
