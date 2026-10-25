import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
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

  it('holds Menu, Project, Rotate canvas, Rulers, Undo, Redo, then the zoom (out, in, Fit), and passes each press on (tickets 425, 431)', async () => {
    const wrapper = mount(CanvasStrip, { props: { project, rulers: true, canUndo: true, canRedo: true, zoomPercent: 125 } })

    const order = wrapper.findAll('[data-testid]').map((element) => element.attributes('data-testid'))
    expect(order.filter((id) => id?.startsWith('strip-') || id?.startsWith('zoom-'))).toEqual(['strip-menu', 'strip-project', 'strip-rotate-canvas', 'strip-rulers', 'strip-undo', 'strip-redo', 'zoom-out', 'zoom-in', 'zoom-reset'])
    expect(wrapper.find('[data-testid="zoom-level"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="canvas-strip-zoom"]').attributes('data-zoom-percent')).toBe('125')

    for (const id of ['strip-rotate-canvas', 'strip-rulers', 'strip-undo', 'strip-redo', 'zoom-in', 'zoom-out', 'zoom-reset']) await wrapper.get(`[data-testid="${id}"]`).trigger('click')
    expect(Object.keys(wrapper.emitted())).toEqual(expect.arrayContaining(['rotate-canvas', 'toggle-rulers', 'undo', 'redo', 'zoom-in', 'zoom-out', 'reset']))
  })

  it('shows Menu and Project as icon + text, and asks for their sheets (ticket 431)', async () => {
    const wrapper = mount(CanvasStrip, { props: { project, openPanel: 'project' } })

    expect(wrapper.get('[data-testid="strip-menu"]').text()).toBe('Menu')
    expect(wrapper.find('[data-testid="strip-menu"] svg').exists()).toBe(true)
    expect(wrapper.get('[data-testid="strip-project"]').text()).toBe('Project')
    expect(wrapper.get('[data-testid="strip-project"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="strip-menu"]').attributes('aria-pressed')).toBeUndefined()

    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await wrapper.get('[data-testid="strip-project"]').trigger('click')
    expect(wrapper.emitted('select-panel')).toEqual([['menu'], ['project']])
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

  it('has three slots: panels, the Brand, then the tools and zoom together (ticket 543)', () => {
    const wrapper = mount(CanvasStrip, { props: { project, zoomPercent: 100 } })

    const slots = Array.from(wrapper.get('[data-testid="canvas-strip"]').element.children)
    expect(slots.map((slot) => slot.className.split(' ')[0])).toEqual(['canvas-strip__panels', 'canvas-strip__brand', 'canvas-strip__controls'])
    const controls = wrapper.get('[data-testid="canvas-strip-controls"]')
    for (const id of ['strip-rotate-canvas', 'strip-rulers', 'strip-undo', 'strip-redo', 'zoom-out', 'zoom-in', 'zoom-reset']) expect(controls.find(`[data-testid="${id}"]`).exists()).toBe(true)
  })

  it('holds Menu alone with no Project open (ticket 431)', () => {
    const wrapper = mount(CanvasStrip)

    expect(wrapper.find('[data-testid="strip-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="strip-project"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="zoom-in"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="strip-rulers"]').exists()).toBe(false)
  })
})

describe('CanvasStrip Brand and layout (ticket 540)', () => {
  const project = { frame: undefined, beads: { 0: { 0: '#ff0000' } }, technique: 'loom' } as unknown as Project

  it('has Menu first and the Brand, the logo and "openbeads", which opens the Overview from the editor', () => {
    const wrapper = mount(CanvasStrip, { props: { project, zoomPercent: 100 } })
    const first = wrapper.findAll('[data-testid]').find((element) => element.attributes('data-testid')?.startsWith('strip-'))
    expect(first?.attributes('data-testid')).toBe('strip-menu')

    const brand = wrapper.get('[data-testid="canvas-brand"]')
    expect(brand.element.tagName).toBe('A')
    expect(brand.attributes('href')).toContain('overview/')
    expect(brand.attributes('aria-current')).toBeUndefined()
    expect(brand.text()).toBe('openbeads')
    expect(brand.find('[data-testid="app-logo"]').exists()).toBe(true)
  })

  it('shows the Brand as the current page, with no link, on the Overview', () => {
    const wrapper = mount(CanvasStrip, { props: { page: 'overview', zoomPercent: 100 } })
    const brand = wrapper.get('[data-testid="canvas-brand"]')

    expect(brand.element.tagName).toBe('SPAN')
    expect(brand.attributes('href')).toBeUndefined()
    expect(brand.attributes('aria-current')).toBe('page')
  })

  it('keeps the words of Menu and Project in the page for a screen reader, and has no Canvas color control', () => {
    const wrapper = mount(CanvasStrip, { props: { project, zoomPercent: 100 } })

    expect(wrapper.get('[data-testid="strip-menu"] .canvas-strip__label').text()).toBe('Menu')
    expect(wrapper.get('[data-testid="strip-project"] .canvas-strip__label').text()).toBe('Project')
    expect(wrapper.find('[data-testid="canvas-color"]').exists()).toBe(false)
  })

  it('holds Menu, the Brand and the framing zoom while a picture is framed', () => {
    const wrapper = mount(CanvasStrip, { props: { zoomPercent: 200, zoomMinPercent: 100, zoomMaxPercent: 800 } })

    expect(wrapper.find('[data-testid="strip-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="canvas-brand"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="zoom-out"]').exists()).toBe(true)
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

describe('CanvasStrip Tab stops (ticket 563, ADR 0075)', () => {
  const project = { frame: undefined, beads: { 0: { 0: '#ff0000' } }, technique: 'loom' } as unknown as Project
  const props = { project, canUndo: true, canRedo: true, zoomPercent: 125 }
  const stops = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findAll('button, a').filter((el) => el.attributes('tabindex') !== '-1').map((el) => el.attributes('data-testid'))

  it('is three Tab stops: a panel button, the Wordmark and a right-hand tool', () => {
    const wrapper = mount(CanvasStrip, { props, attachTo: document.body })
    expect(stops(wrapper)).toEqual(['strip-menu', 'canvas-brand', 'strip-rotate-canvas'])
    wrapper.unmount()
  })

  it('steps ←/→ inside the panels and stops at the ends', async () => {
    const wrapper = mount(CanvasStrip, { props, attachTo: document.body })
    const menu = wrapper.get('[data-testid="strip-menu"]')
    const projectButton = wrapper.get('[data-testid="strip-project"]')
    ;(menu.element as HTMLElement).focus()
    await menu.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(menu.element)
    await menu.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(projectButton.element)
    await projectButton.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(projectButton.element)
    wrapper.unmount()
  })

  it('keeps the right-hand tools in one section, moving its Tab stop to the last focused one', async () => {
    const wrapper = mount(CanvasStrip, { props, attachTo: document.body })
    const rulers = wrapper.get('[data-testid="strip-rulers"]')
    ;(rulers.element as HTMLElement).focus()
    await rulers.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(wrapper.get('[data-testid="strip-undo"]').element)
    expect(stops(wrapper)).toEqual(['strip-menu', 'canvas-brand', 'strip-undo'])
    const reset = wrapper.get('[data-testid="zoom-reset"]')
    ;(reset.element as HTMLElement).focus()
    await reset.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(reset.element)
    wrapper.unmount()
  })

  it('opens a panel on ↓ like Enter, but not one that is already open', async () => {
    const wrapper = mount(CanvasStrip, { props: { ...props, openPanel: 'project' }, attachTo: document.body })
    await wrapper.get('[data-testid="strip-menu"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('[data-testid="strip-project"]').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('select-panel')).toEqual([['menu']])
    wrapper.unmount()
  })
})
