import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import { withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { RADIAL_HOLE, RADIAL_RING } from '../../domain/radialToolbox'
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
  const recents = ref(['#111111', '#222222'])
  const onSelectCustomColor = vi.fn()
  const { takeColorAt } = usePickColor({ picking: ref(false), currentProject: () => project.value, onSelectCustomColor })
  const deps = {
    currentProject: () => project.value,
    readOnly: () => readOnly.value,
    demo,
    canUndo: () => can.undo.value,
    canRedo: () => can.redo.value,
    recents: () => recents.value,
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

describe('useRadialToolboxFlow near a screen edge (ticket 1076)', () => {
  /** A ring on a 1000 x 800 screen, at the given text size. */
  const on = (scale = 1) => useRadialToolboxFlow({ ...setup().deps, screen: () => ({ width: 1000, height: 800, scale }) })

  it('a press with room on every side opens the ring centred on it', () => {
    const ring = on()
    ring.openAt(AT)
    expect(ring.center.value).toEqual(AT)
  })

  it('a press in a corner opens the ring as near it as keeps the whole ring and its name on the screen', () => {
    const ring = on()
    ring.openAt({ x: 5, y: 5 })
    expect(ring.center.value).toEqual({ x: 120, y: 158 })
    ring.openAt({ x: 995, y: 795 })
    expect(ring.center.value).toEqual({ x: 880, y: 680 })
  })

  it('keeps its room in the screen px of a larger text size, where the ring is drawn larger', () => {
    const ring = on(1.5)
    ring.openAt({ x: 0, y: 400 })
    expect(ring.center.value).toEqual({ x: 180, y: 400 })
  })

  it('with no screen given it opens on the pressed point', () => {
    const { ring } = setup()
    ring.openAt({ x: 5, y: 5 })
    expect(ring.center.value).toEqual({ x: 5, y: 5 })
  })

  it('names the pressed position while the ring is open, moved or not, and none once it closes', () => {
    const ring = on()
    expect(ring.pressed.value).toBeUndefined()
    ring.openAt({ x: 5, y: 5 }, { row: 2, column: 2 })
    expect(ring.pressed.value).toEqual({ row: 2, column: 2 })
    ring.close()
    expect(ring.pressed.value).toBeUndefined()

    // Between positions there is none to outline.
    ring.openAt(AT)
    expect(ring.pressed.value).toBeUndefined()
  })
})

describe('useRadialToolboxFlow: the slide (ticket 1077)', () => {
  /** A point of the screen `distance` from the ring opened at AT, at `angle` clockwise from straight up. */
  const toward = (angle: number, distance: number = RADIAL_RING.radius, from = AT) => {
    const radians = (angle * Math.PI) / 180
    return { x: from.x + distance * Math.sin(radians), y: from.y - distance * Math.cos(radians) }
  }
  // Where the items stand (RADIAL_PLACES): the angle of each tile's centre.
  const ERASER = 129
  const RECENT_1 = 343
  const RECENT_3 = 51
  const PICK_COLOR = 309
  const UNDO = 270
  const REDO = 90

  it('names the item under the sliding pointer by its slice: on the tile, short of it in the band, and well past the ring', () => {
    const { ring } = setup()
    ring.openAt(AT)
    for (const distance of [RADIAL_RING.radius, RADIAL_HOLE + 1, 600]) {
      ring.slide(toward(ERASER, distance))
      expect(ring.held.value).toBe('tool-erase')
    }
    ring.slide(toward(UNDO))
    expect(ring.held.value).toBe('undo')
  })

  it('names none in the hole, none once the slide ended, and none when the ring opens again', () => {
    const { ring } = setup()
    ring.openAt(AT)
    ring.slide(toward(ERASER))
    ring.slide(toward(ERASER, RADIAL_HOLE - 1))
    expect(ring.held.value).toBeUndefined()

    ring.slide(toward(ERASER))
    ring.slide()
    expect(ring.held.value).toBeUndefined()

    ring.slide(toward(ERASER))
    ring.openAt(AT)
    expect(ring.held.value).toBeUndefined()
  })

  it('a lift on a tool picks it through the Tool pill\'s handler and closes the ring, which leaves with it pressed', () => {
    const { ring, deps } = setup()
    ring.openAt(AT)
    ring.slide(toward(ERASER))
    ring.slideLift(toward(ERASER, 600))
    expect(deps.onSelectTool).toHaveBeenCalledExactlyOnceWith('erase')
    expect(ring.open.value).toBe(false)
    expect(ring.held.value).toBe('tool-erase')
  })

  it('a lift on a recent colour picks the colour the Tool pill shows in that place', () => {
    const { ring, deps } = setup()
    ring.openAt(AT)
    ring.slideLift(toward(RECENT_1))
    expect(deps.pickRecent).toHaveBeenCalledExactlyOnceWith('#111111')
    expect(ring.open.value).toBe(false)
  })

  it('a lift on Pick color from Canvas takes the pressed bead\'s colour and closes the ring', () => {
    const { ring, onSelectCustomColor } = setup()
    ring.openAt(AT, { row: 2, column: 2 })
    ring.slideLift(toward(PICK_COLOR))
    expect(onSelectCustomColor).toHaveBeenCalledExactlyOnceWith(GREEN)
    expect(ring.open.value).toBe(false)
  })

  it('a lift on Undo or Redo runs it and keeps the ring open, with nothing left pressed', () => {
    const { ring, deps } = setup()
    ring.openAt(AT)
    ring.slide(toward(UNDO))
    ring.slideLift(toward(UNDO))
    ring.slideLift(toward(REDO))
    expect(deps.onUndo).toHaveBeenCalledTimes(1)
    expect(deps.onRedo).toHaveBeenCalledTimes(1)
    expect(ring.open.value).toBe(true)
    expect(ring.held.value).toBeUndefined()
  })

  it('a lift on an item that is off picks nothing and leaves the ring open', () => {
    const { ring, deps, can, onSelectCustomColor } = setup()
    can.undo.value = false
    can.redo.value = false
    // No bead was pressed, and the Tool pill shows two recent colours only.
    ring.openAt(AT)
    for (const angle of [UNDO, REDO, PICK_COLOR, RECENT_3]) ring.slideLift(toward(angle))
    expect(deps.onUndo).not.toHaveBeenCalled()
    expect(deps.onRedo).not.toHaveBeenCalled()
    expect(deps.pickRecent).not.toHaveBeenCalled()
    expect(onSelectCustomColor).not.toHaveBeenCalled()
    expect(ring.open.value).toBe(true)
    expect(ring.held.value).toBeUndefined()
  })

  it('a lift in the hole closes the ring with nothing picked', () => {
    const { ring, deps } = setup()
    ring.openAt(AT)
    ring.slide(toward(ERASER))
    ring.slideLift(toward(ERASER, RADIAL_HOLE - 1))
    expect(ring.open.value).toBe(false)
    expect(deps.onSelectTool).not.toHaveBeenCalled()
    expect(ring.held.value).toBeUndefined()
  })

  it('a lift after the ring has closed (Escape mid-slide) picks nothing', () => {
    const { ring, deps } = setup()
    ring.openAt(AT)
    ring.close()
    ring.slide(toward(ERASER))
    ring.slideLift(toward(ERASER))
    expect(ring.held.value).toBeUndefined()
    expect(deps.onSelectTool).not.toHaveBeenCalled()
  })

  it('measures from where the ring stands, not where it was pressed, in the screen px of the text size', () => {
    const ring = useRadialToolboxFlow({ ...setup().deps, screen: () => ({ width: 1000, height: 800, scale: 1.5 }) })
    // Pressed in the corner, the ring stands at (180, 237): the pressed point is up and left of it, on Pick color.
    ring.openAt({ x: 5, y: 5 })
    ring.slide({ x: 5, y: 5 })
    expect(ring.held.value).toBe('pick-color')
    // Its hole is 90 screen px at this text size.
    ring.slide(toward(ERASER, RADIAL_HOLE * 1.5 - 1, ring.center.value))
    expect(ring.held.value).toBeUndefined()
    ring.slide(toward(ERASER, RADIAL_HOLE * 1.5 + 1, ring.center.value))
    expect(ring.held.value).toBe('tool-erase')
  })
})
