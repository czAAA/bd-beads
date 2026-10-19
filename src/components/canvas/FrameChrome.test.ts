import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FrameChrome from './FrameChrome.vue'
import { createProject, moveToRow, type Project } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const anchor = {
  box: { left: 150, top: 100, width: 100, height: 60 },
  outer: { left: 100, top: 50, width: 200, height: 160 },
  viewport: { width: 400, height: 300 },
}

function framed(): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), frame: { row: 2, column: 3, rows: 4, columns: 5, beads: {} } }
}

function mountChrome(props: Partial<InstanceType<typeof FrameChrome>['$props']> = {}) {
  return mount(FrameChrome, { props: { project: framed(), anchor, editing: false, pressing: false, ...props } })
}

describe('FrameChrome (ticket 473)', () => {
  it('puts the Margin handle halfway down the top margin and the pencil inside the outline corner', () => {
    const wrapper = mountChrome()
    const at = (testid: string) => wrapper.get(`[data-testid="${testid}"]`).element.closest('.frame-chrome__control')!.getAttribute('style')
    expect(at('frame-move-handle')).toContain('left: 200px')
    expect(at('frame-move-handle')).toContain('top: 75px')
    expect(at('frame-edit-toggle')).toContain('left: 274px')
    expect(at('frame-edit-toggle')).toContain('top: 76px')
  })

  it('names the handle Move Frame, and hands its press and keys on', async () => {
    const wrapper = mountChrome()
    const handle = wrapper.get('[data-testid="frame-move-handle"]')
    expect(handle.attributes('aria-label')).toBe(en.frame.moveHandle)
    await handle.trigger('pointerdown', { button: 0 })
    await handle.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('move-press')).toHaveLength(1)
    expect(wrapper.emitted('key')).toHaveLength(1)
  })

  it('shows the handle dragged until the canvas press ends', async () => {
    const wrapper = mountChrome({ pressing: true })
    await wrapper.get('[data-testid="frame-move-handle"]').trigger('pointerdown', { button: 0 })
    expect(wrapper.get('[data-testid="frame-move-handle"]').classes()).toContain('frame-chrome__handle--dragging')
    await wrapper.setProps({ pressing: false })
    expect(wrapper.get('[data-testid="frame-move-handle"]').classes()).not.toContain('frame-chrome__handle--dragging')
  })

  it('has a pencil that is pressed while the bar is open and toggles it', async () => {
    const wrapper = mountChrome({ editing: true })
    const pencil = wrapper.get('[data-testid="frame-edit-toggle"]')
    expect(pencil.attributes('aria-pressed')).toBe('true')
    await pencil.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('keeps the pencil and the handle working once Row progress has started, for the size and Remove (ticket 475)', async () => {
    const wrapper = mountChrome({ project: moveToRow(framed(), 1), editing: true })
    const pencil = wrapper.get('[data-testid="frame-edit-toggle"]')
    expect(pencil.attributes('aria-disabled')).toBeUndefined()
    expect(pencil.attributes('aria-pressed')).toBe('true')
    await pencil.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
    expect(wrapper.get('[data-testid="frame-move-handle"]').attributes('aria-disabled')).toBeUndefined()
  })
})
