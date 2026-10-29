import { beforeEach, describe, expect, it } from 'vitest'
import { createProject } from '../domain/createProject'
import { withBackground, withFrameSheet } from '../domain/layerRecord'
import { PREFERENCES } from '../services/devicePreferences'
import { useCanvasBackground } from './useCanvasBackground'

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
