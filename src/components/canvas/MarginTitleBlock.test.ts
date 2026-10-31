import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import MarginTitleBlock from './MarginTitleBlock.vue'
import { createProject } from '../../domain/createProject'
import { createPalette, defaultPaletteIds } from '../../domain/palette'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { paintAt } from '../../testUtils/layers'
import { choosePanelOption } from '../../testUtils/choosePanelOption'
import { frameOf } from '../../domain/layerRecord'
import { type LayersChange, withLayers } from '../../testUtils/layerFields'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

function framed(extra: LayersChange = {}): Project {
  const project = createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 10, height: 10, unit: 'beads' } })
  return withLayers(project, { frame: { technique: 'loom', row: 0, column: 0, rows: 11, columns: 40, beads: {} }, ...extra })
}

/** The Frame with its first `count` beads painted each in the next Palette color. */
function painted(count: number): Project {
  const colors = createPalette(defaultPaletteIds()).colors.slice(0, count).map((color) => color.hex)
  return colors.reduce((project, color, column) => paintAt(project, [{ row: 0, column }], color), framed())
}

const mountBlock = (project: Project) => mount(MarginTitleBlock, { props: { project }, attachTo: document.body })
const text = (wrapper: ReturnType<typeof mountBlock>, testid: string) => wrapper.get(`[data-testid="${testid}"]`).text()

describe('the margin\'s title block (MarginSheet card, ticket 0657)', () => {
  it('shows the Frame\'s name, its Technique and "by" the maker, then its size in beads and in cm', () => {
    const wrapper = mountBlock(framed({ makerName: 'Ada', frame: { ...frameOf(framed())!, name: 'Sun band' } }))
    expect(text(wrapper, 'margin-frame-name')).toBe('Sun band')
    expect(text(wrapper, 'margin-technique')).toBe('Loom')
    expect(wrapper.get('.margin-title__maker .margin-title__meta').text()).toBe('by')
    expect(text(wrapper, 'margin-maker')).toBe('Ada')
    expect(text(wrapper, 'margin-size')).toBe('40 × 11')
    expect(text(wrapper, 'margin-estimate')).toBe('≈ 6.0 × 1.7 cm')
  })

  it('invites a name and a maker while they are empty', () => {
    const wrapper = mountBlock(framed())
    expect(text(wrapper, 'margin-frame-name')).toBe('Name this frame')
    expect(text(wrapper, 'margin-maker')).toBe('Your name')
  })

  it('edits the name in place with its counter, saving on Enter and leaving it on Escape', async () => {
    const wrapper = mountBlock(framed())
    await wrapper.get('[data-testid="margin-frame-name-edit"]').trigger('click')
    expect(wrapper.get('[data-testid="margin-frame-name-form"]').text()).toContain('0/40')
    await wrapper.get('[data-testid="margin-frame-name-input"]').setValue('  Sun band ')
    await wrapper.get('[data-testid="margin-frame-name-form"]').trigger('submit')
    expect(wrapper.emitted('rename')).toEqual([['Sun band']])

    await wrapper.get('[data-testid="margin-frame-name-edit"]').trigger('click')
    await wrapper.get('[data-testid="margin-frame-name-input"]').setValue('Moon')
    await wrapper.get('[data-testid="margin-frame-name-form"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-testid="margin-frame-name-form"]').exists()).toBe(false)
    expect(wrapper.emitted('rename')).toHaveLength(1)
  })

  it('saves the maker\'s name, the Project\'s Name on exports', async () => {
    const wrapper = mountBlock(framed())
    await wrapper.get('[data-testid="margin-maker-edit"]').trigger('click')
    await wrapper.get('[data-testid="margin-maker-input"]').setValue('Ada')
    await wrapper.get('[data-testid="margin-maker-form"]').trigger('submit')
    expect(wrapper.emitted('save-maker-name')).toEqual([['Ada']])
  })

  it('changes the Technique with the Project\'s picker, behind a pencil named Change Technique', async () => {
    const wrapper = mountBlock(framed())
    const pencil = wrapper.get('[data-testid="margin-technique-picker"] button[aria-haspopup]')
    expect(pencil.attributes('aria-label')).toBe('Change Technique: Loom')
    await choosePanelOption(wrapper, 'margin-technique-picker', 'peyote')
    expect(wrapper.emitted('set-technique')).toEqual([['peyote']])
  })

  it('locks the Technique once a row is done, saying why', async () => {
    const wrapper = mountBlock(moveToRow(framed(), 1))
    const pencil = wrapper.get('[data-testid="margin-technique-picker"] button[aria-haspopup]')
    expect(pencil.attributes('aria-disabled')).toBe('true')
    await pencil.trigger('click')
    expect(wrapper.find('[role="menuitemradio"]').exists()).toBe(false)
  })

  it('letters its legend with each color\'s Swatch letter, at most 8, then "+n"', () => {
    const few = mountBlock(painted(3))
    expect(few.findAll('.margin-title__disc').map((disc) => disc.text())).toEqual(['A', 'B', 'C'])
    expect(few.find('[data-testid="margin-legend-more"]').exists()).toBe(false)

    const many = mountBlock(painted(10))
    expect(many.findAll('.margin-title__disc')).toHaveLength(8)
    expect(text(many, 'margin-legend-more')).toBe('+2')
  })

  describe('its Technique\'s settings, each a cell from the Technique\'s description (ticket 0698)', () => {
    const woven = (technique: 'brick' | 'peyote', techniqueSettings: Record<string, number> = {}) =>
      framed({ frame: { ...frameOf(framed())!, technique, techniqueSettings } })

    it('shows brick stitch\'s and peyote\'s Drop in short beside the Technique, at every value, and loom none', () => {
      expect(text(mountBlock(woven('brick', { brickDrop: 2 })), 'margin-brick-drop-short')).toBe('2-drop')
      expect(text(mountBlock(woven('peyote')), 'margin-peyote-drop-short')).toBe('1-drop')
      expect(mountBlock(framed()).find('.margin-setting').exists()).toBe(false)
    })

    it('opens the panels\' stepper from its pencil, each step asked at once, and closes on Escape', async () => {
      const wrapper = mountBlock(woven('brick', { brickDrop: 2 }))
      const pencil = wrapper.get('[data-testid="margin-brick-drop-edit"]')
      expect(pencil.attributes('aria-label')).toBe('Change Drop')
      await pencil.trigger('click')
      await wrapper.get('[data-testid="margin-brick-drop-stepper-more"]').trigger('click')
      expect(wrapper.emitted('set-setting')).toEqual([['brickDrop', 3]])
      await wrapper.get('[data-testid="margin-brick-drop-popover"]').trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('[data-testid="margin-brick-drop-popover"]').exists()).toBe(false)
    })

    it('is locked with the Technique once a row is done, saying why', async () => {
      const wrapper = mountBlock(moveToRow(woven('peyote'), 1))
      const pencil = wrapper.get('[data-testid="margin-peyote-drop-edit"]')
      expect(pencil.attributes('aria-disabled')).toBe('true')
      await pencil.trigger('click')
      expect(wrapper.find('[data-testid="margin-peyote-drop-popover"]').exists()).toBe(false)
    })

    it('is read only in the compact block, which keeps the legend', () => {
      const wrapper = mount(MarginTitleBlock, { props: { project: woven('brick', { brickDrop: 3 }), form: 'compact' }, attachTo: document.body })
      expect(text(wrapper, 'margin-brick-drop-short')).toBe('3-drop')
      expect(wrapper.find('[data-testid="margin-brick-drop-edit"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="margin-legend"]').exists()).toBe(true)
    })
  })

  // Safari lays out a top-layer popup that sits inside the sheet's scale where it first showed (the top-left corner),
  // and a field there drops what is typed: every popup the block opens sits in the app shell, outside the scale.
  it.each([
    ['name field', '[data-testid="margin-frame-name-edit"]', '[data-testid="margin-frame-name-form"]'],
    ['maker field', '[data-testid="margin-maker-edit"]', '[data-testid="margin-maker-form"]'],
    ['Technique list', '[data-testid="margin-technique-picker"] button', '.panel-picker__list'],
    ['Drop stepper', '[data-testid="margin-brick-drop-edit"]', '[data-testid="margin-brick-drop-popover"]'],
  ] as const)('opens its %s in the app shell, outside the sheet\'s scale', async (_, pencil, popup) => {
    const shell = document.body.appendChild(document.createElement('div'))
    shell.className = 'app-shell'
    onTestFinished(() => shell.remove())
    const project = framed({ frame: { ...frameOf(framed())!, technique: 'brick', techniqueSettings: { brickDrop: 2 } } })
    const wrapper = mount(MarginTitleBlock, { props: { project }, attachTo: shell, global: { stubs: { teleport: false } } })
    await wrapper.get(pencil).trigger('click')
    await nextTick()
    expect(document.querySelector(popup)?.parentElement).toBe(shell)
  })

  it('turns Letters on and off, the Frame panel\'s setting', async () => {
    const wrapper = mountBlock(framed())
    const toggle = wrapper.get('[data-testid="margin-letters"]')
    expect(toggle.attributes('aria-checked')).toBe('false')
    await toggle.trigger('click')
    expect(wrapper.emitted('set-letters')).toEqual([[true]])
  })
})
