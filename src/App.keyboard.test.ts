import { createProject } from './domain/createProject'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { openColorPopover } from './testUtils/pill'
import { beadColor, drawnProject } from './testUtils/beads'
import { frameOf } from './domain/layerRecord'

/** Landmarks, the Project's name, the Tab stops and the bead cursor (tickets 159, 0942; `accessibility.md`). */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

async function openProject(columns = 6, rows = 4) {
  saveProjects([createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })])
  return mount(App, { attachTo: document.body })
}

const surface = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="project-surface"]')

describe('the Project for a screen reader (ticket 159, ADR 0093)', () => {
  it('is an image named for what it shows, and one keyboard stop', async () => {
    const wrapper = await openProject()

    expect(surface(wrapper).attributes('tabindex')).toBe('0')
    expect(surface(wrapper).attributes('role')).toBe('img')
    expect(surface(wrapper).attributes('aria-label')).toMatch(/, 6 by 4 beads, 0 colors, row 0 of 4 done$/)
  })

  it('has the Tool pill\'s Tools landmark, one main and one banner, and no skip link', async () => {
    const wrapper = await openProject()

    expect(wrapper.find('[data-testid="tool-pill"]').attributes('aria-label')).toBe(en.a11y.toolsLandmark)
    expect(wrapper.find('main').find('[data-testid="project-surface"]').exists()).toBe(true)
    // One main and one banner (ticket 0856): the Canvas strip is a header outside main, the Progress bar inside it.
    expect(wrapper.findAll('main')).toHaveLength(1)
    expect(wrapper.find('main').find('[data-testid="progress-bar"]').exists()).toBe(true)
    expect(wrapper.findAll('header').map((header) => header.attributes('data-testid'))).toEqual(['canvas-strip'])
    expect(wrapper.get('[data-testid="canvas-strip"]').element.closest('main')).toBeNull()
    expect(wrapper.find('[data-testid="skip-to-project"]').exists()).toBe(false)
  })
})

describe('the bead cursor (ticket 0942, ADR 0093)', () => {
  it('rings the Frame\'s first bead when Tab reaches the Pattern, paints it on Space, and Undo takes it back', async () => {
    const wrapper = await openProject()
    const frame = frameOf(drawnProject(wrapper))!
    const first = { row: frame.row, column: frame.column }
    await surface(wrapper).trigger('focus')
    expect(wrapper.find('[data-testid="bead-cursor"]').exists()).toBe(true)

    await surface(wrapper).trigger('keydown', { key: ' ', code: 'Space' })
    expect(beadColor(wrapper, first)).not.toBeNull()

    await wrapper.get('[data-testid="strip-undo"]').trigger('click')
    expect(beadColor(wrapper, first)).toBeNull()
    wrapper.unmount()
  })
})

describe('one Tab stop per group (ticket 159)', () => {
  it('makes the selected swatch the Palette\'s only stop', async () => {
    const wrapper = await openProject()
    await openColorPopover(wrapper)
    const stops = wrapper.findAll('[data-testid="palette-swatch"]').filter((swatch) => swatch.attributes('tabindex') === '0')

    expect(stops).toHaveLength(1)
    expect(stops[0]!.attributes('aria-pressed')).toBe('true')
  })
})

describe('Tab visits the strip, the Tool pill, then the Progress bar (ticket 563, ADR 0075)', () => {
  it('reaches one stop per strip section, one in the Tool pill, then the Progress bar', async () => {
    const wrapper = await openProject()
    const stops = [...document.querySelectorAll<HTMLElement>('button, a[href]')].filter((el) => el.tabIndex === 0 && !el.closest('[aria-hidden="true"]'))
    const regions = stops.map((el) => el.closest('[data-testid="canvas-strip"], [data-testid="tool-pill"], [data-testid="progress-bar"], [data-testid="context-bar"]')?.getAttribute('data-testid'))

    expect(regions.slice(0, 5)).toEqual(['canvas-strip', 'canvas-strip', 'canvas-strip', 'tool-pill', 'progress-bar'])
    expect(stops[3]!.getAttribute('data-testid')).toBe('pill-tool-paint')
    wrapper.unmount()
  })
})
