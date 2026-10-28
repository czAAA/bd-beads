import { createProject } from './domain/createProject'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { openColorPopover } from './testUtils/pill'

/** Landmarks, the Project's name and the Tab stops that remain (ticket 159; `accessibility.md`, ScreenReaders card). */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

async function openProject(columns = 6, rows = 4) {
  saveProjects([createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })])
  return mount(App, { attachTo: document.body })
}

const surface = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="project-surface"]')

describe('the Project for a screen reader (ticket 159, ADR 0074)', () => {
  it('is an image named for what it shows, with no keyboard stop', async () => {
    const wrapper = await openProject()

    expect(surface(wrapper).attributes('tabindex')).toBeUndefined()
    expect(surface(wrapper).attributes('role')).toBe('img')
    expect(surface(wrapper).attributes('aria-label')).toMatch(/, 6 by 4 beads, 0 colors, row 0 of 4 done$/)
  })

  it('has the Tool pill\'s Tools landmark and main, and no skip link', async () => {
    const wrapper = await openProject()

    expect(wrapper.find('[data-testid="tool-pill"]').attributes('aria-label')).toBe(en.a11y.toolsLandmark)
    expect(wrapper.find('main').find('[data-testid="project-surface"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="skip-to-project"]').exists()).toBe(false)
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
