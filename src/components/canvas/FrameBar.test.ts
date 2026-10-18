import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
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
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function framed(frame = { row: 2, column: 3, rows: 6, columns: 5 }): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), frame }
}

function mountBar(project = framed()) {
  return mount(FrameBar, { props: { project }, attachTo: document.body })
}

const anchor = {
  box: { left: 150, top: 100, width: 100, height: 60 },
  outer: { left: 100, top: 50, width: 200, height: 160 },
  viewport: { width: 400, height: 300 },
}

/** The edit pencil on the page at `rect`, and the bar `height` tall: jsdom lays nothing out, so both are given. */
function pencilAt(rect: { left: number; top: number }, height = 300) {
  document.body.innerHTML = '<button data-testid="frame-edit-toggle"></button>'
  const pencil = document.querySelector('button')!
  const box = (left: number, top: number, width: number, h: number) => ({ left, top, width, height: h, right: left + width, bottom: top + h, x: left, y: top, toJSON: () => ({}) })
  let at = rect
  pencil.getBoundingClientRect = () => box(at.left, at.top, 44, 44)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height)
  // The bar reports itself where its style put it, so the place-and-correct pass leaves it there.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return box(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0, 44, height)
  })
  return { moveTo: (next: { left: number; top: number }) => (at = next) }
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
    await field.setValue('5x6')
    await field.trigger('blur')
    expect(wrapper.emitted('resize')).toHaveLength(1)
    await field.setValue('20 by 12')
    await field.trigger('blur')
    expect(wrapper.emitted('resize')).toHaveLength(1)
    expect((field.element as HTMLInputElement).value).toBe('5 × 6')
    await field.setValue('9')
    ;(field.element as HTMLInputElement).focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect((field.element as HTMLInputElement).value).toBe('5 × 6')
    // The first Escape only put the size back; the next closes the bar.
    expect(wrapper.emitted('close')).toBeUndefined()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
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

  it('hangs from the edit pencil that opened it, 4px under it, and above it with no room below (ticket 475)', async () => {
    pencilAt({ left: 600, top: 100 })
    const under = mount(FrameBar, { props: { project: framed(), pencil: anchor }, attachTo: document.body })
    await flushPromises()
    const bar = () => under.get<HTMLElement>('[data-testid="panel-dropdown"]').element.style
    expect([bar().position, bar().top, bar().left]).toEqual(['fixed', '148px', '600px'])
    under.unmount()

    pencilAt({ left: 600, top: 600 })
    const over = mount(FrameBar, { props: { project: framed(), pencil: anchor }, attachTo: document.body })
    await flushPromises()
    expect(over.get<HTMLElement>('[data-testid="panel-dropdown"]').element.style.top).toBe('296px')
  })

  it('follows the pencil as the canvas pans or zooms (ticket 475)', async () => {
    const pencil = pencilAt({ left: 600, top: 100 })
    const wrapper = mount(FrameBar, { props: { project: framed(), pencil: anchor }, attachTo: document.body })
    await flushPromises()
    pencil.moveTo({ left: 500, top: 50 })
    await wrapper.setProps({ pencil: { ...anchor, outer: { ...anchor.outer, left: 0 } } })
    await flushPromises()
    const bar = wrapper.get<HTMLElement>('[data-testid="panel-dropdown"]').element.style
    expect([bar.top, bar.left]).toEqual(['98px', '500px'])
  })

  it('closes on a press outside, but not on one that grabs the Frame, nor on the Margin handle (ticket 475)', async () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="outside"></button><div data-testid="frame-chrome"><button id="handle"></button></div>')
    let grabs = true
    const wrapper = mount(FrameBar, { props: { project: framed(), grabsFrame: () => grabs }, attachTo: document.body })
    await flushPromises()
    const press = (id: string) => document.getElementById(id)!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    ;(wrapper.get('[data-testid="frame-bar-size"]').element as HTMLInputElement).focus()
    // A kept press moves focus out of the panel without closing it.
    press('outside')
    document.getElementById('outside')!.focus()
    press('handle')
    expect(wrapper.emitted('close')).toBeUndefined()
    grabs = false
    press('handle')
    expect(wrapper.emitted('close')).toBeUndefined()
    press('outside')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
