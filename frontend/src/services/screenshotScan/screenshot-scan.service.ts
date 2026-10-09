import { statementDescriptionRegion } from '../../utils/screenshotScan/bankStatementParser'
import { replaceWordsInRegion, scaleWords, upscaleFactorFor } from '../../utils/screenshotScan/ocrLayout'
import type { OcrBox, OcrWord } from '../../utils/screenshotScan/ocrLayout'
import { isGreenAt, prepareImageForOcr, scaleCanvas } from '../../utils/screenshotScan/prepareImage'

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

interface RecognizedPage {
  text: string
  words: OcrWord[]
}

type TesseractModule = typeof import('tesseract.js')
type Worker = Awaited<ReturnType<TesseractModule['createWorker']>>
type RecognizeResult = Awaited<ReturnType<Worker['recognize']>>['data']

function wordsOf(data: RecognizeResult): OcrWord[] {
  const words: OcrWord[] = []
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) words.push({ text: word.text, ...word.bbox })
      }
    }
  }
  return words
}

async function readPage(worker: Worker, image: HTMLCanvasElement): Promise<RecognizedPage> {
  const { data } = await worker.recognize(image, {}, { blocks: true })
  return { text: data.text, words: wordsOf(data) }
}

// Lee una captura en el propio dispositivo con Tesseract.js (espanol + ingles): la imagen no se sube a
// ningun servidor. La libreria se importa recien aca para que su peso (WASM + datos de idioma, que se
// descargan la primera vez y el navegador cachea) no entre en la carga inicial de la app.
//
// Dos refuerzos para capturas de escritorio con letra chica (una tabla de BDV en linea, por ejemplo), donde
// Tesseract pierde hasta los titulos de las columnas y deforma las celdas de varias lineas:
//  1. si el texto leido es chico, se vuelve a leer la imagen ampliada (solo en ese caso: el celular no lo necesita);
//  2. si es una tabla, la columna de descripcion se relee sola, como un bloque, que es donde mejor lee.
export async function recognizeScreenshot(file: File): Promise<ScreenshotLayout> {
  const { ocr, original } = await prepareImageForOcr(file)

  try {
    const tesseract = await import('tesseract.js')
    const worker = await tesseract.createWorker(['spa', 'eng'])
    try {
      let working = ocr
      let scale = 1
      let page = await readPage(worker, working)

      const factor = upscaleFactorFor(page.words, ocr.width, ocr.height)
      if (factor > 1) {
        working = scaleCanvas(ocr, factor)
        scale = factor
        page = await readPage(worker, working)
      }

      const region = statementDescriptionRegion(page.words, working.width, working.height)
      if (region) {
        await worker.setParameters({ tessedit_pageseg_mode: tesseract.PSM.SINGLE_BLOCK })
        const { data } = await worker.recognize(working, { rectangle: region }, { blocks: true })
        page = { ...page, words: replaceWordsInRegion(page.words, region, wordsOf(data)) }
      }

      return {
        text: page.text,
        // Las posiciones vuelven a las coordenadas de la imagen original (donde se mide el color).
        words: scaleWords(page.words, scale),
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
