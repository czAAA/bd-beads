import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { withLayers } from '../../testUtils/layerFields'
import { usePickColor } from './usePickColor'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 4 x 6 Frame at (20, 20) with a red bead at its first position, over a Canvas holding a green bead at (2, 2) and
 * another under the Frame at (21, 21). */
const framed: Project = withLayers(base, {
  frame: { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) },
  beads: withColors({}, [{ row: 2, column: 2, color: GREEN }, { row: 21, column: 21, color: '#0000ff' }]),
})

function setup(picking = false, project: Project | null = framed) {
  const deps = { picking: ref(picking), currentProject: () => project, onSelectCustomColor: vi.fn() }
  return { deps, ...usePickColor(deps) }
}

describe('usePickColor', () => {
  describe('pickColorAt (the armed press)', () => {
    it('lets a press through while nothing is armed', () => {
      const { deps, pickColorAt } = setup()
      expect(pickColorAt(2, 2)).toBe(false)
      expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
    })

    it('takes the pressed bead\'s colour, on the Canvas or in the Frame, and ends the pick', () => {
      const canvas = setup(true)
      expect(canvas.pickColorAt(2, 2)).toBe(true)
      expect(canvas.deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith(GREEN)
      expect(canvas.deps.picking.value).toBe(false)
      const frame = setup(true)
      expect(frame.pickColorAt(20, 20)).toBe(true)
      expect(frame.deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith(RED)
      expect(frame.deps.picking.value).toBe(false)
    })

    it('takes the colour of the layer it is told, where the two lie over each other', () => {
      const { deps, pickColorAt } = setup(true)
      pickColorAt(21, 21, 'canvas')
      expect(deps.onSelectCustomColor).toHaveBeenCalledExactlyOnceWith('#0000ff')
    })

    it('takes nothing with no Project', () => {
      const { deps, pickColorAt } = setup(true, null)
      expect(pickColorAt(2, 2)).toBe(true)
      expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
    })

    it('takes nothing from an empty position, keeps the pick armed and still consumes the press', () => {
      const { deps, pickColorAt } = setup(true)
      expect(pickColorAt(0, 0)).toBe(true)
      expect(deps.onSelectCustomColor).not.toHaveBeenCalled()
      expect(deps.picking.value).toBe(true)
    })
  })
})
