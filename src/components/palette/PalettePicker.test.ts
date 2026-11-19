import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import PalettePicker from './PalettePicker.vue'
import { BUILT_IN_COLORS, addedColorId, defaultPaletteIds } from '../../domain/palette'
import { ru } from '../../i18n/ru'
import { mountWithPalette } from '../../testUtils/paletteHost'
import { provideRecentColors } from '../../composables/tools/usePalette'
import { fillBlanks } from '../../domain/fillBlanks'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import type { ColorCatalog } from '../../domain/colorCatalog'

const added = addedColorId('#123456')

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

describe('PalettePicker', () => {
  it('renders one swatch per palette color', () => {
    const wrapper = mount(PalettePicker)

    expect(wrapper.findAll('[data-testid="palette-swatch"]')).toHaveLength(BUILT_IN_COLORS.length)
  })

  it('emits select with the clicked color id', async () => {
    const wrapper = mount(PalettePicker)

    await wrapper.find(`[data-color-id="${BUILT_IN_COLORS[2]!.id}"]`).trigger('click')

    expect(wrapper.emitted('select')).toEqual([[BUILT_IN_COLORS[2]!.id]])
  })

  it('marks the selected color as pressed', () => {
    const wrapper = mount(PalettePicker, { props: { selectedColorId: BUILT_IN_COLORS[0]!.id } })

    const selected = wrapper.find(`[data-color-id="${BUILT_IN_COLORS[0]!.id}"]`)
    const other = wrapper.find(`[data-color-id="${BUILT_IN_COLORS[1]!.id}"]`)

    expect(selected.attributes('aria-pressed')).toBe('true')
    expect(other.attributes('aria-pressed')).toBe('false')
  })

  it('names each swatch "Цвет N, {name}" for screen readers (accessibility.md, ticket 165; mounted standalone falls back to Russian)', () => {
    const wrapper = mount(PalettePicker)

    const swatches = wrapper.findAll('[data-testid="palette-swatch"]')
    BUILT_IN_COLORS.forEach((color, index) => {
      expect(swatches[index]!.attributes('aria-label')).toBe(`${ru.palette.colorLabel} ${index + 1}, ${ru.colorNames[color.id]}`)
    })
  })

  it("shows the Shift+key of the first seven swatches, 4…9 then 0, since Shift+1…3 are the recents (tickets 88, 333, 529)", async () => {
    const wrapper = mount(PalettePicker)
    const shortcuts = ['4', '5', '6', '7', '8', '9', '0']

    const tooltips = wrapper.findAll('.app-tooltip')
    for (const [index, tooltip] of tooltips.entries()) {
      await tooltip.trigger('pointerenter', { pointerType: 'mouse' })
      if (index < shortcuts.length) expect(tooltip.get('.app-tooltip__key').text()).toBe(`Shift+${shortcuts[index]}`)
      else expect(tooltip.find('.app-tooltip__key').exists()).toBe(false)
    }
  })

  it('keeps a recent color in its own slot, with its slot\'s Shift+key, and rings it (ticket 0865)', async () => {
    const recents = [BUILT_IN_COLORS[2]!.hex, BUILT_IN_COLORS[0]!.hex]
    const Host = defineComponent({
      setup() {
        provideRecentColors(ref(recents))
        return () => h(PalettePicker)
      },
    })
    const wrapper = mount(Host)

    const swatches = wrapper.findAll('[data-testid="palette-swatch"]')
    expect(swatches.map((swatch) => swatch.attributes('data-color-id'))).toEqual(BUILT_IN_COLORS.map((color) => color.id))
    expect(swatches.map((swatch) => swatch.classes('swatch__chip--recent'))).toEqual(BUILT_IN_COLORS.map((color) => recents.includes(color.hex)))
    const third = wrapper.findAll('.app-tooltip')[2]!
    await third.trigger('pointerenter', { pointerType: 'mouse' })
    expect(third.get('.app-tooltip__key').text()).toBe('Shift+6')
  })

  it('names the tooltip "Color" with the hex as its body (ticket 333)', async () => {
    const wrapper = mount(PalettePicker)
    const tooltip = wrapper.get('.app-tooltip')

    await tooltip.trigger('pointerenter', { pointerType: 'mouse' })

    expect(tooltip.get('.app-tooltip__name').text()).toBe(ru.palette.colorLabel)
    expect(tooltip.get('.app-tooltip__body').text()).toBe(BUILT_IN_COLORS[0]!.hex)
  })

  it('names a swatch picked from the Color catalog by its code and name, the hex in its Tooltip (ticket 0760)', async () => {
    const catalog: ColorCatalog = { id: 'toho', codes: [{ code: '49', family: ['Black'], finish: 'opaque', wording: 'Opaque', sizes: ['1.5mm'] }] }
    const beadColors = { catalog: ref(catalog), swatches: ref([]), load: vi.fn() } as unknown as BeadColors
    const { wrapper } = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added], {}, { codes: { '#123456': '49' }, beadColors })
    const swatch = wrapper.get(`[data-color-id="${added}"]`)
    const name = `49 ${ru.colorNames.black} · ${ru.palette.beadColors.finishes.opaque}`

    expect(swatch.attributes('aria-label')).toBe(name)
    expect(beadColors.load).toHaveBeenCalled()
    const tooltip = wrapper.findAll('.app-tooltip')[defaultPaletteIds().length]!
    await tooltip.trigger('pointerenter', { pointerType: 'mouse' })
    expect(tooltip.get('.app-tooltip__name').text()).toBe(name)
    expect(tooltip.get('.app-tooltip__body').text()).toBe('#123456')
  })

  it('marks a catalog swatch made from its family and Finish, and names it so; a plain color has no mark (ticket 0905)', () => {
    const catalog: ColorCatalog = { id: 'toho', codes: [{ code: '49', family: ['Black'], finish: 'opaque', wording: 'Opaque', sizes: ['1.5mm'] }] }
    const swatches = ref([{ code: '49', family: 'Black', finish: 'opaque', hex: '#123456', approximate: true, discontinued: false, taken: false }])
    const beadColors = { catalog: ref(catalog), swatches, load: vi.fn() } as unknown as BeadColors
    const { wrapper } = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added], {}, { codes: { '#123456': '49' }, beadColors })
    expect(wrapper.get(`[data-color-id="${added}"]`).classes()).toContain('swatch__chip--approximate')
    expect(wrapper.get(`[data-color-id="${added}"]`).attributes('aria-label')).toContain(ru.palette.beadColors.approximateSuffix)
    expect(wrapper.findAll('.swatch__chip--approximate')).toHaveLength(1)
  })

  describe('Edit palette (ticket 531)', () => {
    it('locks every built-in swatch: faded, aria-disabled, no select, still focusable', async () => {
      const wrapper = mount(PalettePicker, { props: { editing: true }, attachTo: document.body })
      const first = wrapper.get('[data-testid="palette-swatch"]')

      expect(first.attributes('aria-disabled')).toBe('true')
      expect(first.attributes('tabindex')).toBeDefined()
      await first.trigger('click')
      expect(wrapper.emitted('select')).toBeUndefined()
      expect(wrapper.findAll('.swatch--locked')).toHaveLength(BUILT_IN_COLORS.length)
      expect(wrapper.find('[data-testid="palette-swatch-remove"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('says why a built-in swatch is locked, as its description', async () => {
      const wrapper = mount(PalettePicker, { props: { editing: true } })
      await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })

      expect(wrapper.get('.app-tooltip__body').text()).toBe(ru.palette.defaultColorLocked)
    })

    it('leaves the swatches alone outside the mode', () => {
      const wrapper = mount(PalettePicker)

      expect(wrapper.find('[aria-disabled="true"]').exists()).toBe(false)
      expect(wrapper.find('.swatch--locked').exists()).toBe(false)
    })

    it('shows a × on an added swatch only in the mode, named for its hex, and a press asks to remove it (tickets 228, 304)', async () => {
      const outside = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added])
      expect(outside.wrapper.find('[data-testid="palette-swatch-remove"]').exists()).toBe(false)

      const { wrapper, requestRemove } = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added], { editing: true })
      expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(1)
      const swatch = wrapper.get(`[data-color-id="${added}"]`)
      expect(swatch.attributes('aria-label')).toBe(fillBlanks(ru.palette.removeSwatch, { hex: '#123456' }))
      await swatch.trigger('click')
      expect(requestRemove).toHaveBeenCalledWith(added)
      expect(wrapper.findComponent(PalettePicker).emitted('select')).toBeUndefined()
    })
  })

  it('asks to remove a focused added swatch on Delete or Backspace, and not a built-in one (ticket 228)', async () => {
    const { wrapper, requestRemove } = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added])

    await wrapper.get(`[data-color-id="${BUILT_IN_COLORS[0]!.id}"]`).trigger('keydown', { key: 'Delete' })
    expect(requestRemove).not.toHaveBeenCalled()
    await wrapper.get(`[data-color-id="${added}"]`).trigger('keydown', { key: 'Backspace' })
    expect(requestRemove).toHaveBeenCalledWith(added)
  })

  it('moves a swatch one slot with Alt+Right (ticket 398)', async () => {
    const { wrapper, harness } = mountWithPalette(PalettePicker, defaultPaletteIds(), {}, { attachTo: document.body })
    const [first, second, ...rest] = defaultPaletteIds()

    await wrapper.get(`[data-color-id="${first}"]`).trigger('keydown', { key: 'ArrowRight', altKey: true })
    expect(harness.project.palette).toEqual([second, first, ...rest])
    wrapper.unmount()
  })
})

describe('PalettePicker, Swatch letters (ticket 1092)', () => {
  const lettersOf = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[data-testid="palette-swatch-letter"]').map((letter) => letter.text())

  it('shows each swatch its letter while Letters is on, in its name too, and none where no letters are handed out', async () => {
    const shown = ref(false)
    const { wrapper } = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added], {}, { letters: shown })
    expect(lettersOf(wrapper)).toEqual([])

    shown.value = true
    await wrapper.vm.$nextTick()

    expect(lettersOf(wrapper).slice(0, 3)).toEqual(['A', 'B', 'C'])
    expect(wrapper.get('[data-testid="palette-swatch"]').attributes('aria-label')).toBe(fillBlanks(ru.palette.swatchLetter, { name: `${ru.palette.colorLabel} 1, ${ru.colorNames.black}`, letter: 'A' }))
    expect(lettersOf(mount(PalettePicker))).toEqual([])
  })

  it('in Edit palette puts a letter button under every swatch, the default ones too, and the × only on the added one', () => {
    const { wrapper } = mountWithPalette(PalettePicker, [...defaultPaletteIds(), added], { editing: true }, { letters: ref(true) })

    expect(wrapper.findAll('[data-testid="swatch-letter"]')).toHaveLength(BUILT_IN_COLORS.length + 1)
    expect(wrapper.findAll('[data-testid="palette-swatch-remove"]')).toHaveLength(1)
    // The letter is on its button, not on the swatch, whose × is the picture of what a press there does.
    expect(lettersOf(wrapper)).toEqual([])
    expect(wrapper.get('[data-testid="swatch-letter"]').attributes('aria-label')).toBe(fillBlanks(ru.palette.changeLetter, { letter: 'A', name: ru.colorNames.black }))
  })

  it('changes a letter typed into its button\'s field, in upper case, as one Edit', async () => {
    const { wrapper, harness } = mountWithPalette(PalettePicker, defaultPaletteIds(), { editing: true }, { letters: ref(false), attachTo: document.body })
    const black = BUILT_IN_COLORS[0]!.hex

    await wrapper.get('[data-testid="swatch-letter"]').trigger('click')
    await wrapper.get('[data-testid="swatch-letter-field"]').setValue('q7')
    await wrapper.get('.swatch-letter__form').trigger('submit')

    expect(harness.currentProject()!.paletteLetters![black]).toBe('Q')
    expect(wrapper.find('[data-testid="swatch-letter-field"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="palette-letter-swapped"]').exists()).toBe(false)
    harness.history.onUndo()
    expect(harness.currentProject()!.paletteLetters![black]).toBe('A')
    wrapper.unmount()
  })

  it('says which color got which letter after a trade, until the letters change again', async () => {
    const { wrapper, harness } = mountWithPalette(PalettePicker, defaultPaletteIds(), { editing: true }, { letters: ref(false), attachTo: document.body })

    await wrapper.findAll('[data-testid="swatch-letter"]')[1]!.trigger('click')
    await wrapper.get('[data-testid="swatch-letter-field"]').setValue('a')
    await wrapper.get('.swatch-letter__form').trigger('submit')

    expect(wrapper.get('[data-testid="palette-letter-swapped"]').text()).toBe(fillBlanks(ru.palette.letterSwapped, { name: ru.colorNames.white, letter: 'A', other: ru.colorNames.black, otherLetter: 'B' }))
    // The line is about the letters as they stand: Undo takes it away with the trade.
    harness.history.onUndo()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="palette-letter-swapped"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('saves what was typed when the field is left', async () => {
    const { wrapper, harness } = mountWithPalette(PalettePicker, defaultPaletteIds(), { editing: true }, { letters: ref(false), attachTo: document.body })

    await wrapper.get('[data-testid="swatch-letter"]').trigger('click')
    await wrapper.get('[data-testid="swatch-letter-field"]').setValue('m')
    await wrapper.get('[data-testid="swatch-letter-field"]').trigger('blur')

    expect(harness.currentProject()!.paletteLetters![BUILT_IN_COLORS[0]!.hex]).toBe('M')
    wrapper.unmount()
  })

  it('leaves the letter as it was on Escape, and keeps Edit palette on', async () => {
    const { wrapper, harness } = mountWithPalette(PalettePicker, defaultPaletteIds(), { editing: true }, { letters: ref(false), attachTo: document.body })

    await wrapper.get('[data-testid="swatch-letter"]').trigger('click')
    await wrapper.get('[data-testid="swatch-letter-field"]').setValue('z')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(harness.currentProject()!.paletteLetters![BUILT_IN_COLORS[0]!.hex]).toBe('A')
    expect(wrapper.findAll('[data-testid="swatch-letter"]')).toHaveLength(BUILT_IN_COLORS.length)
    wrapper.unmount()
  })
})
