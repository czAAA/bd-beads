import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { addedColorId, defaultPaletteIds } from './domain/palette'
import { createProject } from './domain/createProject'
import { en } from './i18n/en'
import { loadProjects, saveProjects } from './services/libraryStore'
import { pressBead } from './testUtils/beads'
import { chooseCustomColor, openColorPopover } from './testUtils/pill'

// The Palette's wiring only (ticket 0601): each control reaches its flow once. What the flows decide is in
// useRemoveColorFlow, useBeadColors and useToolAndColor; what the controls show is in ColorPopover and PalettePicker;
// the rules are domain/palette's.

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const A = addedColorId('#123456')
const B = addedColorId('#abcdef')

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  const project = createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })
  saveProjects([{ ...project, palette: [...defaultPaletteIds(), A, B] }])
})

/** The ids of the Palette the saved Project holds (ticket 0525). */
const storedPalette = () => loadProjects()[0]!.palette

async function openApp() {
  const wrapper = mount(App, { attachTo: document.body })
  await flushPromises()
  await openColorPopover(wrapper)
  return wrapper
}

/** Enters Edit palette with the popover's pencil (ticket 531). */
const editPalette = (wrapper: ReturnType<typeof mount>) => wrapper.get('[data-testid="color-popover-edit"]').trigger('click')
const confirm = (wrapper: ReturnType<typeof mount>) => wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
const cancel = (wrapper: ReturnType<typeof mount>) => wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')

describe('the Palette reaches its flows', () => {
  it('a picked Custom color joins the saved Palette, selected (ticket 227)', async () => {
    const wrapper = await openApp()
    await chooseCustomColor(wrapper, '#fedcba')
    expect(storedPalette()).toContain(addedColorId('#fedcba'))
    await openColorPopover(wrapper)
    expect(wrapper.get(`[data-color-id="${addedColorId('#fedcba')}"]`).attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('the × in Edit palette asks, Cancel keeps the swatch, Confirm removes it, and the toast\'s Undo puts it back (ticket 228)', async () => {
    const wrapper = await openApp()
    await editPalette(wrapper)
    await wrapper.get(`[data-color-id="${A}"]`).trigger('click')
    expect(wrapper.get('[data-testid="remove-color-modal"]').text()).toContain('#123456')
    await cancel(wrapper)
    expect(wrapper.find('[data-testid="remove-color-modal"]').exists()).toBe(false)
    await wrapper.get(`[data-color-id="${A}"]`).trigger('click')
    await confirm(wrapper)
    expect(storedPalette()).toEqual([...defaultPaletteIds(), B])
    expect(wrapper.text()).toContain(en.palette.removed)
    await wrapper.get('[data-testid="toast-action"]').trigger('click')
    expect(storedPalette()).toEqual([...defaultPaletteIds(), A, B])
    wrapper.unmount()
  })

  it('the bin in Edit palette asks with the count, Cancel keeps the colors, Confirm removes them all (ticket 0532)', async () => {
    const wrapper = await openApp()
    await editPalette(wrapper)
    await wrapper.get('[data-testid="color-popover-remove-all"]').trigger('click')
    expect(wrapper.get('[data-testid="remove-all-colors-modal"]').text()).toContain('2 colors will leave the Palette.')
    await cancel(wrapper)
    expect(wrapper.find('[data-testid="remove-all-colors-modal"]').exists()).toBe(false)
    await wrapper.get('[data-testid="color-popover-remove-all"]').trigger('click')
    await confirm(wrapper)
    expect(storedPalette()).toEqual(defaultPaletteIds())
    wrapper.unmount()
  })

  it('a swatch picked from the Bead\'s Color catalog is named by its code and name once the catalog loads (ticket 0760)', async () => {
    const project = loadProjects()[0]!
    saveProjects([{ ...project, paletteCodes: { '#123456': '49' } }])
    const wrapper = await openApp()
    await vi.waitFor(() => expect(wrapper.get(`[data-color-id="${A}"]`).attributes('aria-label')).toBe('49 Opaque Black'))
    wrapper.unmount()
  })

  it('Alt+Right moves a swatch to the next slot of the saved Palette (ticket 398)', async () => {
    const wrapper = await openApp()
    const [first, second, ...rest] = storedPalette()
    await wrapper.get(`[data-color-id="${first}"]`).trigger('keydown', { key: 'ArrowRight', altKey: true })
    await flushPromises()
    expect(storedPalette()).toEqual([second, first, ...rest])
    wrapper.unmount()
  })

  it('Pick color from canvas takes the pressed bead\'s color and ends the pick (ticket 398)', async () => {
    const wrapper = await openApp()
    await wrapper.get(`[data-color-id="${A}"]`).trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await openColorPopover(wrapper)
    await wrapper.get('[data-color-id="red"]').trigger('click')
    await openColorPopover(wrapper)
    await wrapper.get('[data-testid="pick-color-button"]').trigger('click') // arming closes the popover
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await flushPromises()
    await openColorPopover(wrapper)
    expect(wrapper.get('[data-testid="pick-color-button"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get(`[data-color-id="${A}"]`).attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('the Bead colors list’s foot row opens a color Report on the Project’s Bead (ticket 0700)', async () => {
    const wrapper = await openApp()
    await wrapper.get('[data-testid="bead-colors-toggle"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="bead-colors-report"]').trigger('click')
    expect(wrapper.get('[data-testid="feedback-sheet"]').attributes('data-kind')).toBe('bead-color')
    expect(wrapper.get('[data-testid="feedback-brand"]').text()).toContain(cubeBead.brand.name)
    wrapper.unmount()
  })
})

