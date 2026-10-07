import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { MAX_ADDED_COLORS, PALETTE } from './domain/palette'
import { createProject } from './domain/project'
import { en } from './i18n/en'
import { ADDED_COLORS_KEY } from './services/addedColorsStore'
import { saveProjects } from './services/libraryStore'
import { pressBead } from './testUtils/beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  saveProjects([createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })])
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
    expect(added.element.closest('.swatch')!.querySelector('.app-tooltip__key')).toBeNull() // an added color has no key chip
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

describe('an added swatch can be removed (ticket 228)', () => {
  const seed = (hexes: string[]) => localStorage.setItem(ADDED_COLORS_KEY, JSON.stringify(hexes))
  const removeButton = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="palette-swatch-remove"]')
  /** The × shows on the selected added swatch only (ticket 333), so the first added swatch is selected before it is used. */
  const selectAdded = async (wrapper: ReturnType<typeof mount>, index = 0) => {
    await swatches(wrapper)[PALETTE.length + index]!.trigger('click')
  }

  it('offers no removal on a built-in swatch', async () => {
    seed(['#123456'])
    const wrapper = mount(App)
    await flushPromises()
    await swatches(wrapper)[0]!.trigger('click')
    expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(0)
    await swatches(wrapper)[0]!.trigger('keydown', { key: 'Delete' })
    expect(wrapper.find('[data-testid="remove-color-modal"]').exists()).toBe(false)
    expect(swatches(wrapper)).toHaveLength(PALETTE.length + 1)
  })

  const modal = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="remove-color-modal"]')
  const confirm = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

  it('shows the × on the selected added swatch only, and on no built-in one (ticket 333)', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await swatches(wrapper)[0]!.trigger('click')
    expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(0)
    await selectAdded(wrapper, 1)
    expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(1)
    expect(removeButton(wrapper).attributes('aria-label')).toBe(en.palette.removeSwatch.replace('{hex}', '#abcdef'))
  })

  it('asks before removing: the × opens a confirmation naming the color, and nothing is removed yet', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await selectAdded(wrapper)
    await removeButton(wrapper).trigger('click')
    expect(modal(wrapper).exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-modal-message"]').text()).toContain('#123456')
    expect(swatches(wrapper)).toHaveLength(PALETTE.length + 2)
    expect(swatches(wrapper)[PALETTE.length]!.attributes('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem(ADDED_COLORS_KEY)!)).toEqual(['#123456', '#abcdef'])
  })

  it.each([
    ['Cancel', (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')],
    ['the backdrop', (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="modal-scrim"]').trigger('click')],
  ])('%s leaves the swatch alone', async (_name, dismiss) => {
    seed(['#123456'])
    const wrapper = mount(App)
    await flushPromises()
    await selectAdded(wrapper)
    await removeButton(wrapper).trigger('click')
    await dismiss(wrapper)
    expect(modal(wrapper).exists()).toBe(false)
    expect(swatches(wrapper)).toHaveLength(PALETTE.length + 1)
    expect(wrapper.text()).not.toContain(en.palette.removed)
  })

  it('Confirm removes the selected added swatch, falls back to the default color, keeps it gone after a reload', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await swatches(wrapper)[PALETTE.length]!.trigger('click')
    await removeButton(wrapper).trigger('click')
    await confirm(wrapper)
    expect(modal(wrapper).exists()).toBe(false)
    expect(swatches(wrapper)).toHaveLength(PALETTE.length + 1)
    expect(wrapper.find('[data-color-id="red"]').attributes('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem(ADDED_COLORS_KEY)!)).toEqual(['#abcdef'])
    expect(wrapper.text()).toContain(en.palette.removed)
    expect(swatches(mount(App))).toHaveLength(PALETTE.length + 1)
  })

  it('Delete or Backspace on a focused added swatch opens the same confirmation', async () => {
    seed(['#123456'])
    const wrapper = mount(App)
    await flushPromises()
    await swatches(wrapper)[PALETTE.length]!.trigger('keydown', { key: 'Backspace' })
    expect(modal(wrapper).exists()).toBe(true)
    expect(swatches(wrapper)).toHaveLength(PALETTE.length + 1)
    await confirm(wrapper)
    expect(swatches(wrapper)).toHaveLength(PALETTE.length)
  })

  it('Undo in the toast puts the swatch back where it stood, selected again', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await swatches(wrapper)[PALETTE.length]!.trigger('click')
    await removeButton(wrapper).trigger('click')
    await confirm(wrapper)
    await wrapper.find('[data-testid="toast-action"]').trigger('click')
    expect(swatches(wrapper).map((swatch) => swatch.attributes('aria-label')).slice(PALETTE.length)).toEqual(['#123456', '#abcdef'])
    expect(swatches(wrapper)[PALETTE.length]!.attributes('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem(ADDED_COLORS_KEY)!)).toEqual(['#123456', '#abcdef'])
  })

  it('frees a slot at the limit, so the next new Custom color is added', async () => {
    seed(Array.from({ length: MAX_ADDED_COLORS }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`))
    const wrapper = mount(App)
    await flushPromises()
    await swatches(wrapper)[PALETTE.length]!.trigger('click')
    await removeButton(wrapper).trigger('click')
    await confirm(wrapper)
    await choose(wrapper, '#fedcba')
    await paint(wrapper)
    expect(swatches(wrapper)).toHaveLength(PALETTE.length + MAX_ADDED_COLORS)
    expect(swatches(wrapper).at(-1)!.attributes('aria-label')).toBe('#fedcba')
  })
})
