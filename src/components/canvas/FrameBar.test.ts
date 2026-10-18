import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FrameBar from './FrameBar.vue'
import { HOLD_DELAY_MS } from '../../composables/ui/useHoldRepeat'
import { createProject, moveToRow, type Project } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  vi.useRealTimers()
})

function framed(frame = { row: 2, column: 3, rows: 6, columns: 5 }): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), frame }
}

function mountBar(project = framed()) {
  return mount(FrameBar, { props: { project } })
}

describe('FrameBar (ticket 473)', () => {
  it('shows the size with its unit, and Rotate and Remove Frame', () => {
    const wrapper = mountBar()
    expect((wrapper.get('[data-testid="frame-bar-size"]').element as HTMLInputElement).value).toBe('5 × 6')
    expect(wrapper.text()).toContain('beads')
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
  })

  it('takes a typed size on Enter or when left, and puts the size back when it is not one', async () => {
    const wrapper = mountBar()
    const field = wrapper.get('[data-testid="frame-bar-size"]')
    await field.setValue('20x12')
    await field.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[20, 12]])
    await field.setValue('20 by 12')
    await field.trigger('blur')
    expect(wrapper.emitted('resize')).toHaveLength(1)
    expect((field.element as HTMLInputElement).value).toBe('5 × 6')
    await field.setValue('9')
    await field.trigger('keydown', { key: 'Escape' })
    expect((field.element as HTMLInputElement).value).toBe('5 × 6')
  })

  it('has the edge cells in the order Top, Bottom, Left, Right, each with − first and + second', () => {
    const wrapper = mountBar()
    const cells = wrapper.findAll('.frame-bar__cell')
    expect(cells.map((cell) => cell.get('.frame-bar__name').text())).toEqual([en.frame.edgeName.top, en.frame.edgeName.bottom, en.frame.edgeName.left, en.frame.edgeName.right])
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
    expect(wrapper.get('[data-testid="frame-bar-cell-top"]').classes()).toContain('frame-bar__cell--last')
    expect(wrapper.get('[data-testid="frame-bar-cell-left"]').classes()).not.toContain('frame-bar__cell--last')
  })

  it('disables the − at four beads with the reason, and a press is no step', async () => {
    const wrapper = mountBar(framed({ row: 2, column: 3, rows: 4, columns: 5 }))
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

  it('holds the size and Remove Frame alone once a pass is done', () => {
    const wrapper = mountBar(moveToRow(framed(), 1))
    expect(wrapper.get('[data-testid="frame-bar-size"]').attributes('readonly')).toBeDefined()
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
    for (const gone of ['frame-rotate', 'frame-edge-top-out', 'frame-bar-cell-top']) expect(wrapper.find(`[data-testid="${gone}"]`).exists()).toBe(false)
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
})
