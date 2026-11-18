import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { withLayers } from '../../testUtils/layerFields'
import { usePickColor } from './usePickColor'
import { useRadialToolboxFlow } from './useRadialToolboxFlow'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 4 x 6 Frame at (20, 20) with a red bead at its first position, over a Canvas holding a green bead at (2, 2) and
 * another in the Frame's margin, at (18, 18). */
const framed: Project = withLayers(base, {
  frame: { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) },
  beads: withColors({}, [{ row: 2, column: 2, color: GREEN }, { row: 18, column: 18, color: '#0000ff' }]),
})

const AT = { x: 300, y: 200 }

/** The flow over one Project, with Pick color's real step (ticket 1073) and spies for the controls' handlers. */
function setup({ demo = false }: { demo?: boolean } = {}) {
  const project = shallowRef<Project | null>(framed)
  const readOnly = ref(false)
  const can = { undo: ref(true), redo: ref(true) }
  const onSelectCustomColor = vi.fn()
  const { takeColorAt } = usePickColor({ picking: ref(false), currentProject: () => project.value, onSelectCustomColor })
  const deps = {
    currentProject: () => project.value,
    readOnly: () => readOnly.value,
    demo,
    canUndo: () => can.undo.value,
    canRedo: () => can.redo.value,
    onSelectTool: vi.fn(),
    pickRecent: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    takeColorAt,
  }
  return { project, readOnly, can, deps, onSelectCustomColor, ring: useRadialToolboxFlow(deps) }
}

describe('useRadialToolboxFlow (ticket 1064)', () => {
  it('opens centred on the pressed point, on the pressed bead, and closes', () => {
    const { ring } = setup()
    expect(ring.open.value).toBe(false)

    ring.openAt(AT, { row: 2, column: 2 })
    expect(ring.open.value).toBe(true)
    expect(ring.center.value).toEqual(AT)
    expect(ring.beadHex.value).toBe(GREEN)

    ring.close()
    expect(ring.open.value).toBe(false)
    // It leaves where it stood.
    expect(ring.center.value).toEqual(AT)
  })

  it('does not open on a read-only Canvas, with no Project open, or on the Homepage demo', () => {
    const readOnly = setup()
    readOnly.readOnly.value = true
    readOnly.ring.openAt(AT, { row: 2, column: 2 })
    expect(readOnly.ring.open.value).toBe(false)

    const empty = setup()
    empty.project.value = null
    empty.ring.openAt(AT)
    expect(empty.ring.open.value).toBe(false)

    const demo = setup({ demo: true })
    demo.ring.openAt(AT, { row: 2, column: 2 })
    expect(demo.ring.open.value).toBe(false)
  })

  it('closes when the Canvas turns read-only or the Project closes under it', async () => {
    const turned = setup()
    turned.ring.openAt(AT)
    turned.readOnly.value = true
    await nextTick()
    expect(turned.ring.open.value).toBe(false)

    const closed = setup()
    closed.ring.openAt(AT)
    closed.project.value = null
    await nextTick()
    expect(closed.ring.open.value).toBe(false)
  })

  it('a tool goes to the Tool pill\'s handler and closes the ring', () => {
    const { ring, deps } = setup()
    ring.openAt(AT)
    ring.selectTool('erase')
    expect(deps.onSelectTool).toHaveBeenCalledExactlyOnceWith('erase')
    expect(ring.open.value).toBe(false)
  })

  it('a recent colour goes to the Tool pill\'s handler and closes the ring', () => {
    const { ring, deps } = setup()
    ring.openAt(AT)
    ring.pickRecent('#123456')
    expect(deps.pickRecent).toHaveBeenCalledExactlyOnceWith('#123456')
    expect(ring.open.value).toBe(false)
  })

  it('Undo and Redo go to the Canvas strip\'s handlers and keep the ring open; with nothing to undo or redo they do nothing', () => {
    const { ring, deps, can } = setup()
    ring.openAt(AT)
    ring.undo()
    ring.undo()
    ring.redo()
    expect(deps.onUndo).toHaveBeenCalledTimes(2)
    expect(deps.onRedo).toHaveBeenCalledTimes(1)
    expect(ring.open.value).toBe(true)

    can.undo.value = false
    can.redo.value = false
    ring.undo()
    ring.redo()
    expect(deps.onUndo).toHaveBeenCalledTimes(2)
    expect(deps.onRedo).toHaveBeenCalledTimes(1)
    expect(ring.open.value).toBe(true)
  })

  it('Pick color from Canvas takes the pressed bead\'s colour, on the Canvas or in the Frame, and closes the ring', () => {
    const { ring, onSelectCustomColor } = setup()
    ring.openAt(AT, { row: 2, column: 2 })
    ring.pickColor()
    expect(onSelectCustomColor).toHaveBeenCalledExactlyOnceWith(GREEN)
    expect(ring.open.value).toBe(false)

    ring.openAt(AT, { row: 20, column: 20, layer: 'frame' })
    expect(ring.beadHex.value).toBe(RED)
    ring.pickColor()
    expect(onSelectCustomColor).toHaveBeenLastCalledWith(RED)
  })

  it('Pick color from Canvas is off on an empty position, over the Frame\'s margin and off the beads: it takes nothing and the ring stays', () => {
    const { ring, onSelectCustomColor } = setup()
    for (const position of [{ row: 0, column: 0 }, { row: 18, column: 18 }, undefined]) {
      ring.openAt(AT, position)
      expect(ring.beadHex.value).toBeNull()
      ring.pickColor()
      expect(ring.open.value).toBe(true)
    }
    expect(onSelectCustomColor).not.toHaveBeenCalled()
  })

  it('follows the pressed bead as the Project holds it now, so an Undo that changes it changes what Pick color takes', () => {
    const { ring, project } = setup()
    ring.openAt(AT, { row: 2, column: 2 })
    expect(ring.beadHex.value).toBe(GREEN)

    project.value = withLayers(framed, { beads: withColors({}, [{ row: 2, column: 2, color: RED }]) })
    expect(ring.beadHex.value).toBe(RED)

    project.value = withLayers(framed, { beads: {} })
    expect(ring.beadHex.value).toBeNull()
  })

  describe('the hold (ticket 1065)', () => {
    it('shows the hairline where a hold is timed, and none once it stopped', () => {
      const { ring } = setup()
      expect(ring.canOpen.value).toBe(true)

      ring.hold(AT)
      expect(ring.holdAt.value).toEqual(AT)

      ring.hold()
      expect(ring.holdAt.value).toBeUndefined()
    })

    it('a pinch ends the hold: the hairline goes and the surface is told', () => {
      const { ring } = setup()
      ring.hold(AT)

      ring.endHold()

      expect(ring.holdAt.value).toBeUndefined()
      expect(ring.holdEnds.value).toBe(1)
    })

    it('times no hold where the ring would not open: a read-only Canvas, no Project, the Homepage demo', () => {
      const readOnly = setup()
      readOnly.readOnly.value = true
      const empty = setup()
      empty.project.value = null
      for (const { ring } of [readOnly, empty, setup({ demo: true })]) {
        expect(ring.canOpen.value).toBe(false)
        ring.hold(AT)
        expect(ring.holdAt.value).toBeUndefined()
      }
    })
  })
})
