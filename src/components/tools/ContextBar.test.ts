import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextBar from './ContextBar.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, moveToRow, withFrame } from '../../domain/project'

const project = createProject({ technique: 'loom', beadId: BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!.id, size: { width: 15, height: 30, unit: 'mm' } })
const noFrame = withFrame(project, undefined)

describe('ContextBar', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('is absent with neither a Selection nor an armed paste', () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: false, canRemoveLine: false } })
    expect(wrapper.find('[data-testid="context-bar"]').exists()).toBe(false)
  })

  it('shows Select all alone with the Select tool and no Selection, and it emits (ticket 428)', async () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: false, canRemoveLine: false, selectActive: true } })

    const ids = wrapper.findAll('button[data-testid]').map((button) => button.attributes('data-testid'))
    expect(ids).toEqual(['context-bar-select-all'])
    expect(wrapper.get('[data-testid="context-bar-select-all"]').attributes('aria-label')).toBe('Select all')
    await wrapper.get('[data-testid="context-bar-select-all"]').trigger('click')
    expect(wrapper.emitted('select-all')).toHaveLength(1)
  })

  it('shows the size readout, then Copy, Cut, Fill, Frame, Rotate and Clear selection, icon-only', async () => {
    const wrapper = mount(ContextBar, {
      props: { project: noFrame, selectionSummary: '3×5 · 0.5 × 0.8 cm', pasteArmed: false, canRemoveLine: false },
    })

    expect(wrapper.get('[data-testid="context-bar-size"]').text()).toBe('3×5 · 0.5 × 0.8 cm')
    const ids = wrapper.findAll('button[data-testid]').map((button) => button.attributes('data-testid'))
    expect(ids).toEqual(['context-bar-copy', 'context-bar-cut', 'context-bar-fill', 'context-bar-frame', 'context-bar-rotate', 'context-bar-clear'])
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

  it('disables Fill, with its reason, until a color is chosen (ticket 415)', async () => {
    const wrapper = mount(ContextBar, { props: { project, selectionSummary: '1×1', pasteArmed: false, canRemoveLine: false, hasPaintColor: false } })

    const fill = wrapper.get('[data-testid="context-bar-fill"]')
    expect(fill.attributes('aria-disabled')).toBe('true')
    await fill.trigger('click')
    expect(wrapper.emitted('fill')).toBeUndefined()
  })

  it('has no Add or Subtract toggle', () => {
    const wrapper = mount(ContextBar, { props: { project, selectionSummary: '1×1', pasteArmed: false, canRemoveLine: false } })
    expect(wrapper.text()).not.toMatch(/add|subtract/i)
  })

  it('renders only what applies: Paste with a clipboard, Remove line with a line selected, and Frame whether or not there is a Frame (it moves it, ticket 407)', async () => {
    const wrapper = mount(ContextBar, {
      props: { project, selectionSummary: '3×5', pasteArmed: false, canRemoveLine: true, hasClipboard: true },
    })

    expect(project.frame).toBeDefined()
    expect(wrapper.get('[data-testid="context-bar-frame"]').attributes('aria-label')).toBe('Frame')
    expect(wrapper.get('[data-testid="context-bar-paste"]').attributes('aria-label')).toBe('Paste')
    expect(wrapper.get('[data-testid="context-bar-remove-line"]').attributes('aria-disabled')).toBeUndefined()

    await wrapper.get('[data-testid="context-bar-paste"]').trigger('click')
    await wrapper.get('[data-testid="context-bar-remove-line"]').trigger('click')
    expect(wrapper.emitted('paste')).toHaveLength(1)
    expect(wrapper.emitted('remove-line')).toHaveLength(1)
  })

  it('keeps Name piece on the bar, with no Tool sheet to carry it (ticket 431)', async () => {
    const wrapper = mount(ContextBar, { props: { project, selectionSummary: '3×5', pasteArmed: false, canRemoveLine: false, canNamePiece: true } })

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

  it('turns into "Tap to paste" and Cancel once armed', async () => {
    const wrapper = mount(ContextBar, { props: { project, pasteArmed: true, canRemoveLine: false } })

    expect(wrapper.find('[data-testid="context-bar-size"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="context-bar-hint"]').attributes('aria-label')).toBe('Tap where to paste')
    expect(wrapper.get('[data-testid="context-bar-cancel"]').attributes('aria-label')).toBe('Cancel')

    await wrapper.get('[data-testid="context-bar-cancel"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('offers Rotate with a Selection, and not once a Row progress pass is done (tickets 411, 416)', async () => {
    const props = { selectionSummary: '3×5', pasteArmed: false, canRemoveLine: true }
    const wrapper = mount(ContextBar, { props: { ...props, project } })
    await wrapper.get('[data-testid="context-bar-rotate"]').trigger('click')
    expect(wrapper.emitted('rotate')).toHaveLength(1)

    const woven = moveToRow(project, 1)
    expect(mount(ContextBar, { props: { ...props, project: woven } }).find('[data-testid="context-bar-rotate"]').exists()).toBe(false)
    expect(mount(ContextBar, { props: { pasteArmed: false, canRemoveLine: false, project } }).find('[data-testid="context-bar-rotate"]').exists()).toBe(false)
  })

  it('carries no native title: the Tooltip names a control whose label has hidden', () => {
    const wrapper = mount(ContextBar, {
      props: { project, selectionSummary: '3×5', pasteArmed: false, canRemoveLine: true },
    })
    expect(wrapper.find('[title]').exists()).toBe(false)
  })
})
