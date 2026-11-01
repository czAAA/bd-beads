import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import type { CutOutRecord } from '../../domain/cutOutModel'
import type { PixelData } from '../../domain/imageConversion'
import type { SubjectMask } from '../../domain/subjectMask'
import { fakeCutOutDevice } from '../../testUtils/fakeCutOutDevice'
import { fakeCutOutService } from '../../testUtils/fakeCutOutService'
import { useConvertImageWizard } from './useConvertImageWizard'

// The struggling device (ticket 0768, ADR 0087), through the wizard's state with a fake cut-out service and a fake device
// record: the run-in-progress flag and what a flag left set says, the first run's time, and the checks before a first
// download. Nothing here ever blocks the AI choice.

/** An 8 × 2 picture: red at the left half, grey at the right. */
function picture(): PixelData {
  const data = new Uint8ClampedArray(8 * 2 * 4)
  for (let i = 0; i < 16; i += 1) data.set(i % 8 < 4 ? [220, 40, 50, 255] : [200, 200, 200, 255], i * 4)
  return { width: 8, height: 2, data }
}

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

interface Options {
  record?: Partial<CutOutRecord>
  memoryGb?: number
  freeBytes?: number
  toDownload?: number
  tapsToDownload?: number
}

async function convert({ record, memoryGb, freeBytes, ...service }: Options = {}) {
  const cutOut = fakeCutOutService(service)
  const device = fakeCutOutDevice({ record, memoryGb, freeBytes })
  scope = effectScope()
  const wizard = scope.run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture(),
      loadCatalog: () => Promise.reject(new Error('no catalog')),
      cutOutService: cutOut.service,
      cutOutDevice: device.device,
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  wizard.setWidth(8)
  await nextTick()
  return { wizard, cutOut, device }
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
  await nextTick()
}

describe('the run-in-progress flag (ticket 0768)', () => {
  it('a flag left set reports a stopped run, kept until a run finishes', async () => {
    const { wizard, device } = await convert({ record: { running: true } })
    expect(wizard.cutOutStopped.value).toBe(true)
    expect(device.record()).toMatchObject({ running: false, stopped: true })
  })

  it('a cleared flag reports nothing', async () => {
    const { wizard, device } = await convert()
    expect(wizard.cutOutStopped.value).toBe(false)
    expect(device.record()).toMatchObject({ running: false, stopped: false })
  })

  it('is set while the model works and cleared once it has finished', async () => {
    const { wizard, cutOut, device } = await convert()
    wizard.setCutOut('ai')
    await settle()
    expect(device.record().running).toBe(true)

    cutOut.finish(leftHalf(8, 2))
    await settle()
    expect(device.record().running).toBe(false)
  })

  it('is not set while the model downloads: a tab closed then says nothing of memory', async () => {
    const { wizard, cutOut, device } = await convert({ toDownload: 44_000_000 })
    wizard.setCutOut('ai')
    await settle()
    wizard.downloadCutOutModel()
    await settle()
    cutOut.progress({ kind: 'downloading', done: 1_000_000, total: 44_000_000 })
    expect(device.record().running).toBe(false)
    cutOut.progress({ kind: 'thinking' })
    expect(device.record().running).toBe(true)
  })

  it('is cleared by Cancel and by a failed run', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wizard, cutOut, device } = await convert()
    wizard.setCutOut('ai')
    await settle()
    wizard.cancelAiCutOut()
    expect(device.record().running).toBe(false)

    wizard.setCutOut('ai')
    await settle()
    cutOut.fail()
    await settle()
    expect(device.record().running).toBe(false)
    warn.mockRestore()
  })

  it('is set by a tap’s run too: the tap model is the larger one', async () => {
    const { wizard, cutOut, device } = await convert()
    wizard.setCutOut('ai')
    await settle()
    cutOut.finish(leftHalf(8, 2))
    await settle()
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 0 })
    await settle()
    expect(device.record().running).toBe(true)
  })
})

describe('after a stopped run (ticket 0768)', () => {
  it('pressing the AI chip asks once more before running, and a run that finishes clears the warning', async () => {
    const { wizard, cutOut, device } = await convert({ record: { running: true } })
    wizard.setCutOut('ai')
    await settle()
    expect(wizard.cutOut.value).toBe('ai')
    expect(wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 0, lowMemory: false, lowSpace: false })
    expect(cutOut.pictures()).toHaveLength(0)

    wizard.downloadCutOutModel()
    await settle()
    expect(cutOut.pictures()).toHaveLength(1)
    expect(wizard.cutOutStopped.value).toBe(true)

    cutOut.finish(leftHalf(8, 2))
    await settle()
    expect(wizard.cutOutStopped.value).toBe(false)
    expect(device.record().stopped).toBe(false)
  })

  it('Cancel, on the question or the run, takes the choice back, the warning staying', async () => {
    const { wizard, cutOut } = await convert({ record: { stopped: true } })
    wizard.setCutOut('simple')
    wizard.setCutOut('ai')
    await settle()
    wizard.cancelAiCutOut()
    expect(wizard.cutOut.value).toBe('simple')
    expect(wizard.cutOutStopped.value).toBe(true)
    expect(cutOut.pictures()).toHaveLength(0)

    wizard.setCutOut('ai')
    await settle()
    wizard.downloadCutOutModel()
    await settle()
    wizard.cancelAiCutOut()
    expect(wizard.cutOutStopped.value).toBe(true)
  })
})

describe('the first run’s time (ticket 0768)', () => {
  it('a slow first run is kept, from when the model began to think', async () => {
    vi.useFakeTimers()
    const { wizard, cutOut, device } = await convert({ toDownload: 44_000_000 })
    wizard.setCutOut('ai')
    await settle()
    wizard.downloadCutOutModel()
    await settle()
    cutOut.progress({ kind: 'downloading', done: 1_000_000, total: 44_000_000 })
    vi.advanceTimersByTime(30_000)
    cutOut.progress({ kind: 'thinking' })
    vi.advanceTimersByTime(14_000)
    expect(wizard.aiCutOut.value).toEqual({ kind: 'thinking', longer: true })

    cutOut.finish(leftHalf(8, 2))
    await settle()
    expect(device.record().firstRunMs).toBe(14_000)
  })

  it('only the first: a later run leaves it as it was', async () => {
    vi.useFakeTimers()
    const { wizard, cutOut, device } = await convert({ record: { firstRunMs: 8_000 } })
    wizard.setCutOut('ai')
    await settle()
    vi.advanceTimersByTime(3_000)
    cutOut.finish(leftHalf(8, 2))
    await settle()
    expect(device.record().firstRunMs).toBe(8_000)
  })

  it('a cancelled run is not kept', async () => {
    vi.useFakeTimers()
    const { wizard, device } = await convert()
    wizard.setCutOut('ai')
    await settle()
    vi.advanceTimersByTime(3_000)
    wizard.cancelAiCutOut()
    expect(device.record().firstRunMs).toBeUndefined()
  })
})

describe('the checks before a first download (ticket 0768)', () => {
  it('warn of memory under 4 GB and of too little free space, and still ask', async () => {
    const { wizard } = await convert({ toDownload: 44_000_000, memoryGb: 2, freeBytes: 10_000_000 })
    wizard.setCutOut('ai')
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 44_000_000, lowMemory: true, lowSpace: true })
  })

  it('say nothing on a device with 4 GB and room, or one that reports neither', async () => {
    const roomy = await convert({ toDownload: 44_000_000, memoryGb: 4, freeBytes: 44_000_000 })
    roomy.wizard.setCutOut('ai')
    await settle()
    expect(roomy.wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 44_000_000, lowMemory: false, lowSpace: false })
    scope!.stop()

    const silent = await convert({ toDownload: 44_000_000 })
    silent.wizard.setCutOut('ai')
    await settle()
    expect(silent.wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 44_000_000, lowMemory: false, lowSpace: false })
  })

  it('check before the tap model’s download too', async () => {
    const { wizard, cutOut } = await convert({ tapsToDownload: 14_000_000, memoryGb: 2 })
    wizard.setCutOut('ai')
    await settle()
    cutOut.finish(leftHalf(8, 2))
    await settle()
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 0 })
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 14_000_000, lowMemory: true, lowSpace: false })
  })
})
