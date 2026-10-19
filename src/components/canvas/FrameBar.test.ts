import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import FrameBar from './FrameBar.vue'
import { HOLD_DELAY_MS } from '../../composables/ui/useHoldRepeat'
import { createProject, moveToRow, type Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  vi.unstubAllGlobals()
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
  return mount(FrameBar, { props: { project }, attachTo: document.body })
}

const anchor = {
  box: { left: 150, top: 100, width: 100, height: 60 },
  viewport: { width: 400, height: 300 },
}

describe('FrameBar in Right-angle weave (ticket 482)', () => {
  const wovenBar = () => woven(framed({ row: 2, column: 3, rows: 7, columns: 5, beads: {} }), 'rightAngle')

  it('shows the size in Units: 4 across and 3 down for 5 columns and 7 rows', () => {
    const wrapper = mountBar(wovenBar())

    expect(wrapper.get('[data-testid="frame-bar-width"]').attributes('placeholder')).toBe('4')
    expect(wrapper.get('[data-testid="frame-bar-height"]').attributes('placeholder')).toBe('3')
    expect(wrapper.text()).toContain(en.frame.sizeUnitUnits)
  })

  it('takes a size typed in Units', async () => {
    const wrapper = mountBar(wovenBar())

    await wrapper.get('[data-testid="frame-bar-width"]').setValue('6')
    await wrapper.get('[data-testid="frame-bar-height"]').setValue('4')
    await wrapper.get('[data-testid="frame-bar-height"]').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('resize')).toEqual([[6, 4]])
  })
})

describe('FrameBar (ticket 473)', () => {
  it('shows the size as two empty fields with the current size as placeholders, then the unit, Rotate and Remove Frame', () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-bar-width"]')
    const height = wrapper.get('[data-testid="frame-bar-height"]')
    expect([(width.element as HTMLInputElement).value, (height.element as HTMLInputElement).value]).toEqual(['', ''])
    expect([width.attributes('placeholder'), height.attributes('placeholder')]).toEqual(['5', '6'])
    expect(wrapper.text()).toContain('beads')
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
  })

  it('takes digits only, no zero, on Enter; an empty field keeps its side; the fields empty again', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-bar-width"]')
    const height = wrapper.get('[data-testid="frame-bar-height"]')
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
    const width = wrapper.get('[data-testid="frame-bar-width"]')
    const height = wrapper.get('[data-testid="frame-bar-height"]')
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
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-bar-width"]')
    await width.setValue('9')
    ;(width.element as HTMLInputElement).focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect((width.element as HTMLInputElement).value).toBe('')
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

  it('keeps the steppers, disabled, and drops Rotate once a pass is done', () => {
    const wrapper = mountBar(moveToRow(framed(), 1))
    expect(wrapper.get('[data-testid="frame-bar-width"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="frame-edge-top-out"]').attributes('aria-disabled')).toBe('true')
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

  /** The drawing area and a bar `height` tall at its style's spot: jsdom lays nothing out, so both are given. */
  function barAt(height = 60) {
    document.body.innerHTML = '<div data-testid="app-drawing-area"></div>'
    const box = (left: number, top: number, width: number, h: number) => ({ left, top, width, height: h, right: left + width, bottom: top + h, x: left, y: top, toJSON: () => ({}) })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'app-drawing-area' ? box(0, 0, 400, 300) : box(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0, 44, height)
    })
  }
  const origin = { left: 10, top: 20, width: 10, height: 10 }
  const mountPlaced = async (frameAnchor = { ...anchor, origin }) => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(min-width: 1024px)': true }).matchMedia)
    const wrapper = mount(FrameBar, { props: { project: framed(), anchor: frameAnchor, fromPencil: true }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }
  const spotOf = (wrapper: Awaited<ReturnType<typeof mountPlaced>>) => {
    const style = wrapper.get<HTMLElement>('[data-testid="panel-dropdown"]').element.style
    return [style.left, style.top]
  }

  it('is placed once below the Frame, clear of its handles (ticket 500)', async () => {
    barAt()
    expect(spotOf(await mountPlaced())).toEqual(['178px', '195px'])
  })

  it('goes above the Frame with no room below, then to its right (ticket 500)', async () => {
    barAt()
    const low = { box: { left: 150, top: 200, width: 100, height: 60 }, viewport: anchor.viewport, origin }
    expect(spotOf(await mountPlaced(low))).toEqual(['178px', '105px'])
    document.body.innerHTML = ''
    barAt(250)
    const tall = { box: { left: 20, top: 100, width: 100, height: 60 }, viewport: anchor.viewport, origin }
    expect(spotOf(await mountPlaced(tall))).toEqual(['155px', '8px'])
  })

  it('stays put while the Frame is stepped or resized, and follows pan and zoom, kept inside the canvas box (ticket 500)', async () => {
    barAt()
    const wrapper = await mountPlaced()
    await wrapper.setProps({ anchor: { ...anchor, box: { left: 120, top: 80, width: 160, height: 120 }, origin } })
    await flushPromises()
    expect(spotOf(wrapper)).toEqual(['178px', '195px'])

    await wrapper.setProps({ anchor: { ...anchor, origin: { ...origin, left: -10, top: 10 } } })
    await flushPromises()
    expect(spotOf(wrapper)).toEqual(['158px', '185px'])

    await wrapper.setProps({ anchor: { ...anchor, origin: { ...origin, left: 400, top: 10 } } })
    await flushPromises()
    expect(spotOf(wrapper)).toEqual(['348px', '185px'])
  })

  it('overlaps where it hides least when no side has room, and is not placed again while open (ticket 500)', async () => {
    barAt(280)
    const wrapper = await mountPlaced({ box: { left: 20, top: 10, width: 360, height: 280 }, viewport: anchor.viewport, origin })
    const [left, top] = spotOf(wrapper)
    expect(parseFloat(left)).toBeGreaterThanOrEqual(8)
    expect(parseFloat(top)).toBe(10)
    await wrapper.setProps({ anchor: { ...anchor, origin } })
    await flushPromises()
    expect(spotOf(wrapper)).toEqual([left, top])
  })

  it('closes on a press outside, but not on one that grabs the Frame, nor on the Move handle (ticket 475)', async () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="outside"></button><div data-testid="frame-chrome"><button id="handle"></button></div>')
    let grabs = true
    const wrapper = mount(FrameBar, { props: { project: framed(), grabsFrame: () => grabs }, attachTo: document.body })
    await flushPromises()
    const press = (id: string) => document.getElementById(id)!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }))
    ;(wrapper.get('[data-testid="frame-bar-width"]').element as HTMLInputElement).focus()
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
