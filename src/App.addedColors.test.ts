import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { MAX_ADDED_COLORS, PALETTE } from './domain/palette'
import { createPattern } from './domain/pattern'
import { en } from './i18n/en'
import { ADDED_COLORS_KEY } from './services/addedColorsStore'
import { savePatterns } from './services/libraryStore'
import { pressBead } from './testUtils/beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  savePatterns([createPattern({ technique: 'loom', beadId: cubeBead.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })])
})

const swatches = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[data-testid="palette-swatch"]')

async function choose(wrapper: ReturnType<typeof mount>, hex: string) {
  const input = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
  input.element.value = hex
  await input.trigger('input')
}

async function paint(wrapper: ReturnType<typeof mount>, at = 0) {
  await pressBead(wrapper, at)
  await wrapper.trigger('mouseup')
  await flushPromises()
}

describe('a Custom color joins the Palette on first use (ticket 227)', () => {
  it('adds a swatch only once it paints, selects it, and keeps it across a reload', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await choose(wrapper, '#123456')
    expect(swatches(wrapper)).toHaveLength(PALETTE.length)

    await paint(wrapper, 0)
    await paint(wrapper, 1)
    const all = swatches(wrapper)
    expect(all).toHaveLength(PALETTE.length + 1)
    const added = all[PALETTE.length]!
    expect(added.attributes('aria-pressed')).toBe('true')
    expect(added.attributes('title')).not.toContain('Shift+')
    expect(JSON.parse(localStorage.getItem(ADDED_COLORS_KEY)!)).toEqual(['#123456'])

    expect(swatches(mount(App, { attachTo: document.body }))).toHaveLength(PALETTE.length + 1)
  })

  it('selects the matching swatch for a built-in hex and adds nothing', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await choose(wrapper, PALETTE[3]!.hex)
    await paint(wrapper)
    expect(swatches(wrapper)).toHaveLength(PALETTE.length)
    expect(swatches(wrapper)[3]!.attributes('aria-pressed')).toBe('true')
  })

  it('at the limit still paints, adds nothing and says why', async () => {
    const full = Array.from({ length: MAX_ADDED_COLORS }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)
    localStorage.setItem(ADDED_COLORS_KEY, JSON.stringify(full))
    const wrapper = mount(App)
    await flushPromises()
    await choose(wrapper, '#fedcba')
    await paint(wrapper)
    expect(swatches(wrapper)).toHaveLength(PALETTE.length + MAX_ADDED_COLORS)
    expect(wrapper.text()).toContain(en.palette.limitReached)
  })
})
