import { createProject, frameGrid } from './domain/project'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProjectSurface from './components/canvas/ProjectSurface.vue'
import App from './App.vue'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { openSheet, pickColor } from './testUtils/dock'

/*
 * Painting with the keyboard, landmarks and announcements (ticket 159; `accessibility.md`, BeadCursor and ScreenReaders
 * cards).
 */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

async function openProject(columns = 6, rows = 4) {
  saveProjects([createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })])
  return mount(App, { attachTo: document.body })
}

const surface = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="project-surface"]')
const heard = async (wrapper: ReturnType<typeof mount>) => {
  await nextTick()
  await nextTick()
  return wrapper.find('[data-testid="announcer"]').text()
}
const colorAt = (row: number, column: number) => frameGrid(loadProjects()[0]!)[row]![column]!.color

async function focusProject(wrapper: ReturnType<typeof mount>) {
  ;(surface(wrapper).element as HTMLElement).focus()
  await nextTick()
}

async function key(wrapper: ReturnType<typeof mount>, name: string, options: KeyboardEventInit = {}) {
  await surface(wrapper).trigger('keydown', { key: name, ...options })
}

describe('the Project from the keyboard (ticket 159)', () => {
  it('is one Tab stop, an image named for what it shows', async () => {
    const wrapper = await openProject()

    expect(surface(wrapper).attributes('tabindex')).toBe('0')
    expect(surface(wrapper).attributes('role')).toBe('img')
    expect(surface(wrapper).attributes('aria-label')).toMatch(/, 6 by 4 beads, 0 colors$/)
  })

  it('paints with Space, as one undo step, and says so', async () => {
    const wrapper = await openProject()
    await pickColor(wrapper, 'blue')
    await focusProject(wrapper)
    await key(wrapper, 'ArrowRight')

    await key(wrapper, ' ')

    expect(colorAt(0, 1)).toBe('#2f6fed')
    expect(await heard(wrapper)).toBe('Painted Blue')
    await wrapper.find('[data-testid="strip-undo"]').trigger('click')
    expect(colorAt(0, 1)).toBeNull()
  })

  it('marks the cursor\'s row and column on the rulers', async () => {
    const wrapper = await openProject()
    await focusProject(wrapper)
    await key(wrapper, 'ArrowDown')

    expect(document.activeElement).toBe(surface(wrapper).element)
    // The surface is handed the cursor, and the rulers mark its row and column (drawn on the canvas, from this).
    expect(wrapper.findComponent(ProjectSurface).props('cursor')).toEqual({ row: 1, column: 0 })
  })
})

describe('landmarks and the skip link (ticket 159)', () => {
  it('has the Dock\'s Tools landmark and main, and Skip to Project first, which moves focus onto the Project', async () => {
    const wrapper = await openProject()

    expect(wrapper.find('nav').attributes('aria-label')).toBe(en.a11y.toolsLandmark)
    expect(wrapper.find('main').find('[data-testid="project-surface"]').exists()).toBe(true)

    const skip = wrapper.find('[data-testid="skip-to-project"]')
    expect(wrapper.element.firstElementChild).toBe(skip.element)
    await skip.trigger('click')
    expect(document.activeElement).toBe(surface(wrapper).element)
  })
})

describe('one Tab stop per group (ticket 159)', () => {
  it('makes the selected swatch the Palette\'s only stop', async () => {
    const wrapper = await openProject()
    await openSheet(wrapper, 'dock-color')
    const stops = wrapper.findAll('[data-testid="palette-swatch"]').filter((swatch) => swatch.attributes('tabindex') === '0')

    expect(stops).toHaveLength(1)
    expect(stops[0]!.attributes('aria-pressed')).toBe('true')
  })
})
