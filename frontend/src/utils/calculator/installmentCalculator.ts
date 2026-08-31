// Calculo de cuotas para planear una deuda ANTES de cargarla en Deudas (a
// diferencia de InstallmentSchedule.vue/debts, que solo MUESTRA cuotas ya
// creadas por el backend - esto es una simulacion puramente client-side, no
// pega a ningun endpoint).

export interface InstallmentPlanResult {
  installmentAmount: number
  totalPaid: number
  totalInterest: number
}

// Formula de amortizacion estandar (cuota fija, "sistema frances") cuando hay
// interes; division simple cuando no lo hay. annualInterestRatePercent=0 (o
// undefined) es un prestamo sin interes - caso valido y comun entre
// conocidos/familia, no un error.
export function calculateInstallmentPlan(
  principal: number,
  installmentCount: number,
  annualInterestRatePercent = 0,
): InstallmentPlanResult | null {
  if (!(principal > 0) || !Number.isFinite(installmentCount) || installmentCount < 1) return null

  const n = Math.round(installmentCount)

  if (!annualInterestRatePercent) {
    const installmentAmount = principal / n
    return { installmentAmount, totalPaid: principal, totalInterest: 0 }
  }

  const monthlyRate = annualInterestRatePercent / 100 / 12
  const factor = Math.pow(1 + monthlyRate, n)
  const installmentAmount = (principal * (monthlyRate * factor)) / (factor - 1)
  const totalPaid = installmentAmount * n

  return { installmentAmount, totalPaid, totalInterest: totalPaid - principal }
}
