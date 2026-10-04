import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import CanvasBackdrop from './CanvasBackdrop.vue'
import type { Project } from '../../domain/project'
import CanvasStrip from './CanvasStrip.vue'

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'en')
})

describe('CanvasStrip', () => {
  it('names the board and its size, joined by a middle dot, with plural forms', () => {
    const wrapper = mount(CanvasStrip, { props: { size: { columns: 40, rows: 1 }, zoomPercent: 100 } })

    expect(wrapper.text()).toContain('Pattern')
    expect(wrapper.get('[data-testid="canvas-strip-size"]').text()).toBe('40 columns · 1 row')
    expect(wrapper.get('svg').attributes('data-icon')).toBe('grid')
  })

  it('does not count pieces outside the Frame', () => {
    const beads = { '0,0': { color: '#e63746' }, '40,40': { color: '#e63746' } }
    const project = { frame: { row: 0, column: 0, rows: 5, columns: 5 }, beads, technique: 'loom' } as unknown as Project
    const wrapper = mount(CanvasStrip, { props: { project } })

    expect(wrapper.find('[data-testid="canvas-strip-outside"]').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/outside/i)
  })

  it('counts in Russian with one, few and many', () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    const wrapper = mount(CanvasStrip, { props: { size: { columns: 21, rows: 3 } } })

    expect(wrapper.get('[data-testid="canvas-strip-size"]').text()).toBe('21 столбец · 3 ряда')
  })

  it('holds the zoom, in the order zoom out, fit, zoom in, and passes each press on', async () => {
    const wrapper = mount(CanvasStrip, { props: { size: { columns: 4, rows: 4 }, zoomPercent: 125 } })

    const order = wrapper.findAll('[data-testid^="zoom-"]').map((element) => element.attributes('data-testid'))
    expect(order).toEqual(['zoom-controls', 'zoom-out', 'zoom-reset', 'zoom-level', 'zoom-in'])
    expect(wrapper.get('[data-testid="zoom-level"]').text()).toBe('125%')

    await wrapper.get('[data-testid="zoom-in"]').trigger('click')
    await wrapper.get('[data-testid="zoom-out"]').trigger('click')
    await wrapper.get('[data-testid="zoom-reset"]').trigger('click')
    expect(Object.keys(wrapper.emitted())).toEqual(expect.arrayContaining(['zoom-in', 'zoom-out', 'reset']))
  })

  it('shows just its title with nothing on the board', () => {
    const wrapper = mount(CanvasStrip)

    expect(wrapper.find('[data-testid="canvas-strip-size"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="zoom-controls"]').exists()).toBe(false)
  })
})

describe('CanvasBackdrop', () => {
  it('shows the word and the curve as decoration only, hidden from assistive tech', () => {
    const wrapper = mount(CanvasBackdrop, { props: { word: 'Loom' } })

    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('Loom')
    expect(wrapper.find('path').attributes('d')).toBe('M-20 640 C 200 740, 380 420, 560 380 S 860 520, 1020 60')
    expect(wrapper.find('button, a, input, [tabindex]').exists()).toBe(false)
  })
})
