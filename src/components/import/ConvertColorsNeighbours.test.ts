import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { effectScope } from 'vue'
import ConvertImageWizard from './ConvertImageWizard.vue'
import { useConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import { NEIGHBOURS_REST_MS } from '../../composables/import/useConvertNeighbours'
import type { PixelData } from '../../domain/imageConversion'
import { seeded } from '../../testUtils/samplerPictures'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))
afterEach(() => {
  document.body.innerHTML = ''
})

/** A picture of `colors` stripes, each a color of its own far from the others, so each count gives other beads. */
function stripes(colors: number): PixelData {
  const random = seeded(7)
  const stripe = Array.from({ length: colors }, () => [random() * 255, random() * 255, random() * 255, 255])
  const data: number[] = []
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < colors; x += 1) data.push(...stripe[x]!)
  return { width: colors, height: 4, data: new Uint8ClampedArray(data) }
}

async function opened(colors = 120) {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({ start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' }, decodeImage: async () => stripes(colors), loadCatalog: () => Promise.reject(new Error('none')) }),
  )!
  await wizard.setFile(new File(['x'], 'stripes.png', { type: 'image/png' }))
  wizard.setSource('exact')
  wizard.setWidth(colors)
  const wrapper = mount(ConvertImageWizard, { props: { wizard, readClipboardImage: async () => undefined }, attachTo: document.body })
  await flushPromises()
  return { wizard, wrapper }
}

const range = (wrapper: VueWrapper) => wrapper.get<HTMLInputElement>('[data-testid="convert-colors-slider-range"]')
const card = (wrapper: VueWrapper) => wrapper.find('[data-testid="convert-neighbours"]')
const captions = (wrapper: VueWrapper) =>
  card(wrapper)
    .findAll('[data-side]')
    .map((place) => place.text())
/** Lets the count rest, so both neighbours are worked out. */
async function rest() {
  await new Promise((done) => setTimeout(done, NEIGHBOURS_REST_MS + 20))
  await flushPromises()
}

describe('The number of colors with one fewer and one more (ticket 0904)', () => {
  it('shows the neighbours while the slider has focus, and takes a neighbour’s count on a tap', async () => {
    const { wizard, wrapper } = await opened()
    expect(card(wrapper).exists()).toBe(false)
    range(wrapper).element.focus()
    await flushPromises()
    expect(card(wrapper).attributes()).toMatchObject({ role: 'group', 'aria-label': 'Number of colors' })
    expect(captions(wrapper)).toEqual(['11 colors', '12 colors', '13 colors'])
    await rest()

    const more = card(wrapper).get('[data-side="more"]')
    ;(more.element as HTMLElement).focus()
    await more.trigger('click')
    expect(wizard.maxColors.value).toBe(13)
    expect(captions(wrapper)).toEqual(['12 colors', '13 colors', '14 colors'])
    expect(document.activeElement).toBe(card(wrapper).get('[data-side="more"]').element)
  })

  it('runs the slider to 40 with "40+" at its end, a larger count typed in the card', async () => {
    const { wizard, wrapper } = await opened()
    expect(range(wrapper).attributes('aria-valuemax')).toBe('40')
    expect(wrapper.get('[data-testid="convert-colors-slider"] .vs-max').text()).toBe('40+')
    range(wrapper).element.focus()
    await flushPromises()

    const field = card(wrapper).get<HTMLInputElement>('[data-testid="convert-colors-count"]')
    await field.setValue('64')
    await field.trigger('keydown', { key: 'Enter' })
    expect(wizard.maxColors.value).toBe(64)
    expect(wrapper.get('[data-testid="convert-colors-slider-value"]').text()).toBe('64 colors')
    expect(captions(wrapper)).toEqual(['63 colors', '64 colors', '65 colors'])

    await field.trigger('keydown', { key: 'ArrowUp' })
    expect(wizard.maxColors.value).toBe(65)
    await field.setValue('0')
    await field.trigger('change')
    expect(wizard.maxColors.value).toBe(1)
    expect(card(wrapper).get('[data-side="fewer"]').text()).toBe('no fewer')
    expect(field.element.value).toBe('1')
  })

  it('makes a count over the most the picture has the most, its right place "no more"', async () => {
    const { wizard, wrapper } = await opened(30)
    range(wrapper).element.focus()
    await flushPromises()
    const field = card(wrapper).get<HTMLInputElement>('[data-testid="convert-colors-count"]')
    await field.setValue('300')
    await field.trigger('keydown', { key: 'Enter' })
    expect(wizard.maxColors.value).toBe(wizard.colorsMax.value)
    expect(card(wrapper).get('[data-side="more"]').text()).toBe('no more')
  })

  it('closes on Escape with focus back on the slider, and when focus leaves the slider and the card', async () => {
    const { wrapper } = await opened()
    range(wrapper).element.focus()
    await flushPromises()
    await range(wrapper).trigger('keydown', { key: 'Escape' })
    expect(card(wrapper).exists()).toBe(false)
    expect(document.activeElement).toBe(range(wrapper).element)

    await range(wrapper).trigger('pointerdown')
    expect(card(wrapper).exists()).toBe(true)
    wrapper.get<HTMLElement>('[data-testid="convert-colors-more"]').element.focus()
    await new Promise((done) => setTimeout(done))
    await flushPromises()
    expect(card(wrapper).exists()).toBe(false)
  })
})
