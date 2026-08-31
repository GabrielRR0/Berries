import type { GoalType } from '../../services/goals/interfaces/goals.interface'

export interface GoalTypeTemplate {
  type: GoalType
  label: string
  defaultTitle: string
}

// Plantillas del paso 1 del alta ("¿Cuál es tu objetivo?") - "custom" queda afuera
// a proposito, se maneja aparte en el grid (sin titulo por defecto, icono "+").
// "course" se saco de esta lista a pedido explicito del usuario (no del tipo
// GoalType en si - una meta ya creada con ese tipo sigue funcionando igual,
// ver GoalTypeIcon.vue). Orden mezclado a proposito (no agrupado por
// "compras grandes" vs "chicas" como antes) - tambien pedido explicito.
export const GOAL_TYPE_TEMPLATES: GoalTypeTemplate[] = [
  { type: 'phone', label: 'Comprar un teléfono', defaultTitle: 'Comprar un teléfono' },
  { type: 'business', label: 'Iniciar un negocio', defaultTitle: 'Iniciar un negocio' },
  { type: 'travel', label: 'Realizar un viaje', defaultTitle: 'Hacer un viaje' },
  { type: 'study', label: 'Pagar estudios', defaultTitle: 'Pagar mis estudios' },
  { type: 'computer', label: 'Comprar un computador', defaultTitle: 'Comprar un computador' },
  { type: 'housing', label: 'Comprar una vivienda', defaultTitle: 'Comprar una vivienda' },
  { type: 'vehicle', label: 'Comprar un vehículo', defaultTitle: 'Comprar un vehículo' },
]
