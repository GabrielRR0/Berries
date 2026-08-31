import base64

import httpx

from app.config import settings
from app.services.receiptScanner.errors import OcrNotConfiguredError


def extract_text(image_bytes: bytes, filename: str) -> str:
    """Extrae el texto de una foto de recibo vía Google Cloud Vision (API `images:annotate`,
    feature `TEXT_DETECTION`) — el proveedor de OCR en la nube que recomienda el plan de
    arquitectura de Berry (Tesseract requiere un binario del sistema poco confiable en un
    runtime serverless).

    A diferencia de voiceEntry (que ahora transcribe en el navegador vía Web Speech API
    y no depende de ninguna key), acá no hay forma de evitar una API externa real: no se
    puede inventar productivamente "lo que dice un recibo" a partir de una foto. Mientras
    no haya una OCR_PROVIDER_API_KEY real configurada, se levanta un error tipado en vez
    de simular un texto — el router lo traduce a una respuesta HTTP 503 limpia.
    """
    if not settings.ocr_provider_api_key:
        raise OcrNotConfiguredError("OCR todavía no está conectado — configurá OCR_PROVIDER_API_KEY")

    # Llamado real a Google Cloud Vision — queda escrito pero es inalcanzable mientras
    # ocr_provider_api_key esté vacío. Conectarlo de verdad es remover el early return de
    # arriba una vez exista una key real: la key va como query param `key=` (tal como
    # exige la API REST de Vision), y la imagen viaja en base64 dentro del body JSON.
    response = httpx.post(
        "https://vision.googleapis.com/v1/images:annotate",
        params={"key": settings.ocr_provider_api_key},
        json={
            "requests": [
                {
                    "image": {"content": base64.b64encode(image_bytes).decode("ascii")},
                    "features": [{"type": "TEXT_DETECTION"}],
                }
            ]
        },
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()["responses"][0]["fullTextAnnotation"]["text"]
