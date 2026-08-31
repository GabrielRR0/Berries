import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceEntryApiError, submitVoiceEntry } from '../../../services/voiceEntry/voice-entry.service'
import VoiceRecorderModal from '../VoiceRecorderModal.vue'

// jsdom no implementa SpeechRecognition (Web Speech API) - se stubea un mock minimo
// que guarda cada instancia creada para que el test pueda disparar sus callbacks
// (onresult/onerror/onend) a mano, simulando lo que haria el navegador real.
vi.mock('../../../services/voiceEntry/voice-entry.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/voiceEntry/voice-entry.service')>(
    '../../../services/voiceEntry/voice-entry.service',
  )
  return { ...actual, submitVoiceEntry: vi.fn() }
})

interface FakeResult {
  isFinal: boolean
  length: number
  0: { transcript: string; confidence: number }
}

function fakeResultEvent(text: string, isFinal: boolean) {
  const result: FakeResult = { isFinal, length: 1, 0: { transcript: text, confidence: 1 } }
  return { resultIndex: 0, results: [result] }
}

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = []

  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onresult: ((event: ReturnType<typeof fakeResultEvent>) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null

  constructor() {
    MockSpeechRecognition.instances.push(this)
  }

  start() {
    // no-op: el test dispara onresult/onerror/onend a mano
  }

  stop() {
    this.onend?.()
  }

  abort() {}
}

function latestRecognitionInstance(): MockSpeechRecognition {
  const instance = MockSpeechRecognition.instances.at(-1)
  if (!instance) throw new Error('No se creó ninguna instancia de SpeechRecognition en el test')
  return instance
}

function findButton(wrapper: VueWrapper, text: string) {
  return wrapper.findAll('button').find((btn) => btn.text() === text)
}

const DRAFT = {
  id: 'draft-1',
  source: 'voice',
  rawInput: 'gaste veinte dolares en comida',
  parsedAmount: 20,
  parsedCurrency: 'USD',
  parsedCategory: 'comida',
  parsedDescription: null,
  suggestedWalletId: null,
  status: 'pending',
  createdAt: '2026-08-01T12:00:00Z',
}

describe('VoiceRecorderModal', () => {
  beforeEach(() => {
    MockSpeechRecognition.instances = []
    vi.stubGlobal('SpeechRecognition', MockSpeechRecognition)
    vi.mocked(submitVoiceEntry).mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('arranca en estado idle mostrando el boton "Empezar a hablar" y sin mensajes de error', () => {
    const wrapper = mount(VoiceRecorderModal, { props: { submit: submitVoiceEntry } })

    expect(findButton(wrapper, 'Empezar a hablar')).toBeTruthy()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('muestra un aviso de no-compatibilidad si el navegador no tiene SpeechRecognition', () => {
    vi.unstubAllGlobals()
    const wrapper = mount(VoiceRecorderModal, { props: { submit: submitVoiceEntry } })

    expect(wrapper.text()).toContain('no soporta dictado por voz')
    expect(findButton(wrapper, 'Empezar a hablar')).toBeFalsy()
  })

  it('reconoce y permite enviar, emitiendo "created" con el draft devuelto', async () => {
    vi.mocked(submitVoiceEntry).mockResolvedValue(DRAFT)
    const wrapper = mount(VoiceRecorderModal, { props: { submit: submitVoiceEntry } })

    await findButton(wrapper, 'Empezar a hablar')!.trigger('click')
    const recognizer = latestRecognitionInstance()
    recognizer.onresult?.(fakeResultEvent('gaste veinte dolares en comida', true))
    recognizer.onend?.()
    await flushPromises()

    expect(wrapper.find('textarea').element.value).toBe('gaste veinte dolares en comida')
    expect(findButton(wrapper, 'Enviar')).toBeTruthy()

    await findButton(wrapper, 'Enviar')!.trigger('click')
    await flushPromises()

    expect(submitVoiceEntry).toHaveBeenCalledWith('gaste veinte dolares en comida')
    expect(wrapper.emitted('created')).toBeTruthy()
    expect(wrapper.emitted('created')![0]).toEqual([DRAFT])
  })

  it('muestra un mensaje claro si el permiso de micrófono es denegado, sin crashear', async () => {
    const wrapper = mount(VoiceRecorderModal, { props: { submit: submitVoiceEntry } })

    await findButton(wrapper, 'Empezar a hablar')!.trigger('click')
    const recognizer = latestRecognitionInstance()
    recognizer.onerror?.({ error: 'not-allowed' })
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('micrófono')
    // vuelve a "idle": se puede reintentar sin crashear
    expect(findButton(wrapper, 'Empezar a hablar')).toBeTruthy()
  })

  it('avisa si termina sin detectar ninguna voz', async () => {
    const wrapper = mount(VoiceRecorderModal, { props: { submit: submitVoiceEntry } })

    await findButton(wrapper, 'Empezar a hablar')!.trigger('click')
    latestRecognitionInstance().onend?.()
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('No se detectó voz')
  })

  it('muestra el error del backend si el envío falla, sin perder el transcript', async () => {
    vi.mocked(submitVoiceEntry).mockRejectedValue(new VoiceEntryApiError('No se pudo registrar el movimiento.', 400))
    const wrapper = mount(VoiceRecorderModal, { props: { submit: submitVoiceEntry } })

    await findButton(wrapper, 'Empezar a hablar')!.trigger('click')
    const recognizer = latestRecognitionInstance()
    recognizer.onresult?.(fakeResultEvent('gaste veinte dolares en comida', true))
    recognizer.onend?.()
    await flushPromises()

    await findButton(wrapper, 'Enviar')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudo registrar el movimiento.')
    expect(wrapper.emitted('created')).toBeFalsy()
    // el transcript sigue disponible para reintentar sin dictar de nuevo
    expect(findButton(wrapper, 'Enviar')).toBeTruthy()
  })

  it('emite "close" al hacer click en el boton de cerrar', async () => {
    // El boton de cerrar ahora es el de BottomSheet.vue (".sheet-close"),
    // no uno propio - el modal centrado se reemplazo por un bottom sheet
    // pedido explicito del usuario.
    const wrapper = mount(VoiceRecorderModal, { props: { submit: submitVoiceEntry } })

    await wrapper.find('.sheet-close').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
