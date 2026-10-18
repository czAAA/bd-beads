import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import CanvasBackdrop from './CanvasBackdrop.vue'
import type { Project } from '../../domain/project'
import CanvasStrip from './CanvasStrip.vue'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

describe('CanvasStrip', () => {
  it('is shielded from the page panning under a vertical touch drag', () => {
    const wrapper = mount(CanvasStrip, { props: { project } })

    expect(wrapper.find('[data-testid="canvas-strip"]').classes()).toContain('no-page-pan')
  })

  const project = { frame: undefined, beads: { 0: { 0: '#ff0000' } }, technique: 'loom' } as unknown as Project

  it('holds Menu, Project, Rotate canvas, Rulers, Undo, Redo, then the zoom (out, level, in, Fit), and passes each press on (tickets 425, 431)', async () => {
    const wrapper = mount(CanvasStrip, { props: { project, rulers: true, canUndo: true, canRedo: true, zoomPercent: 125 } })

    const order = wrapper.findAll('[data-testid]').map((element) => element.attributes('data-testid'))
    expect(order.filter((id) => id?.startsWith('strip-') || id?.startsWith('zoom-'))).toEqual(['strip-menu', 'strip-project', 'strip-rotate-canvas', 'strip-rulers', 'strip-undo', 'strip-redo', 'zoom-out', 'zoom-level', 'zoom-in', 'zoom-reset'])
    expect(wrapper.get('[data-testid="zoom-level"]').text()).toBe('125%')

    for (const id of ['strip-rotate-canvas', 'strip-rulers', 'strip-undo', 'strip-redo', 'zoom-in', 'zoom-out', 'zoom-reset']) await wrapper.get(`[data-testid="${id}"]`).trigger('click')
    expect(Object.keys(wrapper.emitted())).toEqual(expect.arrayContaining(['rotate-canvas', 'toggle-rulers', 'undo', 'redo', 'zoom-in', 'zoom-out', 'reset']))
  })

  it('shows Menu and Project as icon + text, and asks for their sheets (ticket 431)', async () => {
    const wrapper = mount(CanvasStrip, { props: { project, openSheet: 'project' } })

    expect(wrapper.get('[data-testid="strip-menu"]').text()).toBe('Menu')
    expect(wrapper.find('[data-testid="strip-menu"] svg').exists()).toBe(true)
    expect(wrapper.get('[data-testid="strip-project"]').text()).toBe('Project')
    expect(wrapper.get('[data-testid="strip-project"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="strip-menu"]').attributes('aria-pressed')).toBeUndefined()

    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await wrapper.get('[data-testid="strip-project"]').trigger('click')
    expect(wrapper.emitted('select-sheet')).toEqual([['menu'], ['project']])
  })

  it('names nothing: no title, size line, estimate, grid icon or hint', () => {
    const wrapper = mount(CanvasStrip, { props: { project, rulers: true, zoomPercent: 100 } })

    // Rotate canvas (ticket 471) is a control named for the Canvas; everything else on the strip names nothing.
    const text = wrapper.text().replace(en.canvas.rotateCanvasLabel, '').replace(en.tooltips.rotateCanvas, '')
    expect(text).not.toMatch(/Schema|Canvas|Width|Height|Pieces/i)
    expect(wrapper.find('svg[data-icon="grid"]').exists()).toBe(false)
  })

  it('shows Menu and the zoom alone while a picture is framed, over the framing step\'s own range', async () => {
    const wrapper = mount(CanvasStrip, { props: { rulers: true, zoomPercent: 800, zoomMinPercent: 100, zoomMaxPercent: 800 } })

    expect(wrapper.find('[data-testid="strip-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="strip-undo"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="zoom-in"]').attributes('aria-disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="zoom-out"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('holds Menu alone with no Project open (ticket 431)', () => {
    const wrapper = mount(CanvasStrip)

    expect(wrapper.find('[data-testid="strip-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="zoom-level"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="strip-rulers"]').exists()).toBe(false)
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

describe('CanvasStrip Rotate canvas (ticket 471)', () => {
  it('is disabled with the reason while the Canvas is empty, and does not ask for a turn', async () => {
    const empty = { frame: undefined, beads: {}, technique: 'loom', rotation: 0 } as unknown as Project
    const wrapper = mount(CanvasStrip, { props: { project: empty } })
    const button = wrapper.get('[data-testid="strip-rotate-canvas"]')

    expect(button.attributes('aria-disabled')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('rotate-canvas')).toBeUndefined()
  })
})
