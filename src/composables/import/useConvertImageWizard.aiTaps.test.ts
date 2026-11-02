import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, type EffectScope } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import type { SubjectMask } from '../../domain/subjectMask'
import { fakeCutOutService } from '../../testUtils/fakeCutOutService'
import { useConvertImageWizard, type ConvertImageWizard } from './useConvertImageWizard'

// Cut out's taps (ticket 0769, spec 0761), through the wizard's state with a fake cut-out service: tap add and tap remove,
// each tap passed through with its kind and place, the refined mask applied, the tap model asked about before its first
// download, Cancel and Reset. Synthetic pictures only; the real model is checked by hand (ADR 0087).

/** An 8 × 2 picture: red at the left half, grey at the right. */
function picture(): PixelData {
  const data = new Uint8ClampedArray(8 * 2 * 4)
  for (let i = 0; i < 16; i += 1) data.set(i % 8 < 4 ? [220, 40, 50, 255] : [200, 200, 200, 255], i * 4)
  return { width: 8, height: 2, data }
}

/** A mask over the 8 × 2 picture keeping the columns from `from` up to `to`. */
const columns = (from: number, to: number): SubjectMask => ({
  width: 8,
  height: 2,
  subject: Uint8Array.from({ length: 16 }, (_, i) => (i % 8 >= from && i % 8 < to ? 1 : 0)),
})

let scope: EffectScope | undefined
afterEach(() => {
  scope?.stop()
  scope = undefined
})

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
  await nextTick()
}

/** The wizard with the AI choice's subject found: the left half. */
async function found(options: { tapsToDownload?: number } = {}) {
  const cutOut = fakeCutOutService(options)
  scope = effectScope()
  const wizard = scope.run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture(),
      loadCatalog: () => Promise.reject(new Error('no catalog')),
      cutOutService: cutOut.service,
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  wizard.setWidth(8)
  wizard.setCutOut('ai')
  await settle()
  cutOut.finish(columns(0, 4))
  await settle()
  return { wizard, cutOut }
}

const shape = (wizard: ConvertImageWizard) => {
  const { columns: across } = wizard.lattice.value!
  return wizard.beadColors.value
    .map((hex) => (hex ? '#' : '.'))
    .join('')
    .match(new RegExp(`.{${across}}`, 'g'))
}

describe('Cut out’s taps (ticket 0769)', () => {
  it('offers the taps once the subject is found, with neither on and nothing to reset', async () => {
    const { wizard } = await found()
    expect(wizard.cutOutTapsShown.value).toBe(true)
    expect(wizard.cutOutTapMode.value).toBeUndefined()
    expect(wizard.cutOutTaps.value).toEqual([])
    wizard.setCutOut('simple')
    expect(wizard.cutOutTapsShown.value).toBe(false)
  })

  it('keeps at most one of tap add and tap remove on; pressing the one on turns it off', async () => {
    const { wizard } = await found()
    wizard.toggleCutOutTap('add')
    expect(wizard.cutOutTapMode.value).toBe('add')
    wizard.toggleCutOutTap('remove')
    expect(wizard.cutOutTapMode.value).toBe('remove')
    wizard.toggleCutOutTap('remove')
    expect(wizard.cutOutTapMode.value).toBeUndefined()
  })

  it('does nothing with a tap while neither is on', async () => {
    const { wizard, cutOut } = await found()
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()
    expect(cutOut.refines()).toEqual([])
  })

  it('passes each tap through with its kind and place, and the preview shows the refined mask', async () => {
    const { wizard, cutOut } = await found()
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()
    expect(cutOut.refines()).toEqual([{ picture: wizard.image.value, automatic: columns(0, 4), taps: [{ x: 6, y: 1, kind: 'add' }] }])
    expect(wizard.aiCutOut.value).toEqual({ kind: 'thinking', longer: false })
    // While the tap is worked out, the preview keeps the mask it had.
    expect(shape(wizard)).toEqual(['####....', '####....'])

    cutOut.finish(columns(0, 8))
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'idle' })
    expect(shape(wizard)).toEqual(['########', '########'])
    expect(wizard.cutOutTaps.value).toEqual([{ x: 6, y: 1, kind: 'add' }])

    wizard.toggleCutOutTap('remove')
    wizard.tapCutOut({ x: 0, y: 0 })
    await settle()
    expect(cutOut.refines()[1]!.taps).toEqual([
      { x: 6, y: 1, kind: 'add' },
      { x: 0, y: 0, kind: 'remove' },
    ])
    cutOut.finish(columns(2, 8))
    await settle()
    expect(shape(wizard)).toEqual(['..######', '..######'])
  })

  it('Reset drops every tap and returns to the automatic mask, running nothing', async () => {
    const { wizard, cutOut } = await found()
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()
    cutOut.finish(columns(0, 8))
    await settle()

    wizard.resetCutOutTaps()
    expect(wizard.cutOutTaps.value).toEqual([])
    expect(shape(wizard)).toEqual(['####....', '####....'])
    expect(cutOut.refines()).toHaveLength(1)
  })

  it('asks before the tap model’s first download, on the first tap only, then works the tap out', async () => {
    const { wizard, cutOut } = await found({ tapsToDownload: 13_800_000 })
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 13_800_000 })
    expect(cutOut.refines()).toEqual([])

    wizard.downloadCutOutModel()
    await settle()
    expect(cutOut.refines()[0]!.taps).toEqual([{ x: 6, y: 1, kind: 'add' }])
    cutOut.progress({ kind: 'downloading', done: 4_000_000, total: 13_800_000 })
    expect(wizard.aiCutOut.value).toEqual({ kind: 'downloading', done: 4_000_000, total: 13_800_000 })
    cutOut.finish(columns(0, 8))
    await settle()

    wizard.tapCutOut({ x: 5, y: 0 })
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'thinking', longer: false })
    expect(cutOut.refines()).toHaveLength(2)
  })

  it('Cancel on the note drops the tap and turns the tap chip off; the AI choice and its mask stay', async () => {
    const { wizard, cutOut } = await found({ tapsToDownload: 13_800_000 })
    wizard.toggleCutOutTap('remove')
    wizard.tapCutOut({ x: 0, y: 0 })
    await settle()

    wizard.cancelAiCutOut()
    expect(wizard.cutOut.value).toBe('ai')
    expect(wizard.cutOutTapMode.value).toBeUndefined()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'idle' })
    expect(wizard.cutOutTaps.value).toEqual([])
    expect(shape(wizard)).toEqual(['####....', '####....'])
    expect(cutOut.refines()).toEqual([])
  })

  it('asks again at the next tap after a cancelled tap-model download', async () => {
    const { wizard, cutOut } = await found({ tapsToDownload: 13_800_000 })
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()
    wizard.downloadCutOutModel()
    await settle()
    wizard.cancelAiCutOut()
    await settle()

    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'asking', bytes: 13_800_000 })
    expect(cutOut.refines()).toHaveLength(1)
  })

  it('Cancel while a tap is worked out stops it and keeps the mask from before the tap', async () => {
    const { wizard, cutOut } = await found()
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()

    wizard.cancelAiCutOut()
    await settle()
    expect(cutOut.cancels()).toBe(1)
    expect(wizard.cutOut.value).toBe('ai')
    expect(wizard.cutOutTaps.value).toEqual([])
    expect(shape(wizard)).toEqual(['####....', '####....'])
  })

  it('a tap that fails says so, and keeps the mask from before it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wizard, cutOut } = await found()
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()

    cutOut.fail('out of memory')
    await settle()
    expect(wizard.aiCutOut.value).toEqual({ kind: 'failed' })
    expect(wizard.cutOut.value).toBe('ai')
    expect(wizard.cutOutTaps.value).toEqual([])
    expect(shape(wizard)).toEqual(['####....', '####....'])
    warn.mockRestore()
  })

  it('a turn drops the taps and turns the tap chips off', async () => {
    const { wizard, cutOut } = await found()
    wizard.toggleCutOutTap('add')
    wizard.tapCutOut({ x: 6, y: 1 })
    await settle()
    cutOut.finish(columns(0, 8))
    await settle()

    wizard.turn()
    await settle()
    expect(wizard.cutOutTapMode.value).toBeUndefined()
    expect(wizard.cutOutTapsShown.value).toBe(false)
    expect(wizard.cutOutTaps.value).toEqual([])
  })
})
