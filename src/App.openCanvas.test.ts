import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { withColors } from './domain/canvas'
import { createPattern, type Pattern } from './domain/pattern'
import { loadPatterns, savePatterns } from './services/libraryStore'
import { en } from './i18n/en'
import { beadColor, hoverBead, previewedBeads, pressBead, pressRulerNumber, rulerNumbers, selectedBeadCount } from './testUtils/beads'

/**
 * The open canvas (ticket 233, ADR 0026) as the app shows it: a Pattern with no Frame is an endless field you draw on
 * anywhere, move with the wheel, the Hand tool and Space, and read through the rulers of its pieces.
 */

const RED = '#e63746'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

/** A Pattern with no Frame and a few beads in two places. */
function openCanvas(extra: Partial<Pattern> = {}): Pattern {
  const base = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Sketch', size: { width: 4, height: 4, unit: 'beads' } })
  return {
    ...base,
    frame: undefined,
    beads: withColors({}, [
      { row: 0, column: 0, color: RED },
      { row: 0, column: 1, color: RED },
      { row: 1, column: 1, color: RED },
      { row: 10, column: 10, color: RED },
    ]),
    ...extra,
  }
}

function mountApp() {
  return mount(App, { attachTo: document.body })
}

async function key(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

const surface = (wrapper: ReturnType<typeof mountApp>) => wrapper.find('[data-testid="pattern-surface"]')

describe('drawing anywhere', () => {
  it('paints far from the first bead, at positions the canvas never had a size for, and keeps it through a reload', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await pressBead(wrapper, { row: 4000, column: 9000 })
    await wrapper.trigger('mouseup')
    await pressBead(wrapper, { row: -30, column: -12 })
    await wrapper.trigger('mouseup')

    expect(beadColor(wrapper, { row: 4000, column: 9000 })).toBe(RED)
    const saved = loadPatterns()[0]!
    expect(saved.beads[4000]![9000]).toBe(RED)
    expect(saved.beads[-30]![-12]).toBe(RED)
    expect(saved.frame).toBeUndefined()

    wrapper.unmount()
    const reloaded = mountApp()
    await flushPromises()
    expect(beadColor(reloaded, { row: 4000, column: 9000 })).toBe(RED)
    expect(beadColor(reloaded, { row: -30, column: -12 })).toBe(RED)
  })

  it('undoes a stroke far from the start as one step', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await pressBead(wrapper, { row: 500, column: 500 })
    await hoverBead(wrapper, { row: 500, column: 501 }, { buttons: 1 })
    await hoverBead(wrapper, { row: 500, column: 502 }, { buttons: 1 })
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.beads[500]).toEqual({ 500: RED, 501: RED, 502: RED })

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(loadPatterns()[0]!.beads[500]).toBeUndefined()
  })

  it('reads "Canvas · 2 pieces · no Frame" on the strip, and counts a bead joined to a piece as the same piece', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('[data-testid="canvas-strip-title"]').text()).toBe(en.canvas.canvasTitle)
    expect(wrapper.find('[data-testid="canvas-strip-size"]').text()).toBe('2 pieces · no Frame')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, { row: 5, column: 5 })
    await wrapper.trigger('mouseup')
    expect(wrapper.find('[data-testid="canvas-strip-size"]').text()).toBe('3 pieces · no Frame')

    // A bead between two pieces joins them: (10, 10) and (5, 5) are bridged by painting a path.
    for (let step = 6; step <= 9; step += 1) {
      await pressBead(wrapper, { row: step, column: step })
      await wrapper.trigger('mouseup')
    }
    expect(wrapper.find('[data-testid="canvas-strip-size"]').text()).toBe('2 pieces · no Frame')
  })
})

describe('the rulers of pieces', () => {
  it('number each piece from 1 above and to the left, and nothing below or right of it', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()

    const numbers = rulerNumbers(wrapper)
    // Piece one is 2 columns × 2 rows (beads (0,0), (0,1), (1,1)); piece two is the lone bead at (10, 10).
    expect(numbers.filter((n) => n.axis === 'column').map((n) => n.text).sort()).toEqual(['1', '1', '2'])
    expect(numbers.filter((n) => n.axis === 'row').map((n) => n.text).sort()).toEqual(['1', '1', '2'])
  })

  it('select the whole row of a piece when its number is pressed', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()

    await pressRulerNumber(wrapper, 'row', 0)
    expect(selectedBeadCount(wrapper)).toBe(2) // the first piece is 2 beads wide
  })

  it('are hidden by the Rulers toggle and by R, and come back', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()
    const toggle = wrapper.find('[data-testid="rulers-toggle"]')
    expect(toggle.attributes('aria-pressed')).toBe('true')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    await key({ key: 'r' })
    expect(toggle.attributes('aria-pressed')).toBe('true')
  })
})

describe('moving the canvas', () => {
  it('scrolls with the wheel and zooms with Ctrl or ⌘ + wheel, about the pointer', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()
    const root = surface(wrapper)
    const scrollX = () => Number(root.attributes('data-scroll-x'))
    const scrollY = () => Number(root.attributes('data-scroll-y'))
    const zoom = () => Number(root.attributes('data-zoom'))
    const start = { x: scrollX(), y: scrollY(), zoom: zoom() }

    root.element.dispatchEvent(new WheelEvent('wheel', { deltaX: 30, deltaY: 120, bubbles: true, cancelable: true }))
    await flushPromises()
    expect(scrollX()).toBe(start.x + 30)
    expect(scrollY()).toBe(start.y + 120)

    root.element.dispatchEvent(new WheelEvent('wheel', { deltaY: -20, ctrlKey: true, bubbles: true, cancelable: true }))
    await flushPromises()
    expect(zoom()).toBeGreaterThan(start.zoom)
  })

  it('has no edge: a long way off is just as reachable', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()
    const root = surface(wrapper)

    root.element.dispatchEvent(new WheelEvent('wheel', { deltaX: 400000, deltaY: -400000, bubbles: true, cancelable: true }))
    await flushPromises()

    expect(Number(root.attributes('data-scroll-x'))).toBeGreaterThan(300000)
    expect(Number(root.attributes('data-scroll-y'))).toBeLessThan(-300000)
  })
})

describe('the Hand tool', () => {
  it('is the fifth tool, picked by H, and drags the canvas without changing a bead or previewing one', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await key({ key: 'h' })
    expect(wrapper.find('[data-testid="tool-hand"]').classes()).toContain('tool-button--active')
    expect(wrapper.findAll('[data-testid="toolbox"] .tool-button')).toHaveLength(5)

    const before = JSON.stringify(loadPatterns()[0]!.beads)
    const root = surface(wrapper)
    const startX = Number(root.attributes('data-scroll-x'))
    await root.trigger('pointerdown', { clientX: 100, clientY: 100, button: 0, buttons: 1 })
    await root.trigger('pointermove', { clientX: 70, clientY: 90, buttons: 1 })
    await root.trigger('pointerup')
    await hoverBead(wrapper, { row: 3, column: 3 })

    expect(Number(root.attributes('data-scroll-x'))).toBe(startX + 30)
    expect(JSON.stringify(loadPatterns()[0]!.beads)).toBe(before)
    expect(previewedBeads(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="undo-button"]').attributes('disabled')).toBeDefined()
  })

  it('leaves the other tools alone: pressing a bead with Paint still paints', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await key({ key: 'h' })
    await key({ key: '1' })

    await pressBead(wrapper, { row: 3, column: 3 })
    await wrapper.trigger('mouseup')

    expect(beadColor(wrapper, { row: 3, column: 3 })).toBe(RED)
  })
})

describe('the canvas hint', () => {
  it('names how to move, zoom and the shortcuts, in the bottom-left of the drawing area, while a Pattern is open', async () => {
    savePatterns([openCanvas()])
    const wrapper = mountApp()
    await flushPromises()

    const hint = wrapper.find('[data-testid="canvas-hint"]')
    expect(hint.exists()).toBe(true)
    expect(hint.attributes('aria-hidden')).toBe('true')
    expect(hint.text()).toContain(en.canvas.hint.hand)
    expect(hint.text()).toContain(en.canvas.hint.setFrame)
    expect(hint.text()).toContain(en.canvas.hint.rulers)
    expect(hint.text()).toContain('Ctrl') // jsdom is not an Apple device
  })

  it('is not there with no Pattern open', async () => {
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('[data-testid="canvas-hint"]').exists()).toBe(false)
  })
})
