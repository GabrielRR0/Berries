// Palabras de fecha en los encabezados de una lista ("AYER", "8 de octubre").
// Texto en minusculas y sin tildes.

// Dias relativos -> cuantos dias antes de hoy.
export const RELATIVE_DAY_PATTERNS: { pattern: RegExp; daysAgo: number }[] = [
  { pattern: /^(hoy|today)$/, daysAgo: 0 },
  { pattern: /^(ayer|yesterday)$/, daysAgo: 1 },
  { pattern: /^(anteayer|antier)$/, daysAgo: 2 },
]

// Dias de la semana que preceden a la fecha en algunos encabezados ("MIERCOLES, 7 DE OCTUBRE").
export const WEEKDAYS_ES = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

// Meses en espanol (posicion = numero de mes - 1). Para otro idioma, agregar una
// lista parecida y usarla en resolveDateHeader.
export const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
