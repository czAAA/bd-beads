import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProjectSurface from './ProjectSurface.vue'
import { createProject } from '../../domain/createProject'
import { recordingContext } from '../../testUtils/recordingContext'

// The bead cursor's part of the surface (ticket 0942, ADR 0093): the Tab stop, the ring and the keys it hands on.
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } })

function rectOf(width: number, height: number): DOMRect {
  return { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recordingContext().context as unknown as CanvasRenderingContext2D)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.classList.contains('project-surface') ? rectOf(1000, 800) : rectOf(0, 0)
  })
})

afterEach(() => vi.restoreAllMocks())

async function mountSurface(cursor?: { row: number; column: number }) {
  const wrapper = mount(ProjectSurface, { props: { project, zoom: 1, scroll: { x: 0, y: 0 }, cursor }, attachTo: document.body })
  await nextTick()
  await nextTick()
  return wrapper
}

describe('ProjectSurface: the bead cursor (ticket 0942)', () => {
  it('is one Tab stop and rings the bead the cursor is on, the ring hidden from screen readers', async () => {
    const wrapper = await mountSurface({ row: 2, column: 3 })
    expect(wrapper.get('[data-testid="project-surface"]').attributes('tabindex')).toBe('0')
    const ring = wrapper.get('[data-testid="bead-cursor"]')
    expect(ring.attributes('aria-hidden')).toBe('true')
    // A bead is 20 px at zoom 1: the fourth column, the third row.
    expect(ring.attributes('style')).toContain('left: 60px')
    expect(ring.attributes('style')).toContain('top: 40px')

    // A pointer press takes over from the keyboard: the ring is asked to hide.
    await wrapper.get('[data-testid="project-surface"]').trigger('pointerdown', { pointerType: 'mouse', button: 2 })
    expect(wrapper.emitted('cursor-blur')).toHaveLength(1)

    await wrapper.setProps({ cursor: undefined })
    expect(wrapper.find('[data-testid="bead-cursor"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('tells keyboard focus from the focus a press gives, and hands keys on with which it was', async () => {
    const wrapper = await mountSurface()
    const root = wrapper.get('[data-testid="project-surface"]')
    await root.trigger('focus')
    expect(wrapper.emitted('keyboard-focus')).toHaveLength(1)
    await root.trigger('blur')
    expect(wrapper.emitted('cursor-blur')).toHaveLength(1)

    await root.trigger('pointerdown', { pointerType: 'mouse', button: 2 })
    await root.trigger('focus')
    expect(wrapper.emitted('keyboard-focus')).toHaveLength(1)
    await root.trigger('keydown', { key: ' ' })
    await root.trigger('keydown', { key: 'ArrowLeft' })
    await root.trigger('keydown', { key: ' ' })
    await root.trigger('keyup', { key: 'Shift' })
    expect(wrapper.emitted('cursor-key')!.map(([event, pressed]) => [(event as KeyboardEvent).key, pressed])).toEqual([
      [' ', true],
      ['ArrowLeft', false],
      [' ', false],
    ])
    expect(wrapper.emitted('cursor-key-up')).toHaveLength(1)
    wrapper.unmount()
  })
})
