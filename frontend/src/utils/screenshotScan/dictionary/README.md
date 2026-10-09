# Diccionario de lectura de capturas

Todo el vocabulario que usa la lectura de capturas vive aquí, un archivo por tema, como
datos (listas de patrones). La lógica (`../movementDictionary.ts`, `../classifyDocument.ts`,
los perfiles y parsers) solo los importa: para ajustar el reconocimiento se edita el archivo
del tema, no el código que lo usa. `index.ts` re-exporta todo.

Los patrones se comparan contra texto **en minúsculas y sin tildes** (`depósito` se escribe
`deposito`).

| Archivo | Qué contiene | Cuándo editarlo |
| --- | --- | --- |
| `directionWords.ts` | Palabras de dinero recibido y de dinero pagado | Un banco usa otra palabra para "recibido" |
| `feeWords.ts` | Palabras de comisión y su categoría | Otro nombre de comisión |
| `categoryHints.ts` | Texto → categoría sugerida | Sugerir más categorías |
| `walletHints.ts` | Bancos: cómo se nombran las billeteras y cómo se reconocen en el texto | Soportar otro banco |
| `dateWords.ts` | Días relativos (ayer, hoy) y meses | Otro idioma o formato de fecha |
| `documentSignals.ts` | Qué palabras identifican cada tipo de captura | Soportar otro banco o documento |
| `statusWords.ts` | Completado / cancelado | Otros estados |
| `binanceLabels.ts` | Etiquetas de "Detalles de la orden" de Binance P2P | Binance cambia un texto |
| `p2pOrderLabels.ts` | Etiquetas del historial de órdenes P2P | Binance cambia un texto |
| `bankLabels.ts` | Etiquetas de los comprobantes de cada banco | Un banco cambia su comprobante |
| `listPatterns.ts` | Montos y horas de las listas de movimientos | Otro formato de monto u hora |
| `imageKindWords.ts` | Cómo distinguir una lista de un movimiento suelto | Ajustar la detección de listas |

## Agregar un banco nuevo

1. `walletHints.ts`: añade su clave en `WalletKey` y su entrada (`nameHints`, `textPattern`).
2. `bankLabels.ts`: añade sus etiquetas (`BankLabels`).
3. `documentSignals.ts`: añade las palabras que lo identifican y su tipo en `DocumentType`.
4. `../bankMovementProfiles.ts`: una función `extractX` que llama a `extractBankMovement` con sus etiquetas.
5. `../scanText.ts`: un `case` para su tipo.
6. Añade el texto OCR de una captura real como caso en `../specs/`.
