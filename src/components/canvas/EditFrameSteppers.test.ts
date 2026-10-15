import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EditFrameSteppers from './EditFrameSteppers.vue'
import { createProject, moveToRow, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { rowProgressOn } from '../../testUtils/rowProgress'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

const anchor = {
  box: { left: 100, top: 80, width: 200, height: 120 },
  outer: { left: 50, top: 30, width: 300, height: 220 },
  numbers: { across: 20, down: 14 },
  viewport: { width: 600, height: 400 },
}

function framed(frame = { row: 2, column: 3, rows: 4, columns: 5 }): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), frame }
}

function mountSteppers(project = framed()) {
  return mount(EditFrameSteppers, { props: { project, anchor } })
}

describe('EditFrameSteppers (ticket 417)', () => {
  it('puts each pair in the margin, between the ruler numbers and its outer edge (ticket 427)', () => {
    const wrapper = mountSteppers()
    const at = (edge: string) => wrapper.get(`[data-testid="frame-edge-${edge}-out"]`).element.closest('.edit-frame-steppers__pair')!.getAttribute('style')
    expect(at('top')).toContain('left: 200px')
    expect(at('top')).toContain('top: 48px')
    expect(at('left')).toContain('left: 65px')
    expect(at('left')).toContain('top: 140px')
    expect(at('right')).toContain('left: 335px')
    expect(at('bottom')).toContain('top: 232px')
  })

  it('has a − and a + on each of the four edges, each named for its edge', () => {
    const wrapper = mountSteppers()
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      expect(wrapper.get(`[data-testid="frame-edge-${edge}-out"]`).attributes('aria-label')).toBe(en.frame.edgeOut[edge])
      expect(wrapper.get(`[data-testid="frame-edge-${edge}-in"]`).attributes('aria-label')).toBe(en.frame.edgeIn[edge])
      expect(wrapper.get(`[data-testid="frame-edge-${edge}-out"]`).text()).toBe('+')
      expect(wrapper.get(`[data-testid="frame-edge-${edge}-in"]`).text()).toBe('−')
    }
  })

  it('emits the edge and a bead out (1) or in (-1)', async () => {
    const wrapper = mountSteppers()
    await wrapper.get('[data-testid="frame-edge-top-out"]').trigger('click')
    await wrapper.get('[data-testid="frame-edge-left-in"]').trigger('click')
    expect(wrapper.emitted('step')).toEqual([['top', 1], ['left', -1]])
  })

  it('cannot take an edge in at one bead, and says why', async () => {
    const wrapper = mountSteppers(framed({ row: 2, column: 3, rows: 1, columns: 5 }))
    const top = wrapper.get('[data-testid="frame-edge-top-in"]')
    expect(top.attributes('aria-disabled')).toBe('true')
    await top.trigger('click')
    expect(wrapper.emitted('step')).toBeUndefined()
    // Width has room, so the left and right stepper still work.
    await wrapper.get('[data-testid="frame-edge-left-in"]').trigger('click')
    expect(wrapper.emitted('step')).toEqual([['left', -1]])
  })

  it('is locked once Row progress is on and a pass is done (ticket 411)', async () => {
    const wrapper = mountSteppers({ ...moveToRow(rowProgressOn(framed()), 1) })
    const button = wrapper.get('[data-testid="frame-edge-right-out"]')
    expect(button.attributes('aria-disabled')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('step')).toBeUndefined()
  })
})
