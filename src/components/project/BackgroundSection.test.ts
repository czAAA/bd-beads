import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createProject } from '../../domain/createProject'
import type { Layer } from '../../domain/grid'
import { withBackground } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { PREFERENCES } from '../../services/devicePreferences'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import BackgroundSection from './BackgroundSection.vue'

function setTheme(theme: 'light' | 'dark' | 'contrast') {
  document.documentElement.dataset.theme = theme
}

const framed = (): Project => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })

const mounted: ReturnType<typeof mount>[] = []
function render(project: Project = framed(), layer: Layer = 'canvas') {
  const background = useCanvasBackground(() => project).shownOf(layer).background
  const wrapper = mount(BackgroundSection, { props: { background, layer }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
  localStorage.removeItem(PREFERENCES.canvasBackground.key)
  localStorage.removeItem(PREFERENCES.canvasCustomColor.key)
  setTheme('light')
  useCanvasBackground().remember(1)
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

async function flush() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
}

describe('BackgroundSection (ticket 0666)', () => {
  it('is a radio group of five light swatches named "{name}, {n} of {count}", with the chosen one named under them', () => {
    const wrapper = render()
    const swatches = wrapper.findAll('[role="radio"]')
    expect(swatches.map((s) => s.attributes('aria-label'))).toEqual(['Studio, 1 of 5', 'Linen, 2 of 5', 'Stone, 3 of 5', 'Fog, 4 of 5', 'Pebble, 5 of 5'])
    expect(swatches.map((s) => s.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'false'])
    expect(wrapper.get('[data-testid="background-color-name"]').text()).toBe('Studio #fafafa')
    expect(wrapper.find('[role="radiogroup"][aria-label="Canvas color"]').exists()).toBe(true)
  })

  it('shows the layer\'s own Background, each layer\'s apart, and keeps its position when the theme changes', async () => {
    const project = withBackground(withBackground(framed(), 'canvas', 3), 'frame', 5)
    setTheme('dark')
    await flush()
    const canvas = render(project).findAll('[role="radio"]')
    expect(canvas[2].attributes('aria-label')).toBe('Midnight, 3 of 5')
    expect(canvas[2].attributes('aria-checked')).toBe('true')
    const frame = render(project, 'frame')
    expect(frame.find('[role="radiogroup"][aria-label="Frame background"]').exists()).toBe(true)
    expect(frame.findAll('[role="radio"]')[4].attributes('aria-checked')).toBe('true')
  })

  it('shows the device\'s last pick on a layer saved without one', () => {
    useCanvasBackground().remember(4)
    expect(render().findAll('[role="radio"]')[3].attributes('aria-checked')).toBe('true')
  })

  it('asks for the position of the swatch picked', async () => {
    const wrapper = render(framed(), 'frame')
    await wrapper.get('[data-testid="background-color-stone"]').trigger('click')
    expect(wrapper.emitted('pick')).toEqual([[3]])
  })

  it('asks for a Custom color taken (ticket 0653), and shows the layer\'s own on the tile', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="custom-color-button"]').trigger('click')
    const field = wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
    await field.setValue('#7a2e8c')
    await field.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('pick')).toEqual([['#7a2e8c']])

    const custom = render(withBackground(framed(), 'canvas', '#7a2e8c'))
    expect(custom.get('[data-testid="custom-color-button"]').attributes('aria-pressed')).toBe('true')
    expect(custom.get('[data-testid="background-color-name"]').text()).toBe('Custom color #7a2e8c')
  })

  it('in high contrast says the canvas stays white', async () => {
    setTheme('contrast')
    await flush()
    const wrapper = render()

    expect(wrapper.get('[data-testid="canvas-stays-white"]').text()).toBe('The canvas stays white in high contrast.')
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
  })
})
