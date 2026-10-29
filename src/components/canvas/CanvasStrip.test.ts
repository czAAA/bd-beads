import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import CanvasStrip from './CanvasStrip.vue'
import { COFFEE_URL } from '../../data/coffeeLink'
import { en } from '../../i18n/en'
import { bareProject } from '../../testUtils/layerFields'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

describe('CanvasStrip', () => {
  it('is shielded from the page panning under a vertical touch drag', () => {
    const wrapper = mount(CanvasStrip, { props: { project } })

    expect(wrapper.find('[data-testid="canvas-strip"]').classes()).toContain('no-page-pan')
  })

  const project = bareProject({ beads: { 0: { 0: '#ff0000' } }, technique: 'loom' })

  it('holds Menu, Project, Frame (with or without one, ticket 555), Rotate canvas, Rulers, Undo, Redo, then the zoom (out, in, Fit) and Export, and passes each press on (tickets 425, 431, 0652)', async () => {
    const wrapper = mount(CanvasStrip, { props: { project, rulers: true, canUndo: true, canRedo: true, zoomPercent: 125 } })

    const order = wrapper.findAll('[data-testid]').map((element) => element.attributes('data-testid'))
    expect(order.filter((id) => id?.startsWith('strip-') || id?.startsWith('zoom-'))).toEqual(['strip-menu', 'strip-project', 'strip-frame', 'strip-coffee', 'strip-rotate-canvas', 'strip-rulers', 'strip-undo', 'strip-redo', 'zoom-out', 'zoom-in', 'zoom-reset', 'strip-export'])
    expect(wrapper.find('[data-testid="zoom-level"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="canvas-strip-zoom"]').attributes('data-zoom-percent')).toBe('125')

    for (const id of ['strip-rotate-canvas', 'strip-rulers', 'strip-undo', 'strip-redo', 'zoom-in', 'zoom-out', 'zoom-reset']) await wrapper.get(`[data-testid="${id}"]`).trigger('click')
    expect(Object.keys(wrapper.emitted())).toEqual(expect.arrayContaining(['rotate-canvas', 'toggle-rulers', 'undo', 'redo', 'zoom-in', 'zoom-out', 'reset']))
  })

  it('has a Buy me a coffee link to the Coffee link, in a new tab with noopener (ticket 560)', () => {
    const link = mount(CanvasStrip, { props: { project } }).get('[data-testid="strip-coffee"]')

    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe(COFFEE_URL)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener')
    expect(link.attributes('aria-label')).toBe('Buy me a coffee')
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

  it('asks for the Export panel from its last button, lit while that panel is open (ticket 0652)', async () => {
    const wrapper = mount(CanvasStrip, { props: { project, zoomPercent: 100 } })
    const exportButton = () => wrapper.get('[data-testid="strip-export"]')

    expect(exportButton().attributes('aria-label')).toBe(en.panels.project.exportHeading)
    expect(exportButton().attributes('aria-pressed')).toBe('false')
    await exportButton().trigger('click')
    expect(wrapper.emitted('select-panel')).toEqual([['export']])

    await wrapper.setProps({ openPanel: 'export' })
    expect(exportButton().attributes('aria-pressed')).toBe('true')
    const noProject = mount(CanvasStrip, { props: { zoomPercent: 100 } })
    expect(noProject.find('[data-testid="strip-export"]').exists()).toBe(false)
    noProject.unmount()
  })

  it('names nothing: no title, size line, estimate, grid icon or hint', () => {
    const wrapper = mount(CanvasStrip, { props: { project, rulers: true, zoomPercent: 100 } })

    // Rotate canvas (ticket 471) is a control named for the Canvas; everything else on the strip names nothing.
    const text = wrapper.text().replace(en.canvas.rotateCanvasLabel, '').replace(en.tooltips.rotateCanvas, '')
    expect(text).not.toMatch(/Schema|Canvas|Width|Height|Pieces/i)
    expect(wrapper.find('svg[data-icon="grid"]').exists()).toBe(false)
  })

  it('has three slots: panels, the Brand, then the tools and zoom together (ticket 543)', () => {
    const wrapper = mount(CanvasStrip, { props: { project, zoomPercent: 100 } })

    const slots = Array.from(wrapper.get('[data-testid="canvas-strip"]').element.children)
    expect(slots.map((slot) => slot.className.split(' ')[0])).toEqual(['canvas-strip__panels', 'canvas-strip__center', 'canvas-strip__controls'])
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
  const project = bareProject({ beads: { 0: { 0: '#ff0000' } }, technique: 'loom' })

  it('has Menu first and the Brand, the logo and "openbeads", which opens the Homepage from the editor', () => {
    const wrapper = mount(CanvasStrip, { props: { project, zoomPercent: 100 } })
    const first = wrapper.findAll('[data-testid]').find((element) => element.attributes('data-testid')?.startsWith('strip-'))
    expect(first?.attributes('data-testid')).toBe('strip-menu')

    const brand = wrapper.get('[data-testid="canvas-brand"]')
    expect(brand.element.tagName).toBe('A')
    expect(brand.attributes('href')).toContain('homepage/')
    expect(brand.attributes('aria-current')).toBeUndefined()
    expect(brand.text()).toBe('openbeads')
    expect(brand.find('[data-testid="app-logo"]').exists()).toBe(true)
  })

  it('shows the Brand as the current page, with no link, on the Homepage', () => {
    const wrapper = mount(CanvasStrip, { props: { page: 'homepage', zoomPercent: 100 } })
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
})

describe('CanvasStrip Rotate canvas (ticket 471)', () => {
  it('is disabled with the reason while the Canvas is empty, and does not ask for a turn', async () => {
    const empty = bareProject({ beads: {}, technique: 'loom', orientation: 0 })
    const wrapper = mount(CanvasStrip, { props: { project: empty } })
    const button = wrapper.get('[data-testid="strip-rotate-canvas"]')

    expect(button.attributes('aria-disabled')).toBe('true')
    await button.trigger('click')
    expect(wrapper.emitted('rotate-canvas')).toBeUndefined()
  })
})

describe('CanvasStrip Tab stops (ticket 563, ADR 0075)', () => {
  const project = bareProject({ beads: { 0: { 0: '#ff0000' } }, technique: 'loom' })
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
    const frameButton = wrapper.get('[data-testid="strip-frame"]')
    expect(document.activeElement).toBe(frameButton.element)
    await frameButton.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(frameButton.element)
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
    const exportButton = wrapper.get('[data-testid="strip-export"]')
    expect(document.activeElement).toBe(exportButton.element)
    await exportButton.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(exportButton.element)
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
