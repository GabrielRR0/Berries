import { ref } from 'vue'
import { localDateInputValue, localTimeInputValue } from '../../utils/formatters/dateInputs'

// Fecha Y hora de un movimiento/transferencia (TransactionForm.vue, TransferForm.vue):
// dos inputs (date + time) que arrancan en la fecha/hora PROPIAS del registro al editar,
// o en "ahora" al crear. Antes solo habia fecha y al guardar se le ponia la hora actual,
// asi que editar un movimiento le cambiaba la hora sin avisar.
//
// Los segundos se conservan del valor inicial: si el usuario no toca nada, el
// occurredAt que se manda es el mismo instante que ya tenia.
export function useOccurredAtField(initialIso?: string | null) {
  const initial = initialIso ? new Date(initialIso) : new Date()
  const date = ref(localDateInputValue(initial))
  const time = ref(localTimeInputValue(initial))
  // max=hoy: no tiene sentido registrar un movimiento "del futuro".
  const maxDate = localDateInputValue(new Date())

  function buildOccurredAt(): string {
    const [year, month, day] = date.value.split('-').map(Number)
    const [hours, minutes] = (time.value || localTimeInputValue(initial)).split(':').map(Number)
    return new Date(year, month - 1, day, hours, minutes, initial.getSeconds()).toISOString()
  }

  function openPicker(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    input.showPicker?.()
  }

  return { date, time, maxDate, buildOccurredAt, openPicker }
}
