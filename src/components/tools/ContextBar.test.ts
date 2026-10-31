import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ContextBar from './ContextBar.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import { paintAt } from '../../testUtils/layers'
import { withFrame } from '../../domain/frame'
import type { Selection } from '../../domain/selection'
import { en } from '../../i18n/en'
import AppMenuItem from '../ui/AppMenuItem.vue'
import { FakeResizeObserver } from '../../testUtils/fakeResizeObserver'
import { frameOf } from '../../domain/layerRecord'
import { MIRROR_OFF } from '../../domain/mirror'

const project = createProject({ technique: 'loom', beadId: BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!.id, size: { width: 15, height: 30, unit: 'mm' } })
const noFrame = withFrame(project, undefined)
const drawn = paintAt(noFrame, [{ row: 0, column: 0 }], '#e63746')
const selection = { top: 0, left: 0, rows: 2, columns: 2 }
const arm = () => vi.advanceTimersByTimeAsync(350)

describe('ContextBar', () => {
  beforeEach(() => {
    localStorage.setItem('openbeads:locale', 'en')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is absent with neither a Selection nor an armed paste', () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: false, canRemoveLine: false } })
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('has no standalone Select all with the Select tool and no Selection (ticket 439)', () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: false, canRemoveLine: false, selectActive: true } })
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('offers Select all first once there is a Selection, and it emits', async () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: false, canRemoveLine: false, selectActive: true, selectionSummary: '2×2' } })
    const first = wrapper.findAll('button[data-testid]')[0]!
    expect(first.attributes('data-testid')).toBe('context-bar-select-all')
    await arm()
    await first.trigger('click')
    expect(wrapper.emitted('select-all')).toHaveLength(1)
  })

  it('shows the size readout, then Copy, Cut, Fill, Frame, Rotate, Mirror and Clear selection, icon-only', async () => {
    const wrapper = mount(ContextBar, {
      props: { project: drawn, selection, selectionSummary: '3×5 ≈ 0.5 × 0.8 cm', pasteArmed: false, canRemoveLine: false },
    })
    await arm()

    expect(wrapper.get('[data-testid="context-bar-size"]').text()).toBe('3×5 ≈ 0.5 × 0.8 cm')
    const ids = wrapper.findAll('button[data-testid]').map((button) => button.attributes('data-testid'))
    expect(ids).toEqual(['context-bar-copy', 'context-bar-cut', 'context-bar-fill', 'context-bar-frame', 'context-bar-rotate', 'context-bar-mirror-selection', 'context-bar-clear'])
    for (const id of ids) expect(wrapper.get(`[data-testid="${id}"]`).text(), id).toBe('')
    expect(wrapper.get('[data-testid="context-bar-copy"]').attributes('aria-label')).toBe('Copy')
    expect(wrapper.get('[data-testid="context-bar-clear"]').attributes('aria-label')).toBe('Clear selection')
    expect(wrapper.find('[data-testid="context-bar-paste"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar-remove-line"]').exists()).toBe(false)

    for (const [id, event] of [['copy', 'copy'], ['cut', 'cut'], ['fill', 'fill'], ['frame', 'frame'], ['clear', 'clear-selection']]) {
      await wrapper.get(`[data-testid="context-bar-${id}"]`).trigger('click')
      expect(wrapper.emitted(event), id).toHaveLength(1)
    }
  })

  it('offers Paste after Cut only while the clipboard holds something; it emits paste (ticket 447)', async () => {
    const wrapper = mount(ContextBar, { props: { project: noFrame, selectionSummary: '1×1', pasteArmed: false, canRemoveLine: false, hasClipboard: true } })

    const ids = wrapper.findAll('button[data-testid]').map((button) => button.attributes('data-testid'))
    expect(ids.slice(0, 3)).toEqual(['context-bar-copy', 'context-bar-cut', 'context-bar-paste'])
    await arm()
    await wrapper.get('[data-testid="context-bar-paste"]').trigger('click')
    expect(wrapper.emitted('paste')).toHaveLength(1)

    await wrapper.setProps({ hasClipboard: false })
    expect(wrapper.find('[data-testid="context-bar-paste"]').exists()).toBe(false)
  })

  it('disables Fill, with its reason, until a color is chosen (ticket 415)', async () => {
    const wrapper = mount(ContextBar, { props: { project, selectionSummary: '1×1', pasteArmed: false, canRemoveLine: false, hasPaintColor: false } })

    const fill = wrapper.get('[data-testid="context-bar-fill"]')
    expect(fill.attributes('aria-disabled')).toBe('true')
    await fill.trigger('click')
    expect(wrapper.emitted('fill')).toBeUndefined()
  })

  it('shows disabled with no Tooltip for 350 ms after each new Selection, then enables; a moved Selection restarts it (ticket 499)', async () => {
    const wrapper = mount(ContextBar, { props: { project: drawn, selection, selectionSummary: '2×2', pasteArmed: false, canRemoveLine: false } })
    const copy = () => wrapper.get('[data-testid="context-bar-copy"]')

    expect(copy().attributes('aria-disabled')).toBe('true')
    await vi.advanceTimersByTimeAsync(349)
    expect(copy().attributes('aria-disabled')).toBe('true')
    await vi.advanceTimersByTimeAsync(1)
    expect(copy().attributes('aria-disabled')).toBeUndefined()

    await wrapper.setProps({ selection: { ...selection, rows: 3 } })
    expect(copy().attributes('aria-disabled')).toBe('true')
    await arm()
    expect(copy().attributes('aria-disabled')).toBeUndefined()
  })

  it('disables Copy and Cut on a Selection with no drawn bead (ticket 499)', async () => {
    const wrapper = mount(ContextBar, { props: { project: noFrame, selection, selectionSummary: '2×2', pasteArmed: false, canRemoveLine: false } })
    await arm()

    expect(wrapper.get('[data-testid="context-bar-copy"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="context-bar-cut"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="context-bar-fill"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('has no Add or Subtract toggle', () => {
    const wrapper = mount(ContextBar, { props: { project, selectionSummary: '1×1', pasteArmed: false, canRemoveLine: false } })
    expect(wrapper.text()).not.toMatch(/add|subtract/i)
  })

  it('renders only what applies: Remove line with a line selected, and Frame whether or not there is a Frame (it moves it, ticket 407)', async () => {
    const wrapper = mount(ContextBar, {
      props: { project, selectionSummary: '3×5', pasteArmed: false, canRemoveLine: true },
    })

    await arm()
    expect(frameOf(project)).toBeDefined()
    expect(wrapper.get('[data-testid="context-bar-frame"]').attributes('aria-label')).toBe('Frame')
    expect(wrapper.find('[data-testid="context-bar-paste"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="context-bar-remove-line"]').attributes('aria-disabled')).toBeUndefined()

    await arm()
    await wrapper.get('[data-testid="context-bar-remove-line"]').trigger('click')
    expect(wrapper.emitted('remove-line')).toHaveLength(1)
  })

  it('keeps Name piece on the bar, with no Tool sheet to carry it (ticket 431)', async () => {
    const wrapper = mount(ContextBar, { props: { project, selectionSummary: '3×5', pasteArmed: false, canRemoveLine: false, canNamePiece: true } })

    await arm()
    await wrapper.get('[data-testid="context-bar-name-piece"]').trigger('click')
    expect(wrapper.emitted('name-piece')).toHaveLength(1)
  })

  it('is placed against the Selection when anchored', () => {
    const wrapper = mount(ContextBar, {
      props: {
        project,
        selectionSummary: '3×5',
        pasteArmed: false,
        canRemoveLine: false,
        anchor: { box: { left: 100, top: 200, width: 80, height: 60 }, viewport: { width: 600, height: 400 } },
      },
    })
    const root = wrapper.get('[data-testid="context-bar"]')
    expect(root.classes()).toContain('context-bar--placed')
    expect(root.attributes('style')).toMatch(/top:/)
  })

  it('steps aside while a gesture runs', () => {
    const wrapper = mount(ContextBar, { props: { project, selectionSummary: '3×5', pasteArmed: false, canRemoveLine: false, gesturing: true } })
    expect(wrapper.get('[data-testid="context-bar"]').attributes('style')).toContain('display: none')
  })

  it('shrinks to the size alone, in place, while a gesture runs on a Selection with guides, and expands after', async () => {
    const wrapper = mount(ContextBar, { props: { project, selectionSummary: '3×5 ≈ 0.5 × 0.8 cm', pasteArmed: false, canRemoveLine: false, gesturing: true, sizeOnly: true } })

    expect(wrapper.get('[data-testid="context-bar"]').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.get('[data-testid="context-bar-size"]').text()).toBe('3×5 ≈ 0.5 × 0.8 cm')
    const hidden = () => wrapper.findAll('button').filter((button) => (button.element.closest('[style*="display: none"]') as HTMLElement | null) !== null)
    expect(hidden()).toHaveLength(wrapper.findAll('button').length)

    await wrapper.setProps({ gesturing: false })
    expect(hidden()).toHaveLength(0)
  })

  it('shows no bar at all while paste mode is on, Select all included (ticket 437)', () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: true, selectActive: true, canRemoveLine: false } })

    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('offers Rotate with a Selection, and not without one (ticket 416)', async () => {
    const props = { selectionSummary: '3×5', pasteArmed: false, canRemoveLine: true }
    const wrapper = mount(ContextBar, { props: { ...props, project } })
    await arm()
    await wrapper.get('[data-testid="context-bar-rotate"]').trigger('click')
    expect(wrapper.emitted('rotate')).toHaveLength(1)

    expect(mount(ContextBar, { props: { pasteArmed: false, canRemoveLine: false, project } }).find('[data-testid="context-bar-rotate"]').exists()).toBe(false)
  })

  it('offers Mirror after Rotate, always, and disables it on a Frame Selection saying the Frame mirrors whole (ADR 0082)', async () => {
    const props = { selection, selectionSummary: '2×2', pasteArmed: false, canRemoveLine: false, project: drawn }
    const wrapper = mount(ContextBar, { props })
    const ids = wrapper.findAll('button[data-testid]').map((button) => button.attributes('data-testid'))
    expect(ids.indexOf('context-bar-mirror-selection')).toBe(ids.indexOf('context-bar-rotate') + 1)
    await arm()
    const button = wrapper.get('[data-testid="context-bar-mirror-selection"]')
    expect(button.attributes('aria-label')).toBe('Mirror')
    expect(button.attributes('aria-disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('mirror-selection')).toHaveLength(1)

    const onFrame = mount(ContextBar, { props: { ...props, project, selection: { ...selection, layer: 'frame' as const } } })
    await arm()
    expect(onFrame.get('[data-testid="context-bar-mirror-selection"]').attributes('aria-disabled')).toBe('true')
    await onFrame.get('[data-testid="context-bar-mirror-selection"]').trigger('click')
    expect(onFrame.emitted('mirror-selection')).toBeUndefined()
  })

  it('offers Rotate once a pass is done on the Canvas and clear of finished rows, and disables it saying why where the Selection reaches into them (ticket 0647)', async () => {
    const woven = moveToRow(project, 1)
    const rotateOver = async (over: Selection) => {
      const wrapper = mount(ContextBar, { props: { project: woven, selection: over, selectionSummary: '2×2', pasteArmed: false, canRemoveLine: false } })
      await arm()
      return wrapper.get('[data-testid="context-bar-rotate"]')
    }
    expect((await rotateOver({ ...selection, layer: 'canvas' })).attributes('aria-disabled')).toBeUndefined()
    expect((await rotateOver({ ...selection, top: 4 })).attributes('aria-disabled')).toBeUndefined()

    const reached = await rotateOver(selection)
    expect(reached.attributes('aria-disabled')).toBe('true')
    expect(reached.element.closest('.app-tooltip')!.querySelector('.app-tooltip__body--disabled')!.textContent).toBe(en.tooltips.rotateInFinishedRows)
  })

  it('folds Rotate into "…" disabled with the same reason when the bar has no room for it (ticket 0647)', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    try {
      // 200px of canvas: the bar's 28px buttons leave room beside the readout for two and "…".
      const anchor = { box: { left: 0, top: 100, width: 40, height: 40 }, viewport: { width: 200, height: 400 } }
      const wrapper = mount(ContextBar, { props: { project: moveToRow(project, 1), selection, anchor, selectionSummary: '2×2', pasteArmed: false, canRemoveLine: false }, attachTo: document.body })
      await nextTick()
      const [bar, readout] = FakeResizeObserver.instances
      bar!.trigger(240, 28)
      readout!.trigger(40, 28)
      await arm()
      await wrapper.get('[data-testid="context-bar-more"]').trigger('click')
      expect(wrapper.findAllComponents(AppMenuItem).find((item) => item.attributes('data-testid') === 'context-bar-more-rotate')!.props()).toMatchObject({ disabled: true, disabledBody: en.tooltips.rotateInFinishedRows })
      wrapper.unmount()
    } finally {
      FakeResizeObserver.reset()
      vi.unstubAllGlobals()
    }
  })

  it('carries no native title: the Tooltip names a control whose label has hidden', () => {
    const wrapper = mount(ContextBar, {
      props: { project, selectionSummary: '3×5', pasteArmed: false, canRemoveLine: true },
    })
    expect(wrapper.find('[title]').exists()).toBe(false)
  })
})

describe('ContextBar keyboard (ticket 563, ADR 0075)', () => {
  beforeEach(() => {
    localStorage.setItem('openbeads:locale', 'en')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is one Tab stop, ←/→ stepping along its buttons and stopping at the ends', async () => {
    const wrapper = mount(ContextBar, {
      props: { project: drawn, selection, selectionSummary: '3×5', pasteArmed: false, canRemoveLine: false },
      attachTo: document.body,
    })
    await arm()
    const buttons = wrapper.findAll('button[data-testid]')
    expect(buttons.filter((button) => button.attributes('tabindex') === '0')).toHaveLength(1)

    ;(buttons[0]!.element as HTMLElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(buttons[0]!.element)
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    const last = buttons.at(-1)!
    ;(last.element as HTMLElement).focus()
    await last.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(last.element)
    wrapper.unmount()
  })
})

describe('the Mirror bar (ADR 0082, ticket 0750)', () => {
  const setting = { ...MIRROR_OFF, axes: { ...MIRROR_OFF.axes, leftRight: true }, place: { layer: 'canvas' as const, area: { row: 0, column: 0, rows: 4, columns: 6 } } }
  const mirror = { setting, summary: '6×4 ≈ 1 × 0.7 cm', rect: { row: 0, column: 0, rows: 4, columns: 6 } }
  const base = { project, pasteArmed: false, canRemoveLine: false, mirror }

  it('is the bar with no Selection while the Mirror is on: a toolbar named Mirror with the size, the Mode, the Axis chips and Close mirror', async () => {
    const wrapper = mount(ContextBar, { props: base })
    const bar = wrapper.get('[data-testid="mirror-bar"]')
    expect(bar.attributes('role')).toBe('toolbar')
    expect(bar.attributes('aria-label')).toBe('Mirror')
    expect(wrapper.get('[data-testid="context-bar-size"]').text()).toBe('6×4 ≈ 1 × 0.7 cm')
    expect(wrapper.get('[data-testid="mirror-bar-mode"]').attributes('role')).toBe('radiogroup')
    expect(wrapper.get('[data-testid="mirror-bar-mode-mirror"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-testid="mirror-bar-mode-off"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="mirror-bar-axis-leftRight"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="mirror-bar-axis-radial"]').attributes('aria-label')).toBe('Radial')
    expect(wrapper.get('[data-testid="mirror-bar-close"]').attributes('aria-label')).toBe('Close mirror')
    await wrapper.get('[data-testid="mirror-bar-close"]').trigger('click')
    expect(wrapper.emitted('close-mirror')).toHaveLength(1)
  })

  it('switches the Mode and turns Axes on and off, with no Undo step of its own: it says what the Mirror becomes', async () => {
    const wrapper = mount(ContextBar, { props: base })
    await wrapper.get('[data-testid="mirror-bar-mode-repeat"]').trigger('click')
    await wrapper.get('[data-testid="mirror-bar-axis-topBottom"]').trigger('click')
    await wrapper.get('[data-testid="mirror-bar-axis-leftRight"]').trigger('click')
    expect(wrapper.emitted('update:mirror')).toEqual([
      [{ ...setting, mode: 'repeat' }],
      [{ ...setting, axes: { leftRight: true, topBottom: true, radial: false } }],
      [setting],
    ])
  })

  it('carries a Stepper on a chip that is on, limited by the Area: an Axis count 1 to its beads across minus one, the Fold 2 to 8', async () => {
    const wrapper = mount(ContextBar, { props: { ...base, mirror: { ...mirror, setting: { ...setting, counts: { leftRight: 5, topBottom: 1 } } } } })
    expect(wrapper.get('[data-testid="mirror-bar-leftRight-value"]').text()).toBe('5')
    expect(wrapper.get('[data-testid="mirror-bar-leftRight-value"]').attributes('aria-label')).toBe('Left–right axes, 5')
    expect(wrapper.get('[data-testid="mirror-bar-leftRight-more"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[data-testid="mirror-bar-topBottom-value"]').exists()).toBe(false)
    await wrapper.get('[data-testid="mirror-bar-leftRight-more"]').trigger('click')
    await wrapper.get('[data-testid="mirror-bar-leftRight-fewer"]').trigger('click')
    expect(wrapper.emitted('update:mirror')).toEqual([[{ ...setting, counts: { leftRight: 4, topBottom: 1 } }]])

    const radial = mount(ContextBar, { props: { ...base, mirror: { ...mirror, setting: { ...setting, axes: { leftRight: false, topBottom: false, radial: true }, fold: 8 } } } })
    expect(radial.get('[data-testid="mirror-bar-radial-value"]').attributes('aria-label')).toBe('Fold, 8')
    expect(radial.get('[data-testid="mirror-bar-radial-more"]').attributes('aria-disabled')).toBe('true')
  })

  it('turns a direction one bead across off, saying why, and its press does nothing', async () => {
    const wrapper = mount(ContextBar, { props: { ...base, mirror: { ...mirror, rect: { row: 0, column: 0, rows: 4, columns: 1 } } } })
    const chip = wrapper.get('[data-testid="mirror-bar-axis-leftRight"]')
    expect(chip.attributes('aria-disabled')).toBe('true')
    expect(chip.attributes('aria-pressed')).toBe('false')
    await chip.trigger('click')
    expect(wrapper.emitted('update:mirror')).toBeUndefined()
  })

  it('on a Custom frame notes the shape\'s own Axes in place of the chips, the Mode still switching', () => {
    const star = { axes: { leftRight: false, topBottom: false, radial: true }, sides: 5 }
    const wrapper = mount(ContextBar, { props: { ...base, mirror: { ...mirror, shape: star } } })
    expect(wrapper.find('[data-testid="mirror-bar-chips"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="mirror-bar-shape-note"]').text()).toBe('Radial · 5, from the shape')
    const kite = mount(ContextBar, { props: { ...base, mirror: { ...mirror, setting: { ...setting, mode: 'repeat' as const }, shape: { axes: { leftRight: true, topBottom: false, radial: false } } } } })
    expect(kite.get('[data-testid="mirror-bar-shape-note"]').text()).toBe('Left–right, from the shape: Repeat needs Radial.')
  })

  it('gives way to the Selection bar while a Selection exists, hides during a gesture, and shrinks to its size while the Area is resized', async () => {
    const wrapper = mount(ContextBar, { props: { ...base, selection, selectionSummary: '2×2' } })
    expect(wrapper.find('[data-testid="mirror-bar"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(true)
    const shown = (testid: string) => (wrapper.get(`[data-testid="${testid}"]`).element as HTMLElement).style.display !== 'none'
    await wrapper.setProps({ selection: undefined, selectionSummary: undefined })
    expect(shown('mirror-bar')).toBe(true)
    await wrapper.setProps({ gesturing: true })
    expect(shown('mirror-bar')).toBe(false)
    await wrapper.setProps({ mirrorSizeOnly: true })
    expect(shown('mirror-bar')).toBe(true)
    expect((wrapper.get('.mirror-bar__items').element as HTMLElement).style.display).toBe('none')
  })
})
