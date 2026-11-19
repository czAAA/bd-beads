import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import FramePanel from './FramePanel.vue'
import { rotateFrame } from '../../domain/rotate'
import PanelHost from '../shell/PanelHost.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import InfoButton from '../ui/InfoButton.vue'
import { HOLD_DELAY_MS } from '../../composables/ui/useHoldRepeat'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import type { FrameShapeId } from '../../domain/frameShape'
import { changeFrame } from '../../domain/changeFrame'
import { en } from '../../i18n/en'
import { PNG_DPI_BY_QUALITY, type ExportQuality } from '../../domain/exportQuality'
import { pngDpiFor } from '../../rendering/exportDpi'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameOf, withFrameSheet } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'
import { withProjectName } from '../../domain/projectName'
import { usePanelSection } from '../../composables/shell/usePanelSection'

vi.mock('../../rendering/exportDpi', () => ({ pngDpiFor: vi.fn((quality: ExportQuality) => PNG_DPI_BY_QUALITY[quality]), pdfPageDpi: vi.fn(() => 300) }))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function framed(frame: { row: number; column: number; rows: number; columns: number; beads: Record<number, Record<number, string>> } = { row: 2, column: 3, rows: 6, columns: 5, beads: {} }): Project {
  return withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), { frame: { ...frame, technique: 'loom' } })
}

function mountBar(project = framed()) {
  return mount(FramePanel, { props: { project }, attachTo: document.body })
}

/** The bar in the panel AppPanels mounts it in (ticket 511): the panel's Escape and press-outside close it. */
function mountPanel(project = framed()) {
  return mount(
    { render: () => h(PanelHost, { open: 'frame', only: ['frame'] }, { default: () => h(FramePanel, { project }) }) },
    { attachTo: document.body },
  )
}
const closed = (wrapper: ReturnType<typeof mountPanel>) => wrapper.findComponent(PanelHost).emitted('close')

/** The bar with Export quality unfolded, as it shows folded (ticket 1121). */
async function mountWithExport(project = framed()) {
  const wrapper = mountBar(project)
  await wrapper.get('[data-testid="frame-export"] [data-testid="quality-fold"]').trigger('click')
  // The File size estimates' print code comes after the rows (ticket 0991).
  await vi.dynamicImportSettled()
  await flushPromises()
  return wrapper
}


describe('FramePanel (ticket 473)', () => {
  it('shows the size as the two fields\' values, then the unit, Rotate and Remove Frame (ticket 0854)', () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    const height = wrapper.get('[data-testid="frame-panel-height"]')
    expect([(width.element as HTMLInputElement).value, (height.element as HTMLInputElement).value]).toEqual(['5', '6'])
    expect(wrapper.text()).toContain('beads')
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
  })

  it('takes digits only, no zero, on Enter; an empty field keeps its side, its placeholder still the size', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    const height = wrapper.get('[data-testid="frame-panel-height"]')
    await width.setValue('2a0-')
    expect((width.element as HTMLInputElement).value).toBe('20')
    await height.setValue('0')
    expect((height.element as HTMLInputElement).value).toBe('')
    expect(height.attributes('placeholder')).toBe('6')
    await width.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[20, 6]])
    expect((width.element as HTMLInputElement).value).toBe('5')
    await height.setValue('12')
    await height.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[20, 6], [5, 12]])
  })

  it('drops a fraction and shows the range under a refused field, which goes with its next valid entry (ticket 0978)', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    const range = () => wrapper.find('[data-testid="frame-width-range"]')
    expect(width.attributes('aria-invalid')).toBeUndefined()
    await width.setValue('12.5')
    expect((width.element as HTMLInputElement).value).toBe('12')
    expect(range().text()).toBe('Width is 4 to 999 beads')
    expect(range().attributes('role')).toBe('alert')
    expect(width.attributes('aria-invalid')).toBe('true')
    expect(width.attributes('aria-describedby')).toBe(range().attributes('id'))
    await width.setValue('5000')
    expect((width.element as HTMLInputElement).value).toBe('500')
    expect(range().exists()).toBe(true)
    await width.setValue('50')
    expect(range().exists()).toBe(false)
    expect(width.attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-height-range"]').exists()).toBe(false)
  })

  it('refuses ".", "," and "-" at the key, and the digits after a point, until the caret moves (ticket 0978)', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    const input = width.element as HTMLInputElement
    const type = (data: string) => {
      const event = new InputEvent('beforeinput', { data, inputType: 'insertText', cancelable: true })
      input.dispatchEvent(event)
      return event.defaultPrevented
    }
    input.value = '12'
    input.setSelectionRange(2, 2)
    expect(type('-')).toBe(true)
    await flushPromises()
    expect(wrapper.find('[data-testid="frame-width-range"]').exists()).toBe(true)
    expect(type('.')).toBe(true)
    expect(type('5')).toBe(true)
    await width.trigger('keydown', { key: 'Unidentified' })
    expect(type('5')).toBe(true)
    await width.trigger('keydown', { key: 'ArrowLeft' })
    expect(type('5')).toBe(false)
    expect(type(',')).toBe(true)
    input.value = '500'
    input.setSelectionRange(3, 3)
    await width.trigger('keydown', { key: 'End' })
    expect(type('0')).toBe(true)
    input.setSelectionRange(0, 3)
    expect(type('7')).toBe(false)
  })

  it('shows the range when a typed number is brought into it, and Escape takes the line away (ticket 0978)', async () => {
    const wrapper = mountPanel()
    const height = wrapper.get('[data-testid="frame-panel-height"]')
    await height.setValue('1')
    await height.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[data-testid="frame-height-range"]').text()).toBe('Height is 4 to 999 beads')
    await height.setValue('2')
    ;(height.element as HTMLInputElement).focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[data-testid="frame-height-range"]').exists()).toBe(false)
  })

  it('reads the line again when a refusal comes again (ticket 0995)', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    await width.setValue('1a')
    const first = wrapper.get('[data-testid="frame-width-range"]').element
    await width.setValue('1b')
    expect(wrapper.get('[data-testid="frame-width-range"]').element).not.toBe(first)
  })

  it('takes the size when focus leaves both fields, not when it moves between them, and ignores the size it has', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    const height = wrapper.get('[data-testid="frame-panel-height"]')
    await width.setValue('9')
    await width.trigger('focusout', { relatedTarget: height.element })
    expect(wrapper.emitted('resize')).toBeUndefined()
    await height.setValue('6')
    await height.trigger('focusout')
    expect(wrapper.emitted('resize')).toEqual([[9, 6]])
    await width.setValue('5')
    await width.trigger('focusout')
    expect(wrapper.emitted('resize')).toHaveLength(1)
  })

  it('puts the size back on Escape, and closes on the next', async () => {
    const wrapper = mountPanel()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    await width.setValue('9')
    ;(width.element as HTMLInputElement).focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect((width.element as HTMLInputElement).value).toBe('5')
    expect(closed(wrapper)).toBeUndefined()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closed(wrapper)).toHaveLength(1)
  })

  it('has the edge cells in the order Top, Bottom, Left, Right, each with − first and + second', () => {
    const wrapper = mountBar()
    const cells = wrapper.findAll('.frame-panel__cell')
    expect(cells.map((cell) => cell.get('.frame-panel__edge-name').text())).toEqual([en.frame.edgeName.top, en.frame.edgeName.bottom, en.frame.edgeName.left, en.frame.edgeName.right])
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      const out = wrapper.get(`[data-testid="frame-edge-${edge}-out"]`)
      const inward = wrapper.get(`[data-testid="frame-edge-${edge}-in"]`)
      expect(out.attributes('aria-label')).toBe(en.frame.edgeOut[edge])
      expect(inward.attributes('aria-label')).toBe(en.frame.edgeIn[edge])
      expect(inward.text()).toBe('−')
      expect(out.text()).toBe('+')
      expect(inward.element.compareDocumentPosition(out.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('emits the edge and a bead out (1) or in (-1), and lights the last edge stepped', async () => {
    const wrapper = mountBar()
    await wrapper.get('[data-testid="frame-edge-left-out"]').trigger('click')
    await wrapper.get('[data-testid="frame-edge-top-in"]').trigger('click')
    expect(wrapper.emitted('step')).toEqual([['left', 1], ['top', -1]])
    expect(wrapper.get('[data-testid="frame-panel-cell-top"] .frame-panel__glyph').classes()).toContain('frame-panel__glyph--last')
    expect(wrapper.get('[data-testid="frame-panel-cell-left"] .frame-panel__glyph').classes()).not.toContain('frame-panel__glyph--last')
  })

  it('disables the − at four beads with the reason, and a press is no step', async () => {
    const wrapper = mountBar(framed({ row: 2, column: 3, rows: 4, columns: 5, beads: {} }))
    const shrink = wrapper.get('[data-testid="frame-edge-bottom-in"]')
    expect(shrink.attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="frame-edge-bottom-out"]').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="frame-edge-left-in"]').attributes('aria-disabled')).toBeUndefined()
    await shrink.trigger('click')
    expect(wrapper.emitted('step')).toBeUndefined()
  })

  it('repeats a held press until it is let go', async () => {
    vi.useFakeTimers()
    const wrapper = mountBar()
    const grow = wrapper.get('[data-testid="frame-edge-right-out"]')
    await grow.trigger('pointerdown', { button: 0, pointerId: 1 })
    expect(wrapper.emitted('step')).toHaveLength(1)
    vi.advanceTimersByTime(HOLD_DELAY_MS + 400)
    expect(wrapper.emitted('step')!.length).toBeGreaterThan(2)
    await grow.trigger('pointerup', { pointerId: 1 })
    const count = wrapper.emitted('step')!.length
    vi.advanceTimersByTime(1000)
    expect(wrapper.emitted('step')).toHaveLength(count)
  })

  it('turns the fields off, hides the edges and says why once a pass is done, and keeps Rotate Frame (ticket 0647)', () => {
    const wrapper = mountBar(moveToRow(framed(), 1))
    expect(wrapper.get('[data-testid="frame-panel-width"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="frame-rotate"]').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-edge-top-out"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="frame-size-locked"]').text()).toBe(en.frame.sizeLockedLine)
  })

  it('offers Reset progress beside the line saying rows are marked done, which asks the shell (ticket 0848)', async () => {
    const wrapper = mountBar(moveToRow(framed(), 1))
    const reset = wrapper.get('[data-testid="frame-size-locked-reset"]')
    expect(reset.text()).toBe(en.rowProgress.resetButton)
    await reset.trigger('click')
    expect(wrapper.emitted('reset-progress')).toHaveLength(1)
  })

  it('shows a turned Frame\'s size as seen and resizes it as seen, with Rotate Frame kept (tickets 0667, 1016)', async () => {
    const wrapper = mountBar(rotateFrame(framed())!)
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    expect((width.element as HTMLInputElement).value).toBe('6')
    expect((wrapper.get('[data-testid="frame-panel-height"]').element as HTMLInputElement).value).toBe('5')
    expect(width.attributes('disabled')).toBeUndefined()
    await width.setValue('8')
    await width.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[8, 5]])
    await wrapper.get('[data-testid="frame-edge-top-out"]').trigger('click')
    expect(wrapper.emitted('step')).toEqual([['top', 1]])
    expect(wrapper.get('[data-testid="frame-rotate"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('asks its parent to remove and rotate, and passes keys up', async () => {
    const wrapper = mountBar()
    await wrapper.get('[data-testid="frame-rotate"]').trigger('click')
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="frame-edge-top-out"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('rotate')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.emitted('key')).toHaveLength(1)
  })

  it('opens without a field focused, so a tablet\'s keyboard stays down (ticket 510)', async () => {
    const wrapper = mountBar()
    await flushPromises()
    expect(document.activeElement?.tagName).not.toBe('INPUT')
    expect(wrapper.find('[data-testid="frame-panel"]').exists()).toBe(true)
  })

  it('closes on a press outside, the Frame\'s handles included (tickets 475, 510)', async () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="outside"></button>')
    const wrapper = mountPanel()
    await flushPromises()
    document.getElementById('outside')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    expect(closed(wrapper)).toHaveLength(1)
  })

  it('names the Frame in place: an empty name invites one, Save emits it, an empty one clears (ticket 555)', async () => {
    const wrapper = mountBar()
    expect(wrapper.get('[data-testid="frame-name-add"]').text()).toBe(en.frame.nameEmpty)
    await wrapper.get('[data-testid="frame-name-add"]').trigger('click')
    await wrapper.get('[data-testid="frame-name-input"]').setValue('  Moth wing ')
    await wrapper.get('[data-testid="frame-name-save"]').trigger('click')
    expect(wrapper.emitted('rename')).toEqual([['Moth wing']])
    const named = mountBar(withLayers(framed(), { frame: { ...frameOf(framed())!, name: 'Moth wing' } }))
    expect(named.get('[data-testid="frame-name"]').text()).toBe('Moth wing')
    await named.get('[data-testid="frame-name-edit"]').trigger('click')
    await named.get('[data-testid="frame-name-input"]').setValue('')
    await named.get('[data-testid="frame-name-save"]').trigger('click')
    expect(named.emitted('rename')).toEqual([['']])
  })

  it('shows the Estimated size with its Tooltip, and a summary when the size section is folded (ticket 555)', async () => {
    const wrapper = mountBar()
    expect(wrapper.get('[data-testid="frame-estimate"]').text()).toContain('≈')
    expect(wrapper.get('[data-testid="frame-estimate-info"]').attributes('aria-label')).toBe(en.size.estimateLabel)
    expect(wrapper.text()).toContain(en.frame.estimateInfo)
    await wrapper.findAll('.panel-section__header').find((header) => header.get('.panel-section__label').text() === en.frame.sizeHeading)!.trigger('click')
    expect(wrapper.findAll('[data-testid="frame-estimate"]')).toHaveLength(0)
    expect(wrapper.get('.panel-section__summary').text()).toMatch(/^5 × 6 · ≈ /)
  })

  it('gives the Estimated size in the unit the margin gives it, cm from 10 mm up (ticket 0992)', () => {
    const wrapper = mountBar(framed({ row: 0, column: 0, rows: 30, columns: 40, beads: {} }))
    expect(wrapper.get('[data-testid="frame-estimate"] .frame-panel__estimate-value').text()).toBe('≈ 6.0 × 4.5 cm')
  })

  it('asks for the Picture and the Printable chart, and waits while one is being made (ticket 555)', async () => {
    const wrapper = await mountWithExport()
    await wrapper.get('[data-testid="export-png"]').trigger('click')
    await wrapper.get('[data-testid="export-pdf"]').trigger('click')
    expect(wrapper.emitted('export-png')).toHaveLength(1)
    expect(wrapper.emitted('export-pdf')).toHaveLength(1)
    await wrapper.setProps({ exporting: 'pdf' })
    expect(wrapper.get('[data-testid="export-png"]').attributes('aria-disabled')).toBe('true')
  })

  it('says what each export gives in its name and Tooltip: the size and its count (tickets 0588, 1121)', async () => {
    const wrapper = await mountWithExport()
    const name = (id: string) => wrapper.get(`[data-testid="${id}"]`).attributes('aria-label')
    expect(name('export-png')).toMatch(/PNG (≈ \d+\.\d MB|< 0\.1 MB) · 1 file$/)
    expect(name('export-pdf')).toMatch(/PDF (≈ \d+\.\d MB|< 0\.1 MB) · 1 page$/)
    // The PNG line follows the chosen stop; the PDF's does not.
    const lines = () => [name('export-png'), name('export-pdf')]
    const [medium, pdf] = lines()
    await wrapper.get('[data-testid="quality-stop-low"]').trigger('click')
    expect(lines()[0]).not.toBe(medium)
    expect(lines()[1]).toBe(pdf)
  })

  it('offers Export quality with Medium chosen, remembers a pick on the device and waits while exporting (ticket 576)', async () => {
    const wrapper = await mountWithExport()
    const range = wrapper.get<HTMLInputElement>('[data-testid="quality-range"]')
    expect(range.attributes('aria-label')).toBe(en.frame.exportQuality)
    expect(wrapper.get('[data-testid="quality-chosen"]').text()).toBe(en.frame.qualityMedium)
    expect(wrapper.findAll('[role="radio"] b').map((word) => word.text())).toEqual([en.frame.qualityLow, en.frame.qualityMedium, en.frame.qualityHigh])
    await wrapper.get('[data-testid="quality-stop-high"]').trigger('click')
    expect(wrapper.get('[data-testid="quality-chosen"]').text()).toBe(en.frame.qualityHigh)
    expect(localStorage.getItem('openbeads:export-quality')).toBe('high')
    await range.setValue(0)
    expect(wrapper.get('[data-testid="quality-chosen"]').text()).toBe(en.frame.qualityLow)
    await wrapper.setProps({ exporting: 'png' })
    expect(range.element.disabled).toBe(true)
    expect(wrapper.get('[data-testid="quality-stop-high"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
    expect((await mountWithExport()).get('[data-testid="quality-chosen"]').text()).toBe(en.frame.qualityLow)
  })

  it('captions each stop in words, keeps the dpi for the Info note and says the slider is for the picture (tickets 0583, 0957)', async () => {
    const small = await mountWithExport()
    expect(small.get('[data-testid="quality-detail-low"]').text()).toBe(en.frame.qualityLowCaption)
    expect(small.get('[data-testid="quality-detail-high"]').text()).toBe(en.frame.qualityHighCaption)
    expect(small.get('[data-testid="quality-stop-medium"]').text()).toBe(en.frame.qualityMedium + en.frame.qualityMediumCaption)
    expect(small.get('[data-testid="quality-hint"]').attributes('aria-label')).toBe(en.frame.qualityHintLabel)
    expect(small.find('[data-testid="quality-reduced-info"]').exists()).toBe(false)
    expect(small.get('[data-testid="quality-range"]').attributes('aria-valuetext')).toBe(`${en.frame.qualityMedium}, ${en.frame.qualityMediumCaption}`)
    expect(small.get('[role="radiogroup"]').text()).not.toContain('DPI')
  })

  it('says what High is when this device cannot draw a 450 dpi page, and gives that dpi in the Info note (tickets 572, 0957)', async () => {
    expect((await mountWithExport()).find('[data-testid="quality-pdf-capped"]').exists()).toBe(false)
    vi.mocked(pngDpiFor).mockImplementation((quality) => ({ low: 150, medium: 300, high: 300 })[quality])
    try {
      const wrapper = await mountWithExport()
      expect(wrapper.get('[data-testid="quality-pdf-capped"]').text()).toBe(fillBlanks(en.frame.qualityPdfCapped, { n: 300 }))
      expect(wrapper.get('[data-testid="quality-detail-high"]').text()).toBe(en.frame.qualityHighCaption)
      expect(wrapper.getComponent(InfoButton).props('body')).toBe(fillBlanks(en.frame.qualityHint, { low: 150, medium: 300, high: 300 }))
    } finally {
      vi.mocked(pngDpiFor).mockImplementation((quality) => PNG_DPI_BY_QUALITY[quality])
    }
  })

  it('has no Buy me a coffee line', () => {
    expect(mountBar().find('[data-testid="frame-coffee"]').exists()).toBe(false)
  })

  it('runs the name, Export, Beads needed, the size, its Layer settings, then the margin (tickets 0656, 0670, 0932)', () => {
    const wrapper = mountBar()
    const sections = wrapper.findAll('.panel-section')
    expect(sections.map((section) => section.get('.panel-section__label').text())).toEqual([
      en.panels.project.exportHeading,
      en.quantities.heading,
      en.frame.sizeHeading,
      en.layerSettings.frameHeading,
      en.frame.margin.heading,
    ])
    const order = ['frame-name-row', 'frame-export', 'bead-quantities']
    expect(wrapper.findAll('[data-testid]').map((node) => node.attributes('data-testid')).filter((id) => order.includes(id!))).toEqual(order)
    expect(wrapper.find('[data-testid="export-needs-frame"]').exists()).toBe(false)
    expect(sections.at(-1)!.attributes('data-testid')).toBe('margin-section')
  })

  it('shows Export always open, its heading with no fold (ticket 1121)', () => {
    const wrapper = mountBar()
    expect(wrapper.find('[data-testid="frame-export"] .panel-section__header').exists()).toBe(false)
    expect(wrapper.get('[data-testid="frame-export"] h3').text()).toBe(en.panels.project.exportHeading)
    expect(wrapper.find('[data-testid="export-png"]').exists()).toBe(true)
  })

  it('shows Beads needed\'s total on the title line once a bead is painted, as the section counts it (ticket 0932)', () => {
    expect(mountBar().find('[data-testid="frame-panel-total"]').exists()).toBe(false)
    const painted = mountBar(framed({ row: 2, column: 3, rows: 6, columns: 5, beads: { 2: { 3: '#ff0000', 4: '#ff0000' } } }))
    expect(painted.get('[data-testid="frame-panel-total"]').text()).toBe(painted.get('[data-testid="quantity-total"]').text())
    expect(painted.get('[data-testid="frame-panel-total"]').text()).toMatch(/^2 · ≈ /)
  })

  it("names the open Project on the title line, as typed, for where the strip shows no name (ticket 0986)", () => {
    const named = mountBar(withProjectName(framed(), 'Loom cuff'))
    expect(named.get('.frame-panel__title [data-testid="frame-panel-project"]').text()).toBe('· Loom cuff')
    expect(mountBar(withProjectName(withFrameSheet(framed(), undefined), 'Loom cuff')).get('[data-testid="frame-panel-project"]').text()).toBe('· Loom cuff')
  })

  it('sets the Frame in its Layer settings: each ask names the Frame, and its summary is its Technique and Bead (ticket 0670)', async () => {
    const wrapper = mountBar()
    const settings = wrapper.get('[data-testid="frame-layer-settings"]')
    await settings.get('[data-testid="frame-technique"] button').trigger('click')
    await settings.get('[data-testid="frame-technique"] [data-value="peyote"]').trigger('click')
    await settings.get('[data-testid="bead-brand"] button').trigger('click')
    await settings.get('[data-testid="bead-brand"] [data-value="miyuki"]').trigger('click')
    await settings.get('[data-testid="frame-background-section"] [data-testid="background-color-stone"]').trigger('click')
    expect(wrapper.emitted('set-technique')).toEqual([['frame', 'peyote']])
    expect(wrapper.emitted('replace-bead')?.[0]?.[0]).toBe('frame')
    expect(wrapper.emitted('set-background')).toEqual([['frame', 2]])
    const header = wrapper.findAll('.panel-section__header').find((each) => each.text().includes(en.layerSettings.frameHeading))!
    await header.trigger('click')
    expect(header.text()).toContain('Loom · TOHO Cube 1.5mm')
  })

  it('holds the Frame\'s Technique once a pass is done, never its Bead or Background (ticket 0670)', () => {
    const wrapper = mountBar(moveToRow(framed(), 1))
    expect(wrapper.get('[data-testid="frame-technique"] button').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="bead-size"] button').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-background-section"] [aria-disabled="true"]').exists()).toBe(false)
  })

  it('offers Replace Frame from the Starter gallery, one level deeper, and Back brings focus back to it (ticket 0596)', async () => {
    const wrapper = mountPanel()
    const row = wrapper.get('[data-testid="frame-replace-from-starter"]')
    expect(row.text()).toContain(en.frame.replaceFrame)
    ;(row.element as HTMLElement).focus()
    await row.trigger('click')
    expect(wrapper.get('[data-testid="panel-sub-title"]').text()).toBe(en.starters.title)
    await wrapper.get('[data-testid="panel-back"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="frame-replace-from-starter"]').element)
  })

  it('holds Replace Frame and Select a frame still once a pass is done, each Tooltip saying why (tickets 0596, 0848)', () => {
    const wrapper = mountBar(moveToRow(framed(), 1))
    expect(wrapper.get('[data-testid="frame-replace-from-starter"]').attributes('aria-disabled')).toBe('true')
    const tips = wrapper.findAllComponents(AppTooltip).map((tip) => tip.props())
    expect(tips).toContainEqual(expect.objectContaining({ name: en.frame.replaceFrame, disabled: true, disabledBody: en.tooltips.rowProgressLockedFrameFromStarter }))
    expect(tips).toContainEqual(expect.objectContaining({ name: en.frame.selectAFrame, disabled: true, disabledBody: en.tooltips.rowProgressLockedFrame }))
  })

  it('with no Frame offers Frame from starter, Select a Frame and Fit, and no export rows or slider (tickets 555, 568, 0847)', () => {
    const bare = withFrameSheet(framed(), undefined)
    const wrapper = mountBar(bare)
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(false)
    expect(wrapper.findAll('.panel-section')).toEqual([])
    expect(wrapper.get('[data-testid="frame-select"]').text()).toContain(en.frame.selectAFrame)
    for (const id of ['export-png', 'export-pdf', 'quality-range']) expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false)
    expect(wrapper.get('[data-testid="export-needs-frame"]').text()).toBe(en.frame.exportNeedsFrame)
    expect(wrapper.get('[data-testid="frame-none-line"]').text()).toBe(en.frame.noFrameLine)
    expect(wrapper.get('[data-testid="frame-from-starter"]').text()).toContain(en.frame.fromStarter)
    expect(wrapper.get('[data-testid="frame-fit"]').attributes('aria-disabled')).toBe('true')
  })

  it('with no Frame puts the ways to get one in order, headed by the line saying why (ticket 0650)', () => {
    const bare = withFrameSheet(framed(), undefined)
    const wrapper = mountBar(bare)
    const order = ['export-needs-frame', 'frame-from-starter', 'frame-select', 'frame-fit', 'frame-none-line']
    const inDomOrder = wrapper.findAll('[data-testid]').map((node) => node.attributes('data-testid')).filter((id) => order.includes(id!))
    expect(inDomOrder).toEqual(order)
  })

  it('with no Frame, Fit is on once something is drawn and asks the shell to fit (ticket 555)', async () => {
    const bare = withFrameSheet(framed(), undefined)
    const wrapper = mountBar(withLayers(bare, { beads: { 1: { 1: '#ff0000' } } }))
    await wrapper.get('[data-testid="frame-fit"]').trigger('click')
    expect(wrapper.emitted('fit')).toHaveLength(1)
  })

  it('asks the shell to select a frame, with or without a Frame, and not once a pass is done (ticket 568)', async () => {
    const bare = withFrameSheet(framed(), undefined)
    const without = mountBar(bare)
    await without.get('[data-testid="frame-select"]').trigger('click')
    expect(without.emitted('select-frame')).toHaveLength(1)

    const wrapper = mountBar()
    await wrapper.get('[data-testid="frame-select"]').trigger('click')
    expect(wrapper.emitted('select-frame')).toHaveLength(1)

    const started = mountBar({ ...moveToRow(framed(), 1) })
    expect(started.get('[data-testid="frame-select"]').attributes('aria-disabled')).toBe('true')
  })
})

describe('FramePanel Letters (ticket 0573)', () => {
  it('has a Letters switch, off by default, explained in an info button (ticket 0651), and asks to turn it on', async () => {
    const panel = await mountWithExport()
    const letters = panel.get('[data-testid="frame-letters"]')
    expect(letters.attributes('aria-checked')).toBe('false')
    expect(panel.find('[data-testid="frame-letters-line"]').exists()).toBe(false)
    expect(panel.get('[data-testid="frame-letters-info"]').attributes('aria-label')).toBe(en.frame.lettersInfoLabel)
    await letters.trigger('click')
    expect(panel.emitted('set-letters')).toEqual([[true]])
  })

  it('shows it on when the Project has Letters on, and has no switch without a Frame', async () => {
    expect((await mountWithExport(withLayers(framed(), { letters: true }))).get('[data-testid="frame-letters"]').attributes('aria-checked')).toBe('true')
    const bare = withFrameSheet(framed(), undefined)
    expect(mountBar(bare).find('[data-testid="frame-letters"]').exists()).toBe(false)
  })
})

describe('FramePanel with a Custom frame (ticket 0592)', () => {
  /** A Project with a Custom frame of a Frame shape and size in place of its Frame. */
  function custom(shape: FrameShapeId, size: number, project = framed()): Project {
    const result = changeFrame(project, { custom: { shape, size, centre: { row: 10, column: 10 } } })
    if (result.kind !== 'changed') throw new Error(`expected a ${shape}`)
    return result.project
  }
  const triangle = (rounds = 4) => custom('triangle', rounds)

  it('sizes a Star and a Kaleidocycle by Part size and a Kite by Rows (ticket 0593)', () => {
    for (const [shape, size, words] of [
      ['star', 6, en.frame.sizeSettings.partSize],
      ['kaleidocycle', 9, en.frame.sizeSettings.partSize],
      ['kite', 21, en.frame.sizeSettings.rows],
    ] as const) {
      const wrapper = mountBar(custom(shape, size))
      const name = shape === 'kite' ? 'rows' : 'partSize'
      expect(wrapper.get(`[data-testid="frame-setting-${name}"]`).text()).toContain(words.label)
      expect(wrapper.get(`[data-testid="frame-setting-${name}-value"]`).text()).toBe(String(size))
      expect(wrapper.get(`[data-testid="frame-setting-${name}-less"]`).attributes('aria-label')).toBe(words.less)
    }
  })

  it('offers a Fringe earring\'s Width, Top rows and Fringe length, and its Fringe style (tickets 0597, 0814)', async () => {
    const result = changeFrame(framed(), { custom: { shape: 'fringeEarring', settings: { topWidth: 7, topRows: 6, fringeStyle: 'v', fringeLength: 12 }, centre: { row: 10, column: 10 } } })
    if (result.kind !== 'changed') throw new Error('expected an earring')
    const wrapper = mountBar(result.project)
    expect(['topWidth', 'topRows', 'fringeLength'].map((name) => wrapper.get(`[data-testid="frame-setting-${name}-value"]`).text())).toEqual(['7', '6', '12'])
    // Top rows go on past the point into a body under it.
    expect(wrapper.get('[data-testid="frame-setting-topWidth"]').text()).toContain('Width')
    expect(wrapper.get('[data-testid="frame-setting-topRows-more"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="frame-fringe-style"]').text()).toContain(en.starters.picks.fringeStyle.options.straight)
    await wrapper.get('[data-testid="frame-setting-fringeLength-more"]').trigger('click')
    await wrapper.get('[data-testid="frame-fringe-style"] [data-value="straight"]').trigger('click')
    expect(wrapper.emitted('set-settings')).toEqual([[{ fringeLength: 13 }], [{ fringeStyle: 'straight' }]])
  })

  it('shows Rounds in place of Width and Height, Rotate Frame (ticket 0594) and no Select a Frame', async () => {
    const wrapper = mountBar(triangle(4))
    expect(wrapper.find('[data-testid="frame-panel-width"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="frame-setting-rounds-value"]').text()).toBe('4')
    await wrapper.get('[data-testid="frame-setting-rounds-more"]').trigger('click')
    expect(wrapper.emitted('set-settings')).toEqual([[{ rounds: 5 }]])
  })
})

describe('FramePanel opened on its settings (ticket 0935)', () => {
  function mountOnSettings(opensOnSettings: boolean) {
    return mount(
      { render: () => h(PanelHost, { open: 'frame', only: ['frame'] }, { default: () => h(FramePanel, { project: framed(), opensOnSettings }) }) },
      { attachTo: document.body },
    )
  }
  const settingsHeader = () => document.querySelector<HTMLElement>('[data-panel-entry] .panel-section__header')

  /** The settings section folded on this device, as a weaver may leave it. */
  function foldSettings() {
    const section = usePanelSection(() => 'frame:settings')
    if (section.open.value) section.toggle()
    expect(section.open.value).toBe(false)
  }

  it('unfolds its settings, folded on this device, and focuses their header, as Open Frame asks', async () => {
    foldSettings()
    const wrapper = mountOnSettings(true)
    await flushPromises()
    expect(wrapper.find('[data-testid="frame-layer-settings"]').exists()).toBe(true)
    expect(document.activeElement).toBe(settingsHeader())
    expect(settingsHeader()?.textContent).toContain(en.layerSettings.frameHeading)
  })

  it('opens at its top from the strip, its settings left as this device keeps them', async () => {
    foldSettings()
    const wrapper = mountOnSettings(false)
    await flushPromises()
    expect(wrapper.find('[data-testid="frame-layer-settings"]').exists()).toBe(false)
    expect(settingsHeader()).toBeNull()
  })
})
