import { isGreenAt, prepareImageForOcr } from '../../utils/screenshotScan/prepareImage'
import type { OcrBox, OcrWord } from '../../utils/screenshotScan/ocrLayout'

export class ScreenshotScanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScreenshotScanError'
  }
}

export interface ScreenshotLayout {
  text: string
  words: OcrWord[]
  width: number
  height: number
  // Mide si el monto de esa zona esta en verde (recibido); null si no se pudo medir.
  isGreen: (box: OcrBox) => boolean | null
}

// Lee una captura en el propio dispositivo con Tesseract.js (espanol + ingles):
// la imagen no se sube a ningun servidor. La libreria se importa recien aca
// para que su peso (WASM + datos de idioma, que se descargan la primera vez y
// el navegador cachea) no entre en la carga inicial de la app.
export async function recognizeScreenshot(file: File): Promise<ScreenshotLayout> {
  const { ocr, original } = await prepareImageForOcr(file)

  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker(['spa', 'eng'])
    try {
      const { data } = await worker.recognize(ocr, {}, { blocks: true })
      const words: OcrWord[] = []
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) words.push({ text: word.text, ...word.bbox })
          }
        }
      }
      return {
        text: data.text,
        words,
        width: ocr.width,
        height: ocr.height,
        isGreen: (box) => isGreenAt(original, box),
      }
    } finally {
      await worker.terminate()
    }
  } catch {
    throw new ScreenshotScanError(
      'No se pudo leer la captura. Revisa tu conexión (la primera vez se descargan los idiomas) e inténtalo de nuevo.',
    )
  }
}
