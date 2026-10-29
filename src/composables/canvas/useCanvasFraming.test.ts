import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { useCanvasFraming } from './useCanvasFraming'

const project = createProject({
  technique: 'loom',
  beadId: 'toho-cube-1.5mm',
  size: { width: 4, height: 6, unit: 'beads' },
})

function setup(options: { open?: boolean } = {}) {
  const open = ref(options.open ?? true)
  const scope = effectScope()
  const result = scope.run(() =>
    useCanvasFraming({
      currentProject: (): Project | undefined => (open.value ? project : undefined),
    }),
  )!
  return { open, result, stop: () => scope.stop() }
}

describe('useCanvasFraming', () => {
  it('reads the zoom percentage off the same zoom the grid scales by', () => {
    const { result, stop } = setup()
    expect(result.zoomPercent.value).toBe(Math.round(result.zoom.value * 100))
    stop()
  })

  it('shows the open Project’s zoom', () => {
    const { result, stop } = setup()
    expect(result.stripZoomPercent.value).toBe(result.zoomPercent.value)
    stop()
  })

  it('shows nothing with nothing on the board', () => {
    const { result, stop } = setup({ open: false })
    expect(result.stripZoomPercent.value).toBeUndefined()
    stop()
  })
})
