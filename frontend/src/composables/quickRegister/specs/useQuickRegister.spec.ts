import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuickRegister } from '../useQuickRegister'

describe('useQuickRegister', () => {
  beforeEach(() => {
    useQuickRegister().close()
  })

  it('abre en el menu y guarda el rect del boton del que nace', () => {
    const rect = { left: 10, top: 20, width: 60, height: 60 } as DOMRect
    const button = { getBoundingClientRect: () => rect } as Element
    const { isOpen, step, origin, open } = useQuickRegister()

    open(button)

    expect(isOpen.value).toBe(true)
    expect(step.value).toBe('menu')
    expect(origin.value).toBe(rect)
  })

  it('sin boton de origen abre igual, con origen null', () => {
    const { isOpen, origin, open } = useQuickRegister()

    open()

    expect(isOpen.value).toBe(true)
    expect(origin.value).toBeNull()
  })

  it('showDrafts abre directo en la revision de borradores', () => {
    const { isOpen, step, showDrafts } = useQuickRegister()

    showDrafts()

    expect(isOpen.value).toBe(true)
    expect(step.value).toBe('drafts')
  })

  it('requestReceipt llama de forma sincrona al selector registrado y deja de hacerlo al desregistrarlo', () => {
    const picker = vi.fn()
    const { requestReceipt, registerReceiptPicker } = useQuickRegister()
    const unregister = registerReceiptPicker(picker)

    requestReceipt()
    expect(picker).toHaveBeenCalledTimes(1)

    unregister()
    requestReceipt()
    expect(picker).toHaveBeenCalledTimes(1)
  })

  it('cada pedido de voz suma al contador para poder repetirse', () => {
    const { voiceRequests, requestVoice } = useQuickRegister()
    const before = voiceRequests.value

    requestVoice()
    requestVoice()

    expect(voiceRequests.value).toBe(before + 2)
  })

  it('close recuerda cuanto bajo el panel al cerrarlo arrastrando, para arrancar la animacion de ahi', () => {
    const { isOpen, closeOffsetY, open, close } = useQuickRegister()
    open()

    close(180)

    expect(isOpen.value).toBe(false)
    expect(closeOffsetY.value).toBe(180)

    open()
    close()
    expect(closeOffsetY.value).toBe(0)
  })
})
