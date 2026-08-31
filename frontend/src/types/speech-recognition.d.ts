// La Web Speech API (SpeechRecognition) todavía no es parte del lib.dom.d.ts estándar
// de TypeScript (es no-estándar / con soporte de navegador dispar) — esta es la
// declaración mínima de lo que VoiceRecorderModal.vue realmente usa, no una copia
// completa del spec.
export {}

interface BerrySpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: { transcript: string; confidence: number }
}

interface BerrySpeechRecognitionResultList {
  readonly length: number
  [index: number]: BerrySpeechRecognitionResult
}

interface BerrySpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: BerrySpeechRecognitionResultList
}

interface BerrySpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

export interface BerrySpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: BerrySpeechRecognitionEvent) => void) | null
  onerror: ((event: BerrySpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BerrySpeechRecognition
    webkitSpeechRecognition?: new () => BerrySpeechRecognition
  }
}
