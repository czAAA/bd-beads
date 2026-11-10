import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { createProject } from '../domain/createProject'
import { withBackground, withFrameSheet } from '../domain/layerRecord'
import { PREFERENCES } from '../services/devicePreferences'
import { provideMarginLeastScale, useCanvasBackground } from './useCanvasBackground'

const framed = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })

beforeEach(() => {
  for (const name of ['canvasBackground', 'canvasCustomColor'] as const) localStorage.removeItem(PREFERENCES[name].key)
  document.documentElement.dataset.theme = 'light'
  useCanvasBackground().remember(1)
})

describe('useCanvasBackground (ticket 0666)', () => {
  it('draws the Canvas and the Frame each on its own Background, the margin\'s Auto off the Canvas\'s', () => {
    const project = withBackground(withBackground(framed(), 'canvas', 2), 'frame', '#336699')
    const looks = useCanvasBackground(() => project)
    expect(looks.projectTheme.value.canvas).toBe('#f7f3ec')
    expect(looks.frameTheme.value.canvas).toBe('#336699')
    expect(looks.margin.auto.value).toBe('#ebe7e0')
  })

  it('shows the device\'s last pick on a layer without one, and the Canvas\'s for a Frame the Project lacks', () => {
    useCanvasBackground().remember(3)
    expect(useCanvasBackground(() => framed()).shownOf('frame').choice).toBe(3)
    const open = withBackground(withFrameSheet(framed(), undefined), 'canvas', 5)
    expect(useCanvasBackground(() => open).shownOf('frame').choice).toBe(5)
  })

  it('remembers a Custom color picked as the device\'s last pick and its last Custom color', () => {
    const device = useCanvasBackground()
    device.remember('#7a2e8c')
    expect(device.start.value).toBe('#7a2e8c')
    device.remember(4)
    expect(device.start.value).toBe(4)
    expect(device.customColor.value).toBe('#7a2e8c')
  })
})

describe('the margin sheet\'s least scale (ticket 0851)', () => {
  /** The least scale a sheet below a shell is drawn at, with the shell giving one or not. */
  function leastBelow(given?: number): number | undefined {
    let least: number | undefined
    const Sheet = defineComponent({ setup: () => ((least = useCanvasBackground().projectTheme.value.margin.leastScale), () => null) })
    const Shell = defineComponent({ setup: () => (given !== undefined && provideMarginLeastScale(given), () => h(Sheet)) })
    const app = createApp(Shell)
    app.mount(document.createElement('div'))
    app.unmount()
    return least
  }

  it('is the Homepage demo\'s where its shell gives one, and the app\'s own otherwise', () => {
    expect(leastBelow(0.6)).toBe(0.6)
    expect(leastBelow()).toBeUndefined()
  })
})
