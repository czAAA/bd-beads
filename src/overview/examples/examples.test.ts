import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { provideI18n } from '../../i18n/useI18n'
import { installFakeCanvas } from '../../testUtils/fakeCanvas'
import { defineComponent, h } from 'vue'
import FeatureExample from './FeatureExample.vue'
import { CHECKS, GOLD_STRIP, HEART, HILLS, POPPY, POPPY_PAINTING, STRIPES } from './exampleArt'

const FEATURES = ['techniques', 'patternEditing', 'convertImage', 'rowProgress', 'beadsNeeded', 'exports', 'savedPatterns'] as const

function example(feature: (typeof FEATURES)[number], locale = 'en') {
  localStorage.setItem('bd-beads:locale', locale)
  const Host = defineComponent({
    setup() {
      provideI18n()
      return () => h(FeatureExample, { feature })
    },
  })
  return mount(Host)
}

beforeEach(() => {
  localStorage.clear()
  installFakeCanvas()
  // The thumbnails are put on a canvas as image data, which jsdom has neither of.
  vi.stubGlobal('ImageData', class {})
  Object.assign(HTMLCanvasElement.prototype.getContext('2d') as object, { putImageData: vi.fn() })
})

afterEach(() => vi.unstubAllGlobals())

describe('the example artwork', () => {
  it('draws each picture at the size its beads need', () => {
    expect([HEART.length, HEART[0]!.length]).toEqual([10, 11])
    expect([POPPY.length, POPPY[0]!.length]).toEqual([13, 13])
    expect([HILLS.length, HILLS[0]!.length]).toEqual([18, 24])
    expect([STRIPES.length, CHECKS.length, GOLD_STRIP.length]).toEqual([12, 12, 30])
  })

  it("leaves the poppy's lower stem for Paint to draw", () => {
    expect(POPPY_PAINTING.slice(11).flat().some((cell) => cell.color !== POPPY_PAINTING[12]![0]!.color)).toBe(false)
    expect(POPPY.slice(11).flat().some((cell) => cell.color === POPPY[12]![0]!.color)).toBe(true)
    expect(POPPY_PAINTING.slice(0, 11)).toEqual(POPPY.slice(0, 11))
  })
})

describe('the carousel examples', () => {
  it.each(FEATURES)('%s: is decorative, hidden from screen readers', (feature) => {
    const wrapper = example(feature)
    const root = wrapper.get('[data-testid="feature-example"]')
    expect(root.attributes('aria-hidden')).toBe('true')
  })

  it('techniques: draws one heart each in loom, peyote and brick stitch, labelled', () => {
    const wrapper = example('techniques')
    expect(wrapper.findAll('[data-technique]').map((el) => el.attributes('data-technique'))).toEqual(['loom', 'peyote', 'brick'])
    expect(wrapper.findAll('.ex-label').map((el) => el.text())).toEqual(['loom', 'peyote', 'brick stitch'])
    expect(wrapper.findAll('canvas')).toHaveLength(3)
  })

  it('pattern editing: shows Paint active in the toolbar', () => {
    const wrapper = example('patternEditing')
    expect(wrapper.findAll('.editing__tool--on')).toHaveLength(1)
    expect(wrapper.find('.editing__tool--on [data-icon="paint"]').exists()).toBe(true)
  })

  it('convert image: a picture beside its 6 colors', () => {
    const wrapper = example('convertImage')
    expect(wrapper.findAll('.ex-label').map((el) => el.text())).toEqual(['picture', '6 colors'])
    expect(wrapper.find('svg.convert__picture').exists()).toBe(true)
  })

  it('row progress: reads Row 6 of 18 and offers Row done', () => {
    const wrapper = example('rowProgress')
    expect(wrapper.text()).toContain('Row 6')
    expect(wrapper.text()).toContain('of 18')
    expect(wrapper.text()).toContain('Row done')
  })

  it('beads needed: lists the Tour Pattern colors and a total that adds up', () => {
    const wrapper = example('beadsNeeded')
    const numbers = wrapper.findAll('.beads__number').map((el) => Number(el.text()))
    const total = numbers.pop()!
    expect(numbers).toHaveLength(2)
    expect(numbers.reduce((a, b) => a + b, 0)).toBe(total)
    expect(wrapper.text()).toContain(`Beads needed · ${total}`)
    expect(wrapper.text()).toMatch(/≈ \d+(\.\d)?\s+g/)
  })

  it('exports: a page with the technique word, and the four ways out', () => {
    const wrapper = example('exports')
    expect(wrapper.get('[data-testid="example-word"]').text()).toBe('Loom')
    expect(wrapper.findAll('.formats__item').map((el) => el.text())).toEqual(['PDF', 'PNG', 'QR', 'Pattern file'])
  })

  it("exports: keeps the word's proportions whatever the width", () => {
    const wrapper = example('exports')
    expect(wrapper.get('[data-testid="example-word"]').attributes('preserveAspectRatio')).toBe('xMidYMid meet')
  })

  it('saved patterns: six named thumbnails, the first one open', () => {
    const wrapper = example('savedPatterns')
    expect(wrapper.findAll('.gallery__name').map((el) => el.text())).toEqual(['Gold strip', 'Poppy', 'Heart', 'Hills', 'Stripes', 'Checks'])
    expect(wrapper.findAll('.gallery__item--open')).toHaveLength(1)
    expect(wrapper.findAll('.gallery__item')[0]!.classes()).toContain('gallery__item--open')
  })

  it('speaks Russian when the language is Russian', () => {
    expect(example('techniques', 'ru').findAll('.ex-label').map((el) => el.text())).toEqual(['ткачество', 'мозаика', 'кирпичик'])
    expect(example('savedPatterns', 'ru').findAll('.gallery__name')[1]!.text()).toBe('Мак')
    expect(example('exports', 'ru').get('[data-testid="example-word"]').text()).toBe('Ткачество')
  })
})
