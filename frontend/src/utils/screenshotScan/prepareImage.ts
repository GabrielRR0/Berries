// Formatos que el selector deja elegir. Android y iOS guardan las capturas de
// pantalla como PNG o JPEG; HEIC/HEIF solo aparece con fotos de la camara de
// iPhone, y se intenta leer aunque no todos los navegadores lo decodifican.
export const SCREENSHOT_ACCEPT = 'image/png,image/jpeg,image/webp,image/heic,image/heif'

const MAX_LONG_SIDE = 3000
// Tesseract lee mejor texto oscuro sobre fondo claro; las apps en modo oscuro
// (como Binance) se invierten antes del OCR.
const DARK_BACKGROUND_THRESHOLD = 128

// Pasa los pixeles a escala de grises (luminancia) y, si la imagen es
// mayormente oscura, los invierte. Modifica el arreglo en el lugar.
export function toOcrGrayscale(pixels: Uint8ClampedArray): void {
  let luminanceSum = 0
  const pixelCount = pixels.length / 4
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = Math.round(0.299 * pixels[index]! + 0.587 * pixels[index + 1]! + 0.114 * pixels[index + 2]!)
    pixels[index] = pixels[index + 1] = pixels[index + 2] = gray
    luminanceSum += gray
  }

  if (pixelCount === 0 || luminanceSum / pixelCount >= DARK_BACKGROUND_THRESHOLD) return
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = pixels[index + 1] = pixels[index + 2] = 255 - pixels[index]!
  }
}

export class UnreadableImageError extends Error {
  constructor() {
    super('No se pudo abrir la imagen. Usa una captura de pantalla en PNG o JPG.')
    this.name = 'UnreadableImageError'
  }
}

export interface PreparedImage {
  // Escala de grises (e invertida si es oscura): es lo que lee el OCR.
  ocr: HTMLCanvasElement
  // Con los colores originales: sirve para medir el color de un monto (verde = recibido).
  original: HTMLCanvasElement
}

function drawBitmap(bitmap: ImageBitmap, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new UnreadableImageError()
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function prepareImageForOcr(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new UnreadableImageError()
  }

  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(bitmap.width, bitmap.height))
  const original = drawBitmap(bitmap, scale)
  const ocr = drawBitmap(bitmap, scale)
  bitmap.close()

  const context = ocr.getContext('2d', { willReadFrequently: true })!
  const imageData = context.getImageData(0, 0, ocr.width, ocr.height)
  toOcrGrayscale(imageData.data)
  context.putImageData(imageData, 0, 0)
  return { ocr, original }
}

// Un monto esta "en verde" si el color de su tinta (los pixeles claros sobre el
// fondo oscuro) es dominantemente verde; el blanco normal tiene los tres canales
// parecidos. Devuelve null si no hay suficiente tinta para decidir.
const INK_MIN_BRIGHTNESS = 110
const MIN_INK_PIXELS = 12

export function isGreenInk(pixels: Uint8ClampedArray): boolean | null {
  let red = 0
  let green = 0
  let blue = 0
  let ink = 0
  for (let index = 0; index < pixels.length; index += 4) {
    if (Math.max(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!) < INK_MIN_BRIGHTNESS) continue
    red += pixels[index]!
    green += pixels[index + 1]!
    blue += pixels[index + 2]!
    ink += 1
  }
  if (ink < MIN_INK_PIXELS) return null
  return green > red * 1.25 && green > blue * 1.25
}

export function isGreenAt(canvas: HTMLCanvasElement, box: { x0: number; y0: number; x1: number; y1: number }): boolean | null {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const x = Math.max(0, Math.floor(box.x0))
  const y = Math.max(0, Math.floor(box.y0))
  const width = Math.min(canvas.width - x, Math.ceil(box.x1 - box.x0))
  const height = Math.min(canvas.height - y, Math.ceil(box.y1 - box.y0))
  if (width <= 0 || height <= 0) return null
  return isGreenInk(context.getImageData(x, y, width, height).data)
}

// Copia ampliada de un canvas (para releer texto chico, ver upscaleFactorFor en ocrLayout.ts).
export function scaleCanvas(canvas: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const scaled = document.createElement('canvas')
  scaled.width = Math.round(canvas.width * factor)
  scaled.height = Math.round(canvas.height * factor)
  const context = scaled.getContext('2d')
  if (!context) throw new UnreadableImageError()
  context.imageSmoothingQuality = 'high'
  context.drawImage(canvas, 0, 0, scaled.width, scaled.height)
  return scaled
}
