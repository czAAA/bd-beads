import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { createProject, type Project } from '../../domain/project'
import { useCanvasFraming } from './useCanvasFraming'

const project = createProject({
  technique: 'loom',
  beadId: 'toho-cube-1.5mm',
  size: { width: 4, height: 6, unit: 'beads' },
})

function setup(options: { open?: boolean; framing?: { columns: number; rows: number } } = {}) {
  const open = ref(options.open ?? true)
  const framing = ref(options.framing)
  const convertZoomPercent = ref(60)
  const scope = effectScope()
  const result = scope.run(() =>
    useCanvasFraming({
      currentProject: (): Project | undefined => (open.value ? project : undefined),
      framing: () => (framing.value ? { dimensions: framing.value } : undefined),
      convertZoomPercent: () => convertZoomPercent.value,
    }),
  )!
  return { open, framing, result, stop: () => scope.stop() }
}

describe('useCanvasFraming', () => {
  it('reads the zoom percentage off the same zoom the grid scales by', () => {
    const { result, stop } = setup()
    expect(result.zoomPercent.value).toBe(Math.round(result.zoom.value * 100))
    stop()
  })

  it('leaves the size to the strip itself for the open Project, and shows its zoom', () => {
    const { result, stop } = setup()
    expect(result.stripSize.value).toBeUndefined()
    expect(result.stripZoomPercent.value).toBe(result.zoomPercent.value)
    stop()
  })

  it('shows the framed Project’s grid and the framing zoom while framing, even with a Project open', () => {
    const { result, stop } = setup({ framing: { columns: 10, rows: 12 } })
    expect(result.stripSize.value).toEqual({ columns: 10, rows: 12 })
    expect(result.stripZoomPercent.value).toBe(60)
    stop()
  })

  it('shows nothing with nothing on the board', () => {
    const { result, stop } = setup({ open: false })
    expect(result.stripSize.value).toBeUndefined()
    expect(result.stripZoomPercent.value).toBeUndefined()
    stop()
  })
})
