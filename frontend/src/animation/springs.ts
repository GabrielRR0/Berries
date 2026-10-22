// Resortes compartidos por las animaciones de Movimientos: un solo "tacto" en
// toda la pantalla (tipo iOS: sin rebote exagerado, arranque rapido y asiento
// suave). SMOOTH para entradas y cambios de tamaño, SNAPPY para respuesta a un
// toque (press, indicador que se desliza).
export const SPRING_SMOOTH = { type: 'spring', bounce: 0, visualDuration: 0.5 } as const
export const SPRING_SNAPPY = { type: 'spring', bounce: 0.1, visualDuration: 0.36 } as const
