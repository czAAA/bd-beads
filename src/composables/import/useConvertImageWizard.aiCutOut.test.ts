import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import type { SubjectMask } from '../../domain/subjectMask'
import { fakeCutOutService } from '../../testUtils/fakeCutOutService'
import { fakeCutOutDevice } from '../../testUtils/fakeCutOutDevice'
import { useConvertImageWizard, type ConvertImageWizard } from './useConvertImageWizard'

// Cut out with AI (ticket 0767, spec 0761), through the wizard's state with a fake cut-out service: the download asked
// first, its progress, the model at work, the mask applied, Cancel taking the choice back, and the result kept while the
// picture is. Synthetic pictures only; the real model is checked by hand (ADR 0087).

/** An 8 × 2 picture: red at the left half, grey at the right. */
function picture(): PixelData {
  const data = new Uint8ClampedArray(8 * 2 * 4)
  for (let i = 0; i < 16; i += 1) data.set(i % 8 < 4 ? [220, 40, 50, 255] : [200, 200, 200, 255], i * 4)
  return { width: 8, height: 2, data }
}

/** The mask the fake model finds on a picture: its left half. */
const leftHalf = (width: number, height: number): SubjectMask => ({
  width,
  height,
  subject: Uint8Array.from({ length: width * height }, (_, i) => (i % width < width / 2 ? 1 : 0)),
})

let scope: EffectScope | undefined
afterEach(() => {
  scope?.stop()
  scope = undefined
  vi.useRealTimers()
})

async function convert(options: { toDownload?: number } = {}) {
  const cutOut = fakeCutOutService(options)
  scope = effectScope()
  const wizard = scope.run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture(),
      loadCatalog: () => Promise.reject(new Error('no catalog')),
      cutOutService: cutOut.service,
      cutOutDevice: fakeCutOutDevice().device,
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  wizard.setWidth(8)
  await nextTick()
  return { wizard, cutOut }
}

/** Lets the wizard's waits on the service settle. */
const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
  await nextTick()
}

/** Where the beads are, as `#` for a bead and `.` for none. */
const shape = (wizard: ConvertImageWizard) => {
  const { columns } = wizard.lattice.value!
  const marks = wizard.beadColors.value.map((hex) => (hex ? '#' : '.')).join('')
  return marks.match(new RegExp(`.{${columns}}`, 'g'))
}

describe('Cut out with AI (ticket 0767)', () => {
  it('runs the model on the picture when it is on the device, and the preview shows its subject alone', async () => {
    const { wizard, cutOut } = await convert()
    wizard.setCutOut('ai')
    await settle()
    expect(cutOut.pictures()).toEqual([wizard.image.value])
    expect(wizard.aiCutOut.value).toEqual({ kind: 'thinking', longer: false })
    expect(shape(wizard)).toEqual(['########', '########'])

    cutOut.finish(leftHalf(8, 2))
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'idle' })
    expect(wizard.cutOut.value).toBe('ai')
    expect(shape(wizard)).toEqual(['####....', '####....'])
    expect(wizard.found.value.map((color) => color.pictureHex)).toEqual(['#dc2832'])
    expect(wizard.subjectBounds.value).toEqual({ x: 0, y: 0, width: 4, height: 2 })
  })

  it('keeps the result while the picture stays: flipping between Off, Simple and AI runs nothing again', async () => {
    const { wizard, cutOut } = await convert()
    wizard.setCutOut('ai')
    await settle()
    cutOut.finish(leftHalf(8, 2))
    await settle()

    wizard.setCutOut('off')
    expect(shape(wizard)).toEqual(['########', '########'])
    wizard.setCutOut('simple')
    wizard.setCutOut('ai')
    await settle()
    expect(cutOut.pictures()).toHaveLength(1)
    expect(wizard.aiCutOut.value).toEqual({ kind: 'idle' })
    expect(shape(wizard)).toEqual(['####....', '####....'])
  })

  it('works it out again for a turned picture', async () => {
    const { wizard, cutOut } = await convert()
    wizard.setCutOut('ai')
    await settle()
    cutOut.finish(leftHalf(8, 2))
    await settle()

    wizard.turn()
    await settle()
    expect(cutOut.pictures()).toHaveLength(2)
    expect(cutOut.pictures()[1]).toBe(wizard.image.value)
    expect(wizard.subjectMask.value).toBeUndefined()
    cutOut.finish(leftHalf(2, 8))
    await settle()
    expect(wizard.subjectMask.value?.width).toBe(2)
  })

  it('asks before the first download, with its size, and shows its progress once Download is pressed', async () => {
    const { wizard, cutOut } = await convert({ toDownload: 59_000_000 })
    wizard.setCutOut('ai')
    await settle()
    expect(wizard.cutOut.value).toBe('ai')
    expect(wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 59_000_000, lowMemory: false, lowSpace: false })
    expect(cutOut.pictures()).toHaveLength(0)

    wizard.downloadCutOutModel()
    await settle()
    expect(cutOut.pictures()).toHaveLength(1)
    cutOut.progress({ kind: 'downloading', done: 12_000_000, total: 59_000_000 })
    expect(wizard.aiCutOut.value).toEqual({ kind: 'downloading', done: 12_000_000, total: 59_000_000 })
    cutOut.progress({ kind: 'thinking' })
    expect(wizard.aiCutOut.value).toEqual({ kind: 'thinking', longer: false })
  })

  it('Cancel on the note takes the choice back to the one before, downloading nothing', async () => {
    const { wizard, cutOut } = await convert({ toDownload: 59_000_000 })
    wizard.setCutOut('simple')
    wizard.setCutOut('ai')
    await settle()

    wizard.cancelAiCutOut()
    expect(wizard.cutOut.value).toBe('simple')
    expect(wizard.aiCutOut.value).toEqual({ kind: 'idle' })
    expect(cutOut.pictures()).toHaveLength(0)
  })

  it('asks again after a cancelled download', async () => {
    const { wizard, cutOut } = await convert({ toDownload: 59_000_000 })
    wizard.setCutOut('ai')
    await settle()
    wizard.downloadCutOutModel()
    await settle()
    wizard.cancelAiCutOut()
    await settle()

    wizard.setCutOut('ai')
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 59_000_000, lowMemory: false, lowSpace: false })
    expect(cutOut.pictures()).toHaveLength(1)
  })

  it('Cancel stops a download or a run at once and takes the choice back', async () => {
    const { wizard, cutOut } = await convert()
    wizard.setCutOut('ai')
    await settle()
    expect(cutOut.running()).toBe(true)

    wizard.cancelAiCutOut()
    await settle()
    expect(cutOut.cancels()).toBe(1)
    expect(cutOut.running()).toBe(false)
    expect(wizard.cutOut.value).toBe('off')
    expect(wizard.aiCutOut.value).toEqual({ kind: 'idle' })
    expect(wizard.subjectMask.value).toBeUndefined()
  })

  it('choosing Simple while the model works stops it, and Simple stays chosen', async () => {
    const { wizard, cutOut } = await convert()
    wizard.setCutOut('ai')
    await settle()

    wizard.setCutOut('simple')
    await settle()
    expect(cutOut.cancels()).toBe(1)
    expect(wizard.cutOut.value).toBe('simple')
    expect(wizard.aiCutOut.value).toEqual({ kind: 'idle' })
  })

  it('a failed run goes back to the choice before and says so until the next choice', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wizard, cutOut } = await convert()
    wizard.setCutOut('ai')
    await settle()

    cutOut.fail('out of memory')
    await settle()
    expect(wizard.cutOut.value).toBe('off')
    expect(wizard.aiCutOut.value).toEqual({ kind: 'failed' })
    expect(warn).toHaveBeenCalled()

    wizard.setCutOut('simple')
    expect(wizard.aiCutOut.value).toEqual({ kind: 'idle' })
    warn.mockRestore()
  })

  it('says the device is taking longer after ten seconds of thinking', async () => {
    vi.useFakeTimers()
    const { wizard } = await convert()
    wizard.setCutOut('ai')
    await settle()

    vi.advanceTimersByTime(9_999)
    expect(wizard.aiCutOut.value).toEqual({ kind: 'thinking', longer: false })
    vi.advanceTimersByTime(1)
    expect(wizard.aiCutOut.value).toEqual({ kind: 'thinking', longer: true })
  })

  it('leaving the converter stops a run in hand', async () => {
    const { wizard, cutOut } = await convert()
    wizard.setCutOut('ai')
    await settle()

    scope!.stop()
    expect(cutOut.cancels()).toBe(1)
    expect(cutOut.running()).toBe(false)
  })
})
