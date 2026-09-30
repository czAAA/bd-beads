import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { drawnPattern, hoverBead, pressBead, selectedBeadCount } from './testUtils/beads'
import { fakeMatchMedia } from './testUtils/fakeMatchMedia'
import { BEAD_CATALOG } from './domain/beads'
import { findPaletteColor } from './domain/palette'
import { serializeLibrary } from './domain/patternFile'
import { createPattern } from './domain/pattern'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!
const DRAWER_QUERY = '(min-width: 744px) and (max-width: 1023px)'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  // The Drawer's focus trap/Escape/role=dialog only activate at this tier (AppDrawer.vue's own useMediaQuery).
  vi.stubGlobal('matchMedia', fakeMatchMedia({ [DRAWER_QUERY]: true }).matchMedia)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function createPatternViaForm(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
  await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
  await wrapper.find('form').trigger('submit')
}

/** A drag across the grid, released on the shell (a real drag can end anywhere), which is what commits it to undo history. */
async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
  await pressBead(wrapper, indices[0]!)
  for (const index of indices.slice(1)) {
    await hoverBead(wrapper, index, { buttons: 1 })
  }
  await wrapper.find('.app-shell').trigger('mouseup')
}

describe('App at the iPad mini tier (ticket 168)', () => {
  describe('the Drawer', () => {
    it('is closed to start, opens from the header\'s Tools button, holds the left column\'s boxes, and closes again on a second press', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')

      const drawer = wrapper.find('[data-testid="drawer"]')
      expect(wrapper.find('[data-testid="drawer-open-button"]').attributes('aria-pressed')).toBe('false')

      await wrapper.find('[data-testid="drawer-open-button"]').trigger('click')
      expect(wrapper.find('[data-testid="drawer-open-button"]').attributes('aria-pressed')).toBe('true')
      expect(drawer.find('[data-testid="toolbox"]').exists()).toBe(true)
      expect(drawer.find('[data-testid="save-button"]').exists()).toBe(true)
      expect(drawer.find('[data-testid="bead-quantities"]').exists()).toBe(true)

      await wrapper.find('[data-testid="drawer-open-button"]').trigger('click')
      expect(wrapper.find('[data-testid="drawer-open-button"]').attributes('aria-pressed')).toBe('false')
    })

    it('closes on Escape and on the scrim', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')

      await wrapper.find('[data-testid="drawer-open-button"]').trigger('click')
      expect(wrapper.find('[data-testid="drawer-open-button"]').attributes('aria-pressed')).toBe('true')

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="drawer-open-button"]').attributes('aria-pressed')).toBe('false')

      await wrapper.find('[data-testid="drawer-open-button"]').trigger('click')
      await wrapper.find('[data-testid="drawer-scrim"]').trigger('click')
      expect(wrapper.find('[data-testid="drawer-open-button"]').attributes('aria-pressed')).toBe('false')
    })
  })

  describe('the BottomToolbar', () => {
    it('selects a tool the same way the Toolbox\'s own tabs do', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')

      expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
      await wrapper.find('[data-testid="bottom-toolbar-erase"]').trigger('click')
      expect(wrapper.find('[data-testid="tool-erase"]').attributes('aria-pressed')).toBe('true')
      expect(wrapper.find('[data-testid="bottom-toolbar-erase"]').attributes('aria-pressed')).toBe('true')
    })

    it('picks a Palette color from its own popover, without opening the Drawer, and paints with it', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')

      await wrapper.find('[data-testid="bottom-toolbar-color"]').trigger('click')
      await wrapper.find('[data-testid="bottom-toolbar"] [data-color-id="red"]').trigger('click')

      expect(wrapper.find('[data-testid="drawer-open-button"]').attributes('aria-pressed')).toBe('false')
      expect(wrapper.find('[data-testid="bottom-toolbar"] [data-testid="palette-picker"]').exists()).toBe(false)

      await pressBead(wrapper, 0)
      await wrapper.find('.app-shell').trigger('mouseup')
      expect(drawnPattern(wrapper).grid[0]![0]!.color).toBe(findPaletteColor('red')!.hex)
    })

    it('undoes and redoes the same history the Toolbox\'s own buttons use', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')
      await pressBead(wrapper, 0)
      await wrapper.find('.app-shell').trigger('mouseup')
      expect(drawnPattern(wrapper).grid[0]![0]!.color).not.toBeNull()

      await wrapper.find('[data-testid="bottom-toolbar-undo"]').trigger('click')
      expect(drawnPattern(wrapper).grid[0]![0]!.color).toBeNull()

      await wrapper.find('[data-testid="bottom-toolbar-redo"]').trigger('click')
      expect(drawnPattern(wrapper).grid[0]![0]!.color).not.toBeNull()
    })
  })

  describe('the header menu', () => {
    it('holds Import a file, Import QR code, Language, Theme and Name on exports', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')

      await wrapper.find('[data-testid="header-menu"]').trigger('click')
      expect(wrapper.find('[data-testid="menu-import-file"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="menu-import-qr"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="menu-item-name-on-exports-change"]').exists()).toBe(true)
    })

    it('imports through its own PatternImport, which shows the result as a toast rather than inline', async () => {
      const wrapper = mount(App)
      const patterns = [createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 9, height: 9, unit: 'mm' }, name: 'Fox' })]

      await wrapper.find('[data-testid="header-menu"]').trigger('click')
      const input = wrapper.find<HTMLInputElement>('[data-testid="menu-import-file"]')
      Object.defineProperty(input.element, 'files', {
        configurable: true,
        value: [new File([serializeLibrary(patterns)], 'import.json', { type: 'application/json' })],
      })
      await input.trigger('change')
      await flushPromises()

      expect(wrapper.find('[data-testid="import-result"]').exists()).toBe(false)
      const toast = wrapper.find('[data-testid="toast-region"] [data-testid="import-file"]')
      expect(toast.exists()).toBe(true)
      expect(toast.text()).toContain('Patterns imported: 1')
    })
  })

  describe('the ContextBar', () => {
    it('shows Copy, Rotate, Remove line and a clear x for a Selection, wired to the same actions as the Toolbox', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '3', '30') // 2 columns, so a 2-cell drag along a row is the whole line
      await wrapper.find('[data-testid="tool-select"]').trigger('click')
      await drag(wrapper, [0, 1]) // a 1x2 row selection

      expect(wrapper.find('[data-testid="context-bar-size"]').text()).toBe('2×1')
      expect(wrapper.find('[data-testid="context-bar-remove-line"]').attributes('disabled')).toBeUndefined()

      await wrapper.find('[data-testid="context-bar-copy"]').trigger('click')
      // Copying clears the Selection and arms the clipboard -- the bar switches to its "Tap where to paste" state.
      expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="context-bar-hint"]').text()).toBe('Tap where to paste')

      await wrapper.find('[data-testid="context-bar-cancel"]').trigger('click')
      expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
    })

    it('removes the selected line through the same command Toolbox\'s Remove line link uses', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '3', '30')
      await wrapper.find('[data-testid="tool-select"]').trigger('click')
      await drag(wrapper, [0, 1])

      const before = selectedBeadCount(wrapper)
      expect(before).toBeGreaterThan(0)

      await wrapper.find('[data-testid="context-bar-remove-line"]').trigger('click')
      // A removed line shifts the grid up by one row; the Selection no longer applies (cleared by the command).
      expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
    })

    it('clears the Selection on the clear x without erasing anything', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '3', '30')
      await wrapper.find('[data-testid="tool-select"]').trigger('click')
      await drag(wrapper, [0, 1])

      await wrapper.find('[data-testid="context-bar-clear"]').trigger('click')
      expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
      expect(selectedBeadCount(wrapper)).toBe(0)
    })
  })
})
