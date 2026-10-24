import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { BUILT_IN_COLORS, addedColorId, defaultPaletteIds } from './domain/palette'
import { createProject } from './domain/project'
import { en } from './i18n/en'
import { loadProjects, saveProjects } from './services/libraryStore'
import { pressBead } from './testUtils/beads'
import { chooseCustomColor, openColorPopover } from './testUtils/pill'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  saveProjects([createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })])
})

/** The ids of the Palette the saved Project holds (ticket 0525). */
const storedPalette = () => loadProjects()[0]!.palette
const storedAdded = () => storedPalette().filter((id) => id.startsWith('added-'))

/** The saved Project with a Palette of these added colors (hexes), after the twelve unless `order` says otherwise. */
function seedPalette(hexes: string[], order?: string[]) {
  const [project] = loadProjects()
  saveProjects([{ ...project!, palette: order ?? [...defaultPaletteIds(), ...hexes.map(addedColorId)] }])
}

const swatches = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[data-testid="palette-swatch"]')

/** The Palette's swatches, in the Color popover: picking a color closes the popover, so it opens again when it is gone. */
async function palette(wrapper: ReturnType<typeof mount>) {
  if (swatches(wrapper).length === 0) {
    await openColorPopover(wrapper)
  }
  return swatches(wrapper)
}

/** How many Palette colors there are, the ones shown as the pill's recent chips included (ticket 529). */
async function total(wrapper: ReturnType<typeof mount>) {
  return (await palette(wrapper)).length + wrapper.findAll('[data-testid="pill-recent"]').length
}

/** One Palette swatch by id: the position shifts as the pill's recent chips take colors out of the popover (ticket 529). */
async function swatch(wrapper: ReturnType<typeof mount>, colorId: string) {
  await palette(wrapper)
  return wrapper.get(`[data-color-id="${colorId}"]`)
}

/** Enters Edit palette (ticket 531) and presses the added swatch: the way to ask to remove it. */
async function askToRemove(wrapper: ReturnType<typeof mount>, colorId: string) {
  await palette(wrapper)
  const pencil = wrapper.get('[data-testid="color-popover-edit"]')
  if (pencil.attributes('aria-pressed') !== 'true') await pencil.trigger('click')
  await wrapper.get(`[data-color-id="${colorId}"]`).trigger('click')
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
    expect(await total(wrapper)).toBe(BUILT_IN_COLORS.length + 1)
    const added = await swatch(wrapper, addedColorId('#123456'))
    expect(added.attributes('aria-pressed')).toBe('true')
    expect(added.element.closest('.swatch')!.querySelector('.app-tooltip__key')).toBeNull() // an added color has no key chip
    expect(storedAdded()).toEqual([addedColorId('#123456')])

    await paint(wrapper, 0)
    expect(await total(wrapper)).toBe(BUILT_IN_COLORS.length + 1)
    const reloaded = mount(App, { attachTo: document.body })
    await openColorPopover(reloaded)
    expect(await total(reloaded)).toBe(BUILT_IN_COLORS.length + 1)
  })

  it('selects the matching swatch for a built-in hex and adds nothing', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await choose(wrapper, BUILT_IN_COLORS[3]!.hex)
    await paint(wrapper)
    expect(await total(wrapper)).toBe(BUILT_IN_COLORS.length)
    expect((await swatch(wrapper, BUILT_IN_COLORS[3]!.id)).attributes('aria-pressed')).toBe('true')
  })

  it('has no cap: a hundred added colors all join, and nothing says the Palette is full', async () => {
    seedPalette(Array.from({ length: 100 }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`))
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await choose(wrapper, '#fedcba')
    await paint(wrapper)
    expect(await total(wrapper)).toBe(BUILT_IN_COLORS.length + 101)
    expect(storedAdded()).toHaveLength(101)
    expect(wrapper.find('[data-testid="custom-color-button"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('[data-testid="toast"]')).toHaveLength(0)
  })

  it('is the Project\'s: a second Project keeps the built-in twelve', async () => {
    const [fox] = loadProjects()
    saveProjects([fox!, createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Owl', size: { width: 10, height: 10, unit: 'beads' } })])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await choose(wrapper, '#123456')
    expect(loadProjects().map((project) => project.palette.length).sort()).toEqual([BUILT_IN_COLORS.length, BUILT_IN_COLORS.length + 1])
  })

  it('Undo takes a swatch that joined back out', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await openColorPopover(wrapper)
    await choose(wrapper, '#123456')
    expect(storedAdded()).toHaveLength(1)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', ctrlKey: true, bubbles: true }))
    await flushPromises()
    expect(storedAdded()).toHaveLength(0)
  })
})

describe('an added swatch can be removed (ticket 228)', () => {
  const seed = (hexes: string[]) => seedPalette(hexes)
  /** Choosing a color closes the popover; the swatch is selected before Edit palette asks to remove it. */
  const selectAdded = async (wrapper: ReturnType<typeof mount>, hex = '#123456') => {
    await (await swatch(wrapper, addedColorId(hex))).trigger('click')
    await palette(wrapper)
  }

  const modal = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="remove-color-modal"]')
  const confirm = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

  it('shows a × on every added swatch only in Edit palette, and none on a built-in one (ticket 531)', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await selectAdded(wrapper, '#abcdef')
    expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(0)
    await wrapper.get('[data-testid="color-popover-edit"]').trigger('click')
    expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(2)
    expect((await swatch(wrapper, addedColorId('#abcdef'))).attributes('aria-label')).toBe(en.palette.removeSwatch.replace('{hex}', '#abcdef'))
    const builtIn = (await palette(wrapper)).find((candidate) => !candidate.attributes('data-color-id')!.startsWith('added'))!
    expect(builtIn.attributes('aria-disabled')).toBe('true')
    for (const id of ['pick-color-button', 'custom-color-button']) expect(wrapper.get(`[data-testid="${id}"]`).attributes('aria-disabled')).toBe('true')
    await wrapper.get('[data-testid="custom-color-button"]').trigger('click')
    expect(wrapper.find('[data-testid="custom-color-panel"]').exists()).toBe(false)
  })

  it('Edit palette ends on Escape without closing the popover, and the popover opens in normal mode (ticket 531)', async () => {
    seed(['#123456'])
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await openColorPopover(wrapper)
    await wrapper.get('[data-testid="color-popover-edit"]').trigger('click')
    expect(wrapper.get('[data-testid="color-popover-edit"]').attributes('aria-pressed')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.get('[data-testid="color-popover-edit"]').attributes('aria-pressed')).toBe('false')
    await wrapper.get('[data-testid="color-popover-edit"]').trigger('click')
    await wrapper.get('[data-testid="color-popover-close"]').trigger('click')
    await openColorPopover(wrapper)
    expect(wrapper.get('[data-testid="color-popover-edit"]').attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('Edit palette ends with the last added color, and the pencil goes (ticket 531)', async () => {
    seed(['#123456'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await askToRemove(wrapper, addedColorId('#123456'))
    await confirm(wrapper)
    await flushPromises()
    expect(wrapper.find('[data-testid="color-popover-edit"]').exists()).toBe(false)
  })

  it('asks before removing: the × opens a confirmation naming the color, and nothing is removed yet', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await selectAdded(wrapper)
    await askToRemove(wrapper, addedColorId('#123456'))
    expect(modal(wrapper).exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-modal-message"]').text()).toContain('#123456')
    expect(await total(wrapper)).toBe(BUILT_IN_COLORS.length + 2)
    expect((await swatch(wrapper, addedColorId('#123456'))).classes()).toContain('swatch__chip--selected')
    expect(storedAdded()).toEqual([addedColorId('#123456'), addedColorId('#abcdef')])
  })

  it.each([
    ['Cancel', (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')],
  ])('%s leaves the swatch alone', async (_name, dismiss) => {
    seed(['#123456'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await selectAdded(wrapper)
    await askToRemove(wrapper, addedColorId('#123456'))
    await dismiss(wrapper)
    expect(modal(wrapper).exists()).toBe(false)
    expect(await total(wrapper)).toBe(BUILT_IN_COLORS.length + 1)
    expect(wrapper.text()).not.toContain(en.palette.removed)
  })

  it('Confirm removes the selected added swatch, falls back to the default color, keeps it gone after a reload', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await (await swatch(wrapper, addedColorId('#123456'))).trigger('click')
    await askToRemove(wrapper, addedColorId('#123456'))
    await confirm(wrapper)
    expect(modal(wrapper).exists()).toBe(false)
    expect(storedPalette()).toHaveLength(BUILT_IN_COLORS.length + 1)
    expect(wrapper.find('[data-color-id="black"]').attributes('aria-pressed')).toBe('true')
    expect(storedAdded()).toEqual([addedColorId('#abcdef')])
    expect(wrapper.text()).toContain(en.palette.removed)
    const reloaded = mount(App)
    await openColorPopover(reloaded)
    expect(reloaded.find(`[data-color-id="${addedColorId('#123456')}"]`).exists()).toBe(false)
    expect(reloaded.find(`[data-color-id="${addedColorId('#abcdef')}"]`).exists()).toBe(true)
  })

  it('Delete or Backspace on a focused added swatch opens the same confirmation', async () => {
    seed(['#123456'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await (await swatch(wrapper, addedColorId('#123456'))).trigger('keydown', { key: 'Backspace' })
    expect(modal(wrapper).exists()).toBe(true)
    expect(await total(wrapper)).toBe(BUILT_IN_COLORS.length + 1)
    await confirm(wrapper)
    expect(await total(wrapper)).toBe(BUILT_IN_COLORS.length)
  })

  it('Undo in the toast puts the swatch back where it stood, selected again', async () => {
    seed(['#123456', '#abcdef'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    await (await swatch(wrapper, addedColorId('#123456'))).trigger('click')
    await askToRemove(wrapper, addedColorId('#123456'))
    await confirm(wrapper)
    await wrapper.find('[data-testid="toast-action"]').trigger('click')
    expect((await swatch(wrapper, addedColorId('#123456'))).classes()).toContain('swatch__chip--selected')
    expect(storedAdded()).toEqual([addedColorId('#123456'), addedColorId('#abcdef')])
  })
})

describe('the Palette is slots (ticket 398)', () => {
  const ids = async (wrapper: ReturnType<typeof mount>) => (await palette(wrapper)).map((swatch) => swatch.attributes('data-color-id'))

  it('moves a swatch to another slot, and Shift+4 follows the first slot', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await openColorPopover(wrapper)
    const first = (await palette(wrapper))[0]!
    await first.trigger('keydown', { key: 'ArrowRight', altKey: true })
    await flushPromises()
    expect((await ids(wrapper)).slice(0, 3)).toEqual(['white', 'black', 'red'])
    expect(storedPalette().slice(0, 2)).toEqual(['white', 'black'])
    await wrapper.get('[data-testid="color-popover-close"]').trigger('click') // a shortcut waits while a popover is open
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4', key: '$', shiftKey: true, bubbles: true }))
    await flushPromises()
    expect((await palette(wrapper))[0]!.attributes('aria-pressed')).toBe('true')
    expect((await palette(wrapper))[0]!.attributes('data-color-id')).toBe('white')
  })

  it('keeps no empty slot when an added color between others is removed', async () => {
    seedPalette(['#123456', '#abcdef'], ['red', 'added-123456', 'black', 'white'])
    const wrapper = mount(App)
    await flushPromises()
    await openColorPopover(wrapper)
    expect((await ids(wrapper)).slice(0, 4)).toEqual(['red', 'added-123456', 'black', 'white'])
    await (await palette(wrapper))[1]!.trigger('click')
    await askToRemove(wrapper, addedColorId('#123456'))
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
    expect((await swatch(wrapper, addedColorId('#123456'))).attributes('aria-pressed')).toBe('true')
  })
})
