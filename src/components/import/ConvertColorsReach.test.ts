import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { effectScope } from 'vue'
import ConvertImageWizard from './ConvertImageWizard.vue'
import { useConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import { NEIGHBOURS_REST_MS } from '../../composables/import/useConvertNeighbours'
import type { PixelData } from '../../domain/imageConversion'

// Fewer colors found than asked (ConvertImage card, ticket 0928): the Colors slider's value says both numbers, and its
// track is accent only up to the last count that changes the beads.

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

/** A picture of `colors` stripes of reds a step apart, too close for the Bead's palette to tell most of them apart. */
function reds(colors: number): PixelData {
  const data: number[] = []
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < colors; x += 1) data.push(120 + x * 8, 30 + x * 5, 40, 255)
  return { width: colors, height: 4, data: new Uint8ClampedArray(data) }
}

async function opened(colors = 16) {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({ start: { technique: 'loom', beadId: 'miyuki/delica/11-0', name: '', makerName: '' }, decodeImage: async () => reds(colors), loadCatalog: () => Promise.reject(new Error('none')) }),
  )!
  await wizard.setFile(new File(['x'], 'reds.png', { type: 'image/png' }))
  wizard.setWidth(colors)
  const wrapper = mount(ConvertImageWizard, { props: { wizard, readClipboardImage: async () => undefined }, attachTo: document.body })
  await flushPromises()
  return { wizard, wrapper }
}

const slider = (wrapper: VueWrapper) => wrapper.get('[data-testid="convert-colors-slider"]')
const value = (wrapper: VueWrapper) => wrapper.get('[data-testid="convert-colors-slider-value"]').text()
/** Lets the count rest and every step of the search for the reach run, each in a task of its own. */
async function rest() {
  vi.advanceTimersByTime(NEIGHBOURS_REST_MS)
  for (let step = 0; step < 12; step++) vi.advanceTimersByTime(1)
  await flushPromises()
}

describe('The colors asked and the colors found (ticket 0928)', () => {
  it('says both numbers, to a screen reader too, and fills the track in accent only up to the last count that changes the beads', async () => {
    const { wizard, wrapper } = await opened()
    vi.useFakeTimers()
    wizard.setMaxColors(13)
    await flushPromises()
    const found = wizard.foundColorCount.value
    expect(found).toBeLessThan(13)
    expect(value(wrapper)).toBe(`13 asked · ${found} found`)
    expect(wrapper.get('[data-testid="convert-colors-slider-range"]').attributes('aria-valuetext')).toBe(`13 asked · ${found} found`)
    await rest()
    expect(slider(wrapper).classes()).toContain('vs--reach')
  })
})
