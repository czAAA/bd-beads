import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { MAX_ADDED_COLORS, PALETTE } from './domain/palette'
import { createProject } from './domain/project'
import { en } from './i18n/en'
import { ADDED_COLORS_KEY, PALETTE_ORDER_KEY } from './services/addedColorsStore'
import { saveProjects } from './services/libraryStore'
import { pressBead } from './testUtils/beads'
import { chooseCustomColor, openColorPopover } from './testUtils/pill'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  saveProjects([createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })])
})

const swatches = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[data-testid="palette-swatch"]')

/** The Palette's swatches, in the Color popover: picking a color closes the popover, so it opens again when it is gone. */
async function palette(wrapper: ReturnType<typeof mount>) {
  if (swatches(wrapper).length === 0) {
    await openColorPopover(wrapper)
  }
  return swatches(wrapper)
}

async function removeButton(wrapper: ReturnType<typeof mount>) {
  await palette(wrapper)
  return wrapper.find('[data-testid="palette-swatch-remove"]')
}

async function choose(wrapper: ReturnType<typeof mount>, hex: string) {
  await palette(wrapper)
  await chooseCustomColor(wrapper, hex)
}

async function paint(wrapper: ReturnType<typeof mount>, at = 0) {
  await pressBead(wrapper, at)
  await wrapper.trigger('mouseup')
  await flushPromises()
}

describe('a Custom color joins the Palette on first use (ticket 227)', () => {
  it('adds a swatch and selects it when the picker commits (tickets 398, 444), and keeps it across a reload', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await choose(wrapper, '#123456')
    const all = (await palette(wrapper))
    expect(all).toHaveLength(PALETTE.length + 1)
    const added = all[PALETTE.length]!
    expect(added.attributes('aria-pressed')).toBe('true')
    expect(added.element.closest('.swatch')!.querySelector('.app-tooltip__key')).toBeNull() // an added color has no key chip
    expect(JSON.parse(localStorage.getItem(ADDED_COLORS_KEY)!)).toEqual(['#123456'])

    await paint(wrapper, 0)
    expect((await palette(wrapper))).toHaveLength(PALETTE.length + 1)
    const reloaded = mount(App, { attachTo: document.body })
    await openColorPopover(reloaded)
    expect((await palette(reloaded))).toHaveLength(PALETTE.length + 1)
  })

  it('selects the matching swatch for a built-in hex and adds nothing', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await choose(wrapper, PALETTE[3]!.hex)
    await paint(wrapper)
    expect((await palette(wrapper))).toHaveLength(PALETTE.length)
    expect((await palette(wrapper))[3]!.attributes('aria-pressed')).toBe('true')
  })

  it('at the limit still paints, adds nothing and says why', async () => {
    const full = Array.from({ length: MAX_ADDED_COLORS }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`)
    localStorage.setItem(ADDED_COLORS_KEY, JSON.stringify(full))
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await choose(wrapper, '#fedcba')
    await paint(wrapper)
    expect((await palette(wrapper))).toHaveLength(PALETTE.length + MAX_ADDED_COLORS)
    expect(wrapper.text()).toContain(en.palette.limitReached)
  })
})

describe('an added swatch can be removed (ticket 228)', () => {
  const seed = (hexes: string[]) => localStorage.setItem(ADDED_COLORS_KEY, JSON.stringify(hexes))
  /** The × shows on the active added swatch and on a hovered or focused one (ticket 333), so the swatch is selected before it is used. */
  const selectAdded = async (wrapper: ReturnType<typeof mount>, index = 0) => {
    await (await palette(wrapper))[PALETTE.length + index]!.trigger('click')
    await palette(wrapper)
  }

  const modal = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="remove-color-modal"]')
  const confirm = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

  it('shows the × on the active added swatch, and on no built-in one (ticket 333)', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await (await palette(wrapper))[0]!.trigger('click')
    expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(0)
    await selectAdded(wrapper, 1)
    expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(1)
    expect((await removeButton(wrapper)).attributes('aria-label')).toBe(en.palette.removeSwatch.replace('{hex}', '#abcdef'))
  })

  it('asks before removing: the × opens a confirmation naming the color, and nothing is removed yet', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await selectAdded(wrapper)
    await (await removeButton(wrapper)).trigger('click')
    expect(modal(wrapper).exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-modal-message"]').text()).toContain('#123456')
    expect((await palette(wrapper))).toHaveLength(PALETTE.length + 2)
    expect((await palette(wrapper))[PALETTE.length]!.attributes('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem(ADDED_COLORS_KEY)!)).toEqual(['#123456', '#abcdef'])
  })

  it.each([
    ['Cancel', (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')],
  ])('%s leaves the swatch alone', async (_name, dismiss) => {
    seed(['#123456'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await selectAdded(wrapper)
    await (await removeButton(wrapper)).trigger('click')
    await dismiss(wrapper)
    expect(modal(wrapper).exists()).toBe(false)
    expect((await palette(wrapper))).toHaveLength(PALETTE.length + 1)
    expect(wrapper.text()).not.toContain(en.palette.removed)
  })

  it('Confirm removes the selected added swatch, falls back to the default color, keeps it gone after a reload', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await (await palette(wrapper))[PALETTE.length]!.trigger('click')
    await (await removeButton(wrapper)).trigger('click')
    await confirm(wrapper)
    expect(modal(wrapper).exists()).toBe(false)
    expect((await palette(wrapper))).toHaveLength(PALETTE.length + 1)
    expect(wrapper.find('[data-color-id="red"]').attributes('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem(ADDED_COLORS_KEY)!)).toEqual(['#abcdef'])
    expect(wrapper.text()).toContain(en.palette.removed)
    const reloaded = mount(App)
    await openColorPopover(reloaded)
    expect((await palette(reloaded))).toHaveLength(PALETTE.length + 1)
  })

  it('Delete or Backspace on a focused added swatch opens the same confirmation', async () => {
    seed(['#123456'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await (await palette(wrapper))[PALETTE.length]!.trigger('keydown', { key: 'Backspace' })
    expect(modal(wrapper).exists()).toBe(true)
    expect((await palette(wrapper))).toHaveLength(PALETTE.length + 1)
    await confirm(wrapper)
    expect((await palette(wrapper))).toHaveLength(PALETTE.length)
  })

  it('Undo in the toast puts the swatch back where it stood, selected again', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await (await palette(wrapper))[PALETTE.length]!.trigger('click')
    await (await removeButton(wrapper)).trigger('click')
    await confirm(wrapper)
    await wrapper.find('[data-testid="toast-action"]').trigger('click')
    expect((await palette(wrapper)).map((swatch) => swatch.attributes('aria-label')).slice(PALETTE.length)).toEqual(['#123456', '#abcdef'])
    expect((await palette(wrapper))[PALETTE.length]!.attributes('aria-pressed')).toBe('true')
    expect(JSON.parse(localStorage.getItem(ADDED_COLORS_KEY)!)).toEqual(['#123456', '#abcdef'])
  })

  it('frees a slot at the limit, so the next new Custom color is added', async () => {
    seed(Array.from({ length: MAX_ADDED_COLORS }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`))
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await (await palette(wrapper))[PALETTE.length]!.trigger('click')
    await (await removeButton(wrapper)).trigger('click')
    await confirm(wrapper)
    await choose(wrapper, '#fedcba')
    await paint(wrapper)
    expect((await palette(wrapper))).toHaveLength(PALETTE.length + MAX_ADDED_COLORS)
    expect((await palette(wrapper)).at(-1)!.attributes('aria-label')).toBe('#fedcba')
  })
})

describe('the Palette is slots (ticket 398)', () => {
  const ids = async (wrapper: ReturnType<typeof mount>) => (await palette(wrapper)).map((swatch) => swatch.attributes('data-color-id'))

  it('moves a swatch to another slot, and Shift+1 follows the slot', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await openColorPopover(wrapper)
    const first = (await palette(wrapper))[0]!
    await first.trigger('keydown', { key: 'ArrowRight', altKey: true })
    await flushPromises()
    expect((await ids(wrapper)).slice(0, 3)).toEqual(['white', 'black', 'red'])
    expect(JSON.parse(localStorage.getItem(PALETTE_ORDER_KEY)!).slice(0, 2)).toEqual(['white', 'black'])
    await wrapper.get('[data-testid="color-popover-close"]').trigger('click') // a shortcut waits while a popover is open
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '!', shiftKey: true, bubbles: true }))
    await flushPromises()
    expect((await palette(wrapper))[0]!.attributes('aria-pressed')).toBe('true')
    expect((await palette(wrapper))[0]!.attributes('data-color-id')).toBe('white')
  })

  it('keeps no empty slot when an added color between others is removed', async () => {
    localStorage.setItem(ADDED_COLORS_KEY, JSON.stringify(['#123456', '#abcdef']))
    localStorage.setItem(PALETTE_ORDER_KEY, JSON.stringify(['red', 'added-123456', 'black']))
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    expect((await ids(wrapper)).slice(0, 4)).toEqual(['red', 'added-123456', 'black', 'white'])
    await (await palette(wrapper))[1]!.trigger('click')
    await (await removeButton(wrapper)).trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect((await ids(wrapper)).slice(0, 3)).toEqual(['red', 'black', 'white'])
  })
})

describe('Pick color from canvas (ticket 398)', () => {
  it('takes the pressed bead\'s color, adds it to the Palette and ends the pick', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await choose(wrapper, '#123456')
    await paint(wrapper, 0)
    await (await palette(wrapper))[0]!.trigger('click') // red again
    await palette(wrapper)
    await wrapper.get('[data-testid="pick-color-button"]').trigger('click') // picking closes the popover
    await palette(wrapper)
    const button = wrapper.get('[data-testid="pick-color-button"]')
    expect(button.attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-testid="color-popover-close"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await flushPromises()
    await palette(wrapper)
    expect(wrapper.get('[data-testid="pick-color-button"]').attributes('aria-pressed')).toBe('false')
    expect((await palette(wrapper))[PALETTE.length]!.attributes('aria-pressed')).toBe('true')
  })
})
