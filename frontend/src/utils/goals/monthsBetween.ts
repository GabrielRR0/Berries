// Espejo TS de contribution_calculator._months_between (backend) - usado en
// CreateGoalForm.vue para previsualizar en vivo "monto mensual x meses =
// total" mientras el usuario tipea, sin pegarle al backend en cada tecla.
// Misma logica: diferencia de meses de CALENDARIO (Y*12+M), sin precision de
// dia, minimo 1.
export function monthsBetween(today: Date, targetDate: Date): number {
  const months = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth())
  return Math.max(months, 1)
}
