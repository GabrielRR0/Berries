import type { Insight } from '../../services/analytics/interfaces/analytics.interface'
import { formatCurrency } from '../formatters/formatCurrency'
import { WEEKDAY_NAMES_MONDAY_FIRST } from './periods'

export interface InsightView {
  badge: string
  tone: 'alert' | 'warning' | 'good' | 'neutral'
  title: string
  body: string
}

const GOOD_NEWS = new Set(['projected_underspend', 'category_drop', 'on_track'])

// El backend manda el codigo de la regla y sus cifras; aca se arma el texto con la
// moneda del usuario.
export function describeInsight(insight: Insight, currency: string): InsightView {
  const money = (value: number | null) => formatCurrency(value ?? 0, currency)
  const percent = Math.round(Math.abs(insight.percent ?? 0))
  const category = insight.category ?? 'Esta categoría'
  const diff = (insight.amount ?? 0) - (insight.referenceAmount ?? 0)

  const tone: InsightView['tone'] =
    insight.level === 'alert' ? 'alert' : insight.level === 'warning' ? 'warning' : GOOD_NEWS.has(insight.code) ? 'good' : 'neutral'
  const badge = { alert: 'Alerta', warning: 'Atención', good: 'Buen dato', neutral: 'Info' }[tone]

  switch (insight.code) {
    case 'projected_overspend':
      return {
        badge,
        tone,
        title: 'Vas camino a cerrar sobre tu promedio',
        body: `A este ritmo terminarás el mes en unos ${money(insight.amount)}, ${percent}% más que tu promedio de 3 meses (${money(insight.referenceAmount)}).`,
      }
    case 'projected_underspend':
      return {
        badge,
        tone,
        title: 'Vas por debajo de tu ritmo habitual',
        body: `A este ritmo cerrarías en unos ${money(insight.amount)}, ${percent}% menos que tu promedio de 3 meses (${money(insight.referenceAmount)}). Buen momento para apartar la diferencia.`,
      }
    case 'category_spike':
      return {
        badge,
        tone,
        title: `${category} subió ${percent}%`,
        body: `Llevas ${money(insight.amount)} frente a ${money(insight.referenceAmount)} en el mismo tramo anterior (+${money(diff)}). Si lo igualas, te quedas con esa diferencia.`,
      }
    case 'weekend_heavy': {
      const day = insight.weekday === null ? null : WEEKDAY_NAMES_MONDAY_FIRST[insight.weekday]
      return {
        badge,
        tone,
        title: 'El fin de semana pesa mucho',
        body: `Sábado y domingo concentran ${percent}% de tu gasto${day ? `, y el ${day} es tu día más caro` : ''}. Planificar esos días ayuda a no pasarte.`,
      }
    }
    case 'negative_savings_last_month':
      return {
        badge,
        tone,
        title: 'El mes pasado gastaste más de lo que ingresó',
        body: `Cerró en ${money(insight.amount)}. Revisa en qué categorías se fue para que no se repita.`,
      }
    case 'category_drop':
      return {
        badge,
        tone,
        title: `${category} bajó ${percent}%`,
        body: `Gastaste ${money(insight.amount)} frente a ${money(insight.referenceAmount)} en el mismo tramo anterior. Vas mejor en esa categoría.`,
      }
    case 'on_track':
      return {
        badge,
        tone,
        title: 'Vas en línea con tu historial',
        body: 'No vemos nada fuera de lo normal en tu gasto de este mes. Sigue así.',
      }
    case 'not_enough_history':
      return {
        badge,
        tone,
        title: 'Aún faltan datos',
        body: 'Con unas semanas más de movimientos podremos compararte con tu propio historial y darte recomendaciones útiles.',
      }
    default:
      return { badge, tone, title: 'Recomendación', body: '' }
  }
}
