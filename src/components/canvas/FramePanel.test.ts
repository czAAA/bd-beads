import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import FramePanel from './FramePanel.vue'
import PanelHost from '../shell/PanelHost.vue'
import { HOLD_DELAY_MS } from '../../composables/ui/useHoldRepeat'
import { createProject, moveToRow, type Project } from '../../domain/project'
import type { CustomFrameKindId } from '../../domain/frameKind'
import { changeFrame } from '../../domain/changeFrame'
import { COFFEE_URL } from '../../data/coffeeLink'
import { en } from '../../i18n/en'
import { PNG_DPI_BY_QUALITY, type ExportQuality } from '../../domain/exportQuality'
import { pngDpiFor } from '../../rendering/exportDpi'

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
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), frame: { ...frame, technique: 'loom' } }
}

/** The Project with its Canvas and its Frame woven in a Technique (ticket 492). */
function woven(project: Project, technique: Project['technique'], extra: { netSize?: number } = {}): Project {
  return { ...project, technique, ...extra, frame: project.frame && { ...project.frame, technique, ...extra } }
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


describe('FramePanel in Right-angle weave (ticket 482)', () => {
  const wovenBar = () => woven(framed({ row: 2, column: 3, rows: 7, columns: 5, beads: {} }), 'rightAngle')

  it('shows the size in Units: 4 across and 3 down for 5 columns and 7 rows', () => {
    const wrapper = mountBar(wovenBar())

    expect(wrapper.get('[data-testid="frame-panel-width"]').attributes('placeholder')).toBe('4')
    expect(wrapper.get('[data-testid="frame-panel-height"]').attributes('placeholder')).toBe('3')
    expect(wrapper.text()).toContain(en.frame.sizeUnitUnits)
  })

  it('takes a size typed in Units', async () => {
    const wrapper = mountBar(wovenBar())

    await wrapper.get('[data-testid="frame-panel-width"]').setValue('6')
    await wrapper.get('[data-testid="frame-panel-height"]').setValue('4')
    await wrapper.get('[data-testid="frame-panel-height"]').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('resize')).toEqual([[6, 4]])
  })
})

describe('FramePanel (ticket 473)', () => {
  it('shows the size as two empty fields with the current size as placeholders, then the unit, Rotate and Remove Frame', () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    const height = wrapper.get('[data-testid="frame-panel-height"]')
    expect([(width.element as HTMLInputElement).value, (height.element as HTMLInputElement).value]).toEqual(['', ''])
    expect([width.attributes('placeholder'), height.attributes('placeholder')]).toEqual(['5', '6'])
    expect(wrapper.text()).toContain('beads')
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
  })

  it('takes digits only, no zero, on Enter; an empty field keeps its side; the fields empty again', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    const height = wrapper.get('[data-testid="frame-panel-height"]')
    await width.setValue('2a0-')
    expect((width.element as HTMLInputElement).value).toBe('20')
    await height.setValue('0')
    expect((height.element as HTMLInputElement).value).toBe('')
    await width.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[20, 6]])
    expect((width.element as HTMLInputElement).value).toBe('')
    await height.setValue('12')
    await height.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[20, 6], [5, 12]])
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

  it('clears what was typed on Escape, and closes on the next', async () => {
    const wrapper = mountPanel()
    const width = wrapper.get('[data-testid="frame-panel-width"]')
    await width.setValue('9')
    ;(width.element as HTMLInputElement).focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect((width.element as HTMLInputElement).value).toBe('')
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

  it('turns the fields off, hides the edges and says why, and drops Rotate once a pass is done', () => {
    const wrapper = mountBar(moveToRow(framed(), 1))
    expect(wrapper.get('[data-testid="frame-panel-width"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-edge-top-out"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="frame-size-locked"]').text()).toBe(en.frame.sizeLockedLine)
  })

  it('does not offer Rotate in Netting (ticket 486)', () => {
    const net = woven(framed({ row: 2, column: 3, rows: 5, columns: 9, beads: {} }), 'netting', { netSize: 3 })
    const wrapper = mountBar(net)
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
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
    const named = mountBar({ ...framed(), frame: { ...framed().frame!, name: 'Moth wing' } })
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
    await wrapper.findAll('.panel-section__header')[1]!.trigger('click')
    expect(wrapper.findAll('[data-testid="frame-estimate"]')).toHaveLength(0)
    expect(wrapper.get('.panel-section__summary').text()).toMatch(/^5 × 6 · ≈ /)
  })

  it('asks for the Picture and the Printable chart, and waits while one is being made (ticket 555)', async () => {
    const wrapper = mountBar()
    await wrapper.get('[data-testid="export-png"]').trigger('click')
    await wrapper.get('[data-testid="export-pdf"]').trigger('click')
    expect(wrapper.emitted('export-png')).toHaveLength(1)
    expect(wrapper.emitted('export-pdf')).toHaveLength(1)
    await wrapper.setProps({ exporting: 'pdf' })
    expect(wrapper.get('[data-testid="export-png"]').attributes('aria-disabled')).toBe('true')
  })

  it('shows what each export gives in its value slot: the size and its count, or the extension with no Frame (ticket 0588)', async () => {
    const wrapper = mountBar()
    expect(wrapper.get('[data-testid="export-png"]').text()).toMatch(/PNG (≈ \d+\.\d MB|< 0\.1 MB) · 1 file$/)
    expect(wrapper.get('[data-testid="export-pdf"]').text()).toMatch(/PDF (≈ \d+\.\d MB|< 0\.1 MB) · 3 pages$/)
    // The PNG line follows the chosen stop; the PDF's does not.
    const lines = () => [wrapper.get('[data-testid="export-png"]').text(), wrapper.get('[data-testid="export-pdf"]').text()]
    const [medium, pdf] = lines()
    await wrapper.get('[data-testid="quality-stop-high"]').trigger('click')
    expect(lines()[0]).not.toBe(medium)
    expect(lines()[1]).toBe(pdf)

    const empty = mountBar({ ...framed(), frame: undefined })
    expect(empty.get('[data-testid="export-png"]').text()).toContain('.png')
    expect(empty.get('[data-testid="export-pdf"]').text()).toContain('.pdf')
  })

  it('offers Export quality with Medium chosen, remembers a pick on the device and waits while exporting (ticket 576)', async () => {
    const wrapper = mountBar()
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
    expect(mountBar().get('[data-testid="quality-chosen"]').text()).toBe(en.frame.qualityLow)
  })

  it('shows each stop’s dpi and the PNG and PDF sizes for the open Frame (tickets 571, 0583)', () => {
    const small = mountBar()
    expect(small.get('[data-testid="quality-detail-low"]').text()).toBe('150 DPI')
    expect(small.get('[data-testid="quality-detail-high"]').text()).toBe('450 DPI')
    expect(small.get('[data-testid="quality-stop-medium"]').text()).toMatch(/^Medium300 DPI(≈ \d+\.\d MB|< 0\.1 MB)$/)
    expect(small.get('[data-testid="quality-hint"]').attributes('aria-label')).toBe(en.frame.qualityHintLabel)
    expect(small.find('[data-testid="quality-reduced-info"]').exists()).toBe(false)
    expect(small.get('[data-testid="quality-range"]').attributes('aria-valuetext')).toMatch(/^Medium, 300 DPI, (≈ \d+\.\d MB|< 0\.1 MB)$/)

    // A Frame too large for any bead size to be reduced: the page is the same size, so there is no reduced stop.
    const large = mountBar({ ...framed(), frame: { ...framed().frame!, columns: 200, rows: 200 } })
    expect(large.get('[data-testid="quality-detail-high"]').text()).toBe('450 DPI')
    expect(large.find('[data-testid="quality-reduced-info"]').exists()).toBe(false)
  })

  it('says what High is when this device cannot draw a 450 dpi page, and shows that dpi on the stop (ticket 572)', () => {
    expect(mountBar().find('[data-testid="quality-pdf-capped"]').exists()).toBe(false)
    vi.mocked(pngDpiFor).mockImplementation((quality) => ({ low: 150, medium: 300, high: 300 })[quality])
    try {
      const wrapper = mountBar()
      expect(wrapper.get('[data-testid="quality-pdf-capped"]').text()).toBe(en.frame.qualityPdfCapped.replace('{n}', '300'))
      expect(wrapper.get('[data-testid="quality-detail-high"]').text()).toBe('300 DPI')
    } finally {
      vi.mocked(pngDpiFor).mockImplementation((quality) => PNG_DPI_BY_QUALITY[quality])
    }
  })

  it('ends the export section with a plain Buy me a coffee link to the Coffee link, in a new tab (ticket 560)', () => {
    const wrapper = mountBar()
    const link = wrapper.get('[data-testid="frame-coffee-link"]')
    expect(link.text()).toBe(en.frame.exportCoffeeLink)
    expect(link.attributes()).toMatchObject({ href: COFFEE_URL, target: '_blank', rel: 'noopener' })
    expect(wrapper.get('[data-testid="frame-coffee"]').text()).toContain(en.frame.exportCoffee)
  })

  it('leads with Export, then the size, and ends with Beads needed, its total in the header (tickets 555, 568)', () => {
    const wrapper = mountBar()
    const sections = wrapper.findAll('.panel-section')
    expect(sections.map((section) => section.get('.panel-section__label').text())).toEqual([en.panels.project.exportHeading, en.frame.sizeHeading, en.quantities.heading])
    expect(wrapper.find('[data-testid="export-needs-frame"]').exists()).toBe(false)
    expect(sections.at(-1)!.attributes('data-testid')).toBe('bead-quantities')
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

  it('holds Replace Frame still once a pass is done (ticket 0596)', () => {
    const wrapper = mountBar(moveToRow(framed(), 1))
    expect(wrapper.get('[data-testid="frame-replace-from-starter"]').attributes('aria-disabled')).toBe('true')
  })

  it('with no Frame offers Frame from starter, Select a frame and Fit, and only Export besides, off (tickets 555, 568)', async () => {
    const { frame: _frame, ...bare } = framed()
    const wrapper = mountBar(bare)
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(false)
    expect(wrapper.findAll('.panel-section').map((section) => section.get('.panel-section__label').text())).toEqual([en.panels.project.exportHeading])
    expect(wrapper.get('[data-testid="frame-select"]').text()).toContain(en.frame.selectAFrame)
    for (const id of ['export-png', 'export-pdf']) expect(wrapper.get(`[data-testid="${id}"]`).attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="export-needs-frame"]').text()).toBe(en.frame.exportNeedsFrame)
    await wrapper.get('[data-testid="export-png"]').trigger('click')
    expect(wrapper.emitted('export-png')).toBeUndefined()
    expect(wrapper.get('[data-testid="frame-none-line"]').text()).toBe(en.frame.noFrameLine)
    expect(wrapper.get('[data-testid="frame-from-starter"]').text()).toContain(en.frame.fromStarter)
    expect(wrapper.get('[data-testid="frame-fit"]').attributes('aria-disabled')).toBe('true')
  })

  it('with no Frame, Fit is on once something is drawn and asks the shell to fit (ticket 555)', async () => {
    const { frame: _frame, ...bare } = framed()
    const wrapper = mountBar({ ...bare, beads: { 1: { 1: '#ff0000' } } })
    await wrapper.get('[data-testid="frame-fit"]').trigger('click')
    expect(wrapper.emitted('fit')).toHaveLength(1)
  })

  it('asks the shell to select a frame, with or without a Frame, and not once a pass is done (ticket 568)', async () => {
    const { frame: _frame, ...bare } = framed()
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
  it('has a Letters switch, off by default, with a one-line explanation, and asks to turn it on', async () => {
    const panel = mountBar()
    const letters = panel.get('[data-testid="frame-letters"]')
    expect(letters.attributes('aria-checked')).toBe('false')
    expect(panel.get('[data-testid="frame-letters-line"]').text()).toBe(en.frame.lettersLine)
    await letters.trigger('click')
    expect(panel.emitted('set-letters')).toEqual([[true]])
  })

  it('shows it on when the Project has Letters on, and has no switch without a Frame', async () => {
    expect(mountBar({ ...framed(), letters: true }).get('[data-testid="frame-letters"]').attributes('aria-checked')).toBe('true')
    const { frame: _frame, ...bare } = framed()
    expect(mountBar(bare).find('[data-testid="frame-letters"]').exists()).toBe(false)
  })
})

describe('FramePanel Letters note (ticket 0574)', () => {
  it('says the Word chart is not available for a Technique without one, only while Letters is on', () => {
    const rightAngle = { ...framed(), technique: 'rightAngle' as const, frame: { ...framed().frame!, technique: 'rightAngle' as const } }
    expect(mountBar({ ...rightAngle, letters: true }).get('[data-testid="frame-letters-unavailable"]').text()).toBe(en.frame.lettersUnavailable)
    expect(mountBar(rightAngle).find('[data-testid="frame-letters-unavailable"]').exists()).toBe(false)
    expect(mountBar({ ...framed(), letters: true }).find('[data-testid="frame-letters-unavailable"]').exists()).toBe(false)
  })
})

describe('FramePanel with a Custom frame (ticket 0592)', () => {
  /** A Project with a Custom frame of a kind and size in place of its Frame. */
  function custom(kind: CustomFrameKindId, size: number, project = framed()): Project {
    const result = changeFrame(project, { custom: { kind, size, centre: { row: 10, column: 10 } } })
    if (result.kind !== 'changed') throw new Error(`expected a ${kind}`)
    return result.project
  }
  const triangle = (rounds = 4) => custom('triangle', rounds)

  it('sizes a Star and a Kaleidocycle by Part size and a Kite by Rows (ticket 0593)', () => {
    for (const [kind, size, words] of [
      ['star', 6, en.frame.sizeSettings.partSize],
      ['kaleidocycle', 9, en.frame.sizeSettings.partSize],
      ['kite', 21, en.frame.sizeSettings.rows],
    ] as const) {
      const wrapper = mountBar(custom(kind, size))
      const name = kind === 'kite' ? 'rows' : 'partSize'
      expect(wrapper.get(`[data-testid="frame-setting-${name}"]`).text()).toContain(words.label)
      expect(wrapper.get(`[data-testid="frame-setting-${name}-value"]`).text()).toBe(String(size))
      expect(wrapper.get(`[data-testid="frame-setting-${name}-less"]`).attributes('aria-label')).toBe(words.less)
    }
  })

  it('offers a Fringe earring\'s Top width, Top rows and Fringe length, and its Fringe style (ticket 0597)', async () => {
    const result = changeFrame(framed(), { custom: { kind: 'fringeEarring', settings: { topWidth: 7, topRows: 6, fringeStyle: 'v', fringeLength: 12 }, centre: { row: 10, column: 10 } } })
    if (result.kind !== 'changed') throw new Error('expected an earring')
    const wrapper = mountBar(result.project)
    expect(['topWidth', 'topRows', 'fringeLength'].map((name) => wrapper.get(`[data-testid="frame-setting-${name}-value"]`).text())).toEqual(['7', '6', '12'])
    // Top rows stop one short of Top width, so the top ends on a pair.
    expect(wrapper.get('[data-testid="frame-setting-topRows-more"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="frame-fringe-style"]').text()).toContain(en.starters.picks.fringeStyle.options.straight)
    await wrapper.get('[data-testid="frame-setting-fringeLength-more"]').trigger('click')
    await wrapper.get('[data-testid="frame-fringe-style"] [data-value="straight"]').trigger('click')
    expect(wrapper.emitted('set-settings')).toEqual([[{ fringeLength: 13 }], [{ fringeStyle: 'straight' }]])
  })

  it('shows Rounds in place of Width and Height, Rotate Frame (ticket 0594) and no Select a frame', async () => {
    const wrapper = mountBar(triangle(4))
    expect(wrapper.find('[data-testid="frame-panel-width"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="frame-setting-rounds-value"]').text()).toBe('4')
    await wrapper.get('[data-testid="frame-setting-rounds-more"]').trigger('click')
    expect(wrapper.emitted('set-settings')).toEqual([[{ rounds: 5 }]])
  })
})
