import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createProject } from '../../domain/createProject'
import { withFrameSheet } from '../../domain/frameSheet'
import { frameIdOf } from '../../domain/layerRecord'
import type { Region, SurfaceView } from '../../rendering/surfaceView'
import { onCanvas } from '../../testUtils/onCanvas'
import type { Project } from '../../domain/project'
import { withLayers } from '../../testUtils/layerFields'
import { frameIdIn } from '../../testUtils/frameId'
import { useRowInView } from './useRowInView'

const framed = withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } }), {
  frame: { technique: 'loom' as const, row: 0, column: 0, rows: 6, columns: 4, beads: {} },
})

function setup() {
  const current = ref<Project | undefined>(framed)
  const placed = ref(false)
  const isAtFit = ref(true)
  const bringIntoView = vi.fn()
  const { showRow } = effectScope().run(() => useRowInView({ currentProject: () => current.value, bringIntoView, placed, isAtFit }))!
  return { current, placed, isAtFit, bringIntoView, showRow }
}

describe('useRowInView (ticket 0934)', () => {
  it('jumps to the current row once the opened Project\'s view is placed, a reload among them, and again for the next Project', async () => {
    const { current, placed, bringIntoView } = setup()
    await nextTick()
    expect(bringIntoView).not.toHaveBeenCalled()
    placed.value = true
    await nextTick()
    expect(bringIntoView).toHaveBeenCalledTimes(1)
    expect(bringIntoView.mock.calls[0]![1]).toEqual({ jump: true, frame: frameIdIn(framed) })

    current.value = { ...framed, id: 'another' }
    await nextTick()
    expect(bringIntoView).toHaveBeenCalledTimes(2)
  })

  it('leaves a view an opening address set where it is', async () => {
    const { placed, isAtFit, bringIntoView } = setup()
    isAtFit.value = false
    placed.value = true
    await nextTick()
    expect(bringIntoView).not.toHaveBeenCalled()
  })

  it('glides to the row on Show row', () => {
    const { bringIntoView, showRow } = setup()
    showRow()
    expect(bringIntoView).toHaveBeenCalledWith(expect.any(Function), { frame: frameIdIn(framed) })
  })

  it('brings the named Frame\'s row into view, not the Last edited Frame\'s (ticket 1243)', () => {
    const second = frameIdOf({ id: 'second' })
    const { current, bringIntoView, showRow } = setup()
    current.value = withFrameSheet(framed, onCanvas(framed, { technique: 'loom', row: 0, column: 100, rows: 6, columns: 4, beads: {} }), { frame: second })
    const surface = { beadToPoint: ({ row, column }: { row: number; column: number }, ref: string) => ({ x: column + (ref === second ? 100 : 0), y: row }), beadStep: () => ({ column: { x: 1, y: 0 }, row: { x: 0, y: 1 } }) } as unknown as SurfaceView
    showRow({ frame: second })
    expect(bringIntoView.mock.calls[0]![1]).toEqual({ frame: second })
    const locate = bringIntoView.mock.calls[0]![0] as (surface: SurfaceView) => Region
    expect(locate(surface).x).toBeGreaterThan(50)
  })
})
