import { frameIdIn } from '../../testUtils/frameId'
import { firstOf, SECOND, twoFrames } from '../../testUtils/twoFrames'
import { withFrameSheet } from '../../domain/frameSheet'
import { onCanvas } from '../../testUtils/onCanvas'
import { turnTableTo } from '../../domain/rotate'
import { tableTurnOf } from '../../domain/table'
import { frameById } from '../../domain/layerRecord'
import { describe, expect, it, vi } from 'vitest'
import { colorAt, withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { moveToRow, rowProgressOf } from '../../domain/rowProgress'
import { turnedWithFrame } from '../../domain/rowWays'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useRotateFrameFlow } from './useRotateFrameFlow'
import { useDialogs } from '../shell/useDialogs'
import { beadsOfLayer, frameOf } from '../../domain/layerRecord'
import { frameSheetOf, withLayers } from '../../testUtils/layerFields'

const GREEN = '#00aa00'
const RED = '#e63746'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A 4 x 6 Frame at (20, 20) with a red bead in its first row, over a Canvas holding a green one under it. */
const framed: Project = withLayers(base, {
frame: { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) },
  beads: withColors({}, [{ row: 21, column: 21, color: GREEN }]),
})

function setup(project: Project | null = framed) {
  const harness = editHarness(project ?? undefined)
  const deps = {
    edit: harness.edit,
    currentProject: harness.currentProject,
    announce: vi.fn(),
    showToast: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
    dialogs: useDialogs(),
  }
  return { deps, harness, ...useRotateFrameFlow(deps) }
}

describe('useRotateFrameFlow (tickets 471, 0667, ADR 0066, 0079)', () => {
  it('turns the Frame a quarter as one step, its beads where they were, and Undo brings back its orientation', () => {
    const { deps, harness, onRotateFrame } = setup()
    onRotateFrame()

    expect(frameOf(harness.project)).toMatchObject({ quarterTurns: 1 })
    expect(deps.announce).toHaveBeenCalledWith('Frame rotated')

    harness.history.onUndo()
    expect(frameSheetOf(harness.project)).toEqual(frameSheetOf(framed))
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('counts each press, so the Frame is seen turning on a press and never on an Undo (ticket 1016)', () => {
    const { harness, onRotateFrame, frameTurns } = setup()
    onRotateFrame()
    onRotateFrame()
    expect(frameTurns.value).toBe(2)
    harness.history.onUndo()
    expect(frameTurns.value).toBe(2)
    const none = setup(withLayers(base, { frame: undefined }))
    none.onRotateFrame()
    expect(none.frameTurns.value).toBe(0)
  })

  it('resets what was built against the old Frame, as any change of the Frame does', () => {
    const { harness, onRotateFrame } = setup()
    onRotateFrame()
    expect(harness.resetAfterFrameChange).toHaveBeenCalledTimes(1)
  })

  it('leaves the Canvas where it is: nothing is covered or turned', () => {
    const { harness, onRotateFrame } = setup()
    onRotateFrame()
    expect(beadsOfLayer(harness.project, 'canvas')).toBe(beadsOfLayer(framed, 'canvas'))
  })

  it('asks first once a row is marked done, and Cancel leaves the Project as it was (ticket 1184)', () => {
    const woven = moveToRow(framed, 1, frameIdIn(framed))
    const { deps, harness, onRotateFrame, rotateFramePrompt, cancelRotateFrame, frameTurns } = setup(woven)
    onRotateFrame()

    expect(deps.dialogs.open.value).toBe('rotate-frame')
    expect(rotateFramePrompt.value).toEqual({
      title: 'Turn the Frame?',
      message: '1 row is marked done, woven top to bottom. This can be undone.',
      startOver: 'Start over top to bottom',
      keep: 'Keep the 1 row',
    })
    expect(harness.project).toBe(woven)

    cancelRotateFrame()
    expect(deps.dialogs.open.value).toBeUndefined()
    expect(harness.project).toBe(woven)
    expect(harness.history.canUndo.value).toBe(false)
    expect(frameTurns.value).toBe(0)
    expect(deps.announce).not.toHaveBeenCalled()
  })

  it('keeps the rows: the Frame turns with its rows, and one Undo brings it back (tickets 0647, 1184)', () => {
    const woven = moveToRow(framed, 1, frameIdIn(framed))
    const { deps, harness, onRotateFrame, keepRowsRotateFrame } = setup(woven)
    onRotateFrame()
    keepRowsRotateFrame()

    // Row 1 is done: the same beads stay finished, the red bead in it kept, not trimmed.
    expect(deps.dialogs.open.value).toBeUndefined()
    expect(frameOf(harness.project)).toMatchObject({ quarterTurns: 1 })
    expect(rowProgressOf(harness.project, frameIdIn(harness.project))).toEqual(turnedWithFrame(rowProgressOf(woven, frameIdIn(woven)), 1))
    expect(colorAt(frameOf(harness.project)!.beads, 0, 0)).toBe(RED)
    expect(deps.announce).toHaveBeenCalledWith('Frame rotated')

    harness.history.onUndo()
    expect(frameSheetOf(harness.project)).toEqual(frameSheetOf(woven))
    expect(rowProgressOf(harness.project, frameIdIn(harness.project))).toEqual(rowProgressOf(woven, frameIdIn(woven)))
  })

  it('starts over: the Frame turns, its progress back at the first row in the way as seen, one Undo step (ticket 1184)', () => {
    const woven = moveToRow(framed, 1, frameIdIn(framed))
    const { harness, onRotateFrame, startOverRotateFrame } = setup(woven)
    onRotateFrame()
    startOverRotateFrame()

    expect(frameOf(harness.project)).toMatchObject({ quarterTurns: 1 })
    expect(rowProgressOf(harness.project, frameIdIn(harness.project))).toEqual({ way: 'down' })

    harness.history.onUndo()
    expect(rowProgressOf(harness.project, frameIdIn(harness.project))).toEqual(rowProgressOf(woven, frameIdIn(woven)))
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('does nothing without a Frame or without a Project', () => {
    for (const project of [withLayers(framed, { frame: undefined }), null]) {
      const { harness, onRotateFrame } = setup(project)
      onRotateFrame()
      expect(harness.replaceProject).not.toHaveBeenCalled()
      expect(harness.history.canUndo.value).toBe(false)
    }
  })
})

describe('useRotateFrameFlow on an empty Frame (ticket 471)', () => {
  it('still turns the Frame when it holds no bead', () => {
    const { harness, onRotateFrame } = setup(withLayers(framed, { frame: { ...frameOf(framed)!, beads: {} } }))
    onRotateFrame()
    expect(frameOf(harness.project)).toMatchObject({ quarterTurns: 1 })
    expect(harness.history.canUndo.value).toBe(true)
  })
})

describe('Rotate Frame names its Frame (ticket 1218)', () => {
  it('turn only the Frame named, and Undo puts back only that turn', () => {
    const project = twoFrames()
    const { harness, onRotateFrame } = setup(project)
    onRotateFrame(SECOND)
    expect(frameById(harness.project, SECOND)!.quarterTurns).toBe(1)
    expect(frameById(harness.project, firstOf(project))).toEqual(frameById(project, firstOf(project)))
    harness.history.onUndo()
    expect(frameById(harness.project, SECOND)).toEqual(frameById(project, SECOND))
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('leaves a Frame unturned, and says which Frame it would meet, where the turn would meet the other Frame (spec 1234)', () => {
    const { deps, harness, onRotateFrame, frameTurns } = setup(twoFrames({ row: 0, column: 14 }, { rows: 20, columns: 2 }))
    onRotateFrame(SECOND)
    expect(harness.history.canUndo.value).toBe(false)
    expect(frameTurns.value).toBe(0)
    expect(deps.announce).not.toHaveBeenCalled()
    expect(deps.showToast).toHaveBeenCalledWith('frame-meets', expect.stringContaining('Frame 1'), 'warning')
  })

  it('turns a peyote Frame on a loom Canvas, with a Table turn on, about its own centre and nothing else', () => {
    const loom = twoFrames()
    const peyote = withFrameSheet(loom, onCanvas(loom, { row: 20, column: 20, rows: 6, columns: 4, beads: {}, technique: 'peyote' }), { frame: SECOND })
    const turned = turnTableTo(peyote, 40)
    const { harness, onRotateFrame } = setup(turned)
    const centre = frameById(turned, SECOND)!.centre
    onRotateFrame(SECOND)
    const after = frameById(harness.project, SECOND)!
    expect(after.quarterTurns).toBe(1)
    expect(after.centre).toEqual(centre)
    expect(tableTurnOf(harness.project)).toBe(40)
    expect(frameById(harness.project, firstOf(peyote))).toEqual(frameById(turned, firstOf(peyote)))
  })
})
