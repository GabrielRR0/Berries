// Valores de <input type="date"> y <input type="time"> en hora LOCAL del usuario. Un
// toISOString().slice(...) crudo es UTC y puede quedar en el dia (u hora) equivocado
// segun el huso horario.
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

// "2026-11-09"
export function localDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// "14:05"
export function localTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
