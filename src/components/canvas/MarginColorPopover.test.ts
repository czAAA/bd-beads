import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createProject } from '../../domain/createProject'
import { withBackground } from '../../domain/layerRecord'
import { PREFERENCES } from '../../services/devicePreferences'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { frameIdIn } from '../../testUtils/frameId'
import MarginColorPopover from './MarginColorPopover.vue'

// What the Frame panel's margin section held and its tests asserted (tickets 0656, 0657, 0932), now the Margin color
// popover's first row, its Switch and its line (ticket 1222), and the Frame's Background as its second.

function setTheme(theme: 'light' | 'dark' | 'contrast') {
  document.documentElement.dataset.theme = theme
}

const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })

const mounted: ReturnType<typeof mount>[] = []
function render(shown = project) {
  const anchor = document.createElement('button')
  document.body.append(anchor)
  const wrapper = mount(MarginColorPopover, { props: { project: shown, frame: frameIdIn(shown), anchor }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

async function flush() {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve))
}

const picker = (wrapper: ReturnType<typeof render>) => wrapper.get('[data-testid="margin-color-picker"]')
const radios = (wrapper: ReturnType<typeof render>) => picker(wrapper).findAll('[role="radio"]')

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
  for (const name of ['canvasBackground', 'canvasCustomColor', 'marginColor', 'marginCustomColor', 'marginTitleBlock'] as const) localStorage.removeItem(PREFERENCES[name].key)
  setTheme('light')
  useCanvasBackground().remember(1)
  useCanvasBackground().margin.setChoice('auto')
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

describe('MarginColorPopover (MarginSheet card, tickets 0656, 0657, 1222)', () => {
  it('offers Auto, then the theme\'s three Canvas colors, then Custom color, with Auto chosen and the Canvas color dotted', () => {
    const wrapper = render()
    expect(picker(wrapper).get('[role="radiogroup"]').attributes('aria-label')).toBe('Margin color')
    expect(radios(wrapper).map((r) => r.attributes('aria-label'))).toEqual([
      'Auto, one step off the Canvas color',
      'Studio, the Canvas color',
      'Stone, 2 of 3',
      'Pebble, 3 of 3',
    ])
    expect(radios(wrapper).map((r) => r.attributes('aria-checked'))).toEqual(['true', 'false', 'false', 'false'])
    expect(picker(wrapper).find('[data-testid="custom-color-button"]').exists()).toBe(true)
    expect(picker(wrapper).get('[data-testid="background-color-studio"]').find('[data-testid="background-color-dot"]').exists()).toBe(true)
    expect(picker(wrapper).get('[data-testid="background-color-name"]').text()).toBe('Auto #eeeeee')
    expect(wrapper.get('[data-testid="margin-line"]').text()).toBe('The margin is the space around the Frame where you can’t draw. It holds the Frame’s tools, name and size.')
  })

  it('follows the Canvas\'s Background with Auto, on the swatch and on the sheet (ticket 0666)', async () => {
    const wrapper = render()
    const stone = withBackground(project, 'canvas', 2)
    await wrapper.setProps({ project: stone })
    expect(picker(wrapper).get('[data-testid="background-color-name"]').text()).toBe('Auto #dbd8d3')
    expect(radios(wrapper)[2]!.attributes('aria-label')).toBe('Stone, the Canvas color')
    expect(useCanvasBackground(() => stone).projectTheme.value.margin.fill).toBe('#dbd8d3')
  })

  it('stores the position of a Canvas color picked, and keeps it when the theme changes', async () => {
    const wrapper = render()
    await picker(wrapper).get('[data-testid="background-color-pebble"]').trigger('click')
    expect(localStorage.getItem(PREFERENCES.marginColor.key)).toBe('3')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#cdcac4')

    setTheme('dark')
    await flush()
    expect(radios(wrapper)[3]!.attributes('aria-checked')).toBe('true')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#3b3e43')
  })

  it('stores a Custom color taken, and goes back to Auto', async () => {
    const wrapper = render()
    await picker(wrapper).get('[data-testid="custom-color-button"]').trigger('click')
    const field = wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
    await field.setValue('#7a2e8c')
    await field.trigger('keydown', { key: 'Enter' })
    expect(localStorage.getItem(PREFERENCES.marginColor.key)).toBe('custom')
    expect(localStorage.getItem(PREFERENCES.marginCustomColor.key)).toBe('#7a2e8c')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#7a2e8c')

    await picker(wrapper).get('[data-testid="background-color-auto"]').trigger('click')
    expect(localStorage.getItem(PREFERENCES.marginColor.key)).toBe('auto')
  })

  it('shows Auto while Custom is stored with no Custom color taken yet', () => {
    localStorage.setItem(PREFERENCES.marginColor.key, 'custom')
    useCanvasBackground().margin.setChoice('custom')
    const wrapper = render()
    expect(radios(wrapper)[0]!.attributes('aria-checked')).toBe('true')
    expect(useCanvasBackground().projectTheme.value.margin.fill).toBe('#eeeeee')
  })

  it('shows the title block on the sheet until its Switch is turned off, remembered on the device (ticket 0657)', async () => {
    const wrapper = render()
    const toggle = wrapper.get('[data-testid="margin-title-block-switch"]')
    expect(toggle.attributes('aria-label')).toBe('Name and size on the margin')
    expect(toggle.attributes('aria-checked')).toBe('true')
    await toggle.trigger('click')
    expect(useCanvasBackground().margin.titleBlock.value).toBe(false)
    expect(localStorage.getItem(PREFERENCES.marginTitleBlock.key)).toBe('off')
    await toggle.trigger('click')
    expect(useCanvasBackground().margin.titleBlock.value).toBe(true)
  })

  it('in high contrast offers no margin colors, the sheet being white, and keeps the line', async () => {
    setTheme('contrast')
    await flush()
    const wrapper = render()
    expect(wrapper.find('[data-testid="margin-color-picker"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="margin-line"]').exists()).toBe(true)
  })

  it('sets the Frame\'s Background as its second row, apart from the margin\'s color', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="frame-background-section"] [data-testid="background-color-stone"]').trigger('click')
    expect(wrapper.emitted('set-background')).toEqual([[2]])
    expect(localStorage.getItem(PREFERENCES.marginColor.key)).toBe('auto')
  })
})
