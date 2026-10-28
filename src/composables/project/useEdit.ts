import type { FrameChangeRefusal, FrameChangeResult } from '../../domain/changeFrame'
import { keepAllowedEdits } from '../../domain/allowedEdits'
import { sameFrame } from '../../domain/canvas'
import { restoreSnapshot, snapshotOf, type UndoEntry } from '../../domain/undoSnapshot'
import { sameBeads, sameLayers } from '../../domain/layerBeads'
import type { Project } from '../../domain/project'
import type { ReplaceOptions } from './useProjectLibrary'

// The three kinds of undoable change (ADR 0036): drawing (Paint, Fill, Paste, Eraser, Rotate, Rotate Frame: lock
// applied silently, a no-op is no step), frame (through changeFrame, which refuses; the session resets after),
// exempt (Delete all, Replace Bead: no guards).
type EditKind = 'drawing' | 'frame' | 'exempt'

/** What a command of each kind hands back: the Project it makes, or for a Frame change changeFrame's result. */
export interface EditCommands {
  drawing: (project: Project) => Project
  frame: (project: Project) => FrameChangeResult
  exempt: (project: Project) => Project
}

/** What an Edit came to. */
export type EditOutcome =
  | { kind: 'unchanged' }
  | { kind: 'refused'; reason: FrameChangeRefusal }
  | { kind: 'applied' }

/** `edit(kind, project => result)`: the one way an undoable change reaches the open Project. */
export type EditFn = <K extends EditKind>(kind: K, command: EditCommands[K]) => EditOutcome

/** What Edit needs from the app shell: the open Project and its write path, the history's record, and the session
 * state a change resets. */
export interface EditDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project, options?: ReplaceOptions) => void
  /** useUndoHistory's record: pushes one Undo step. */
  recordHistory: (entry: UndoEntry) => void
  /** What a change of the Frame invalidates: the Selection and the hover, all built against the old Frame. */
  resetAfterFrameChange: () => void
  /** Writes the save every stroke step deferred. */
  flushPendingSave: () => void
}

// Edit (ADR 0036): every undoable change to the open Project goes through here, which applies the rules (row lock,
// beads where the Weave has none, one Undo step, session resets). Outside Edit: Row progress toggles, Row direction and the pointer.
// Deps are read lazily.
export function useEdit(deps: EditDeps) {
  /** What a stroke started from, taken at its start; undefined when none is in progress. */
  let strokeBaseline: UndoEntry | undefined
  /** What a held Frame change started from, and the Project it belongs to; undefined while none is held. */
  let held: { id: string; baseline: UndoEntry } | undefined

  function record(project: Project) {
    deps.recordHistory(snapshotOf(project))
  }

  const edit: EditFn = (kind, command) => {
    settle()
    const project = deps.currentProject()
    if (!project) {
      return { kind: 'unchanged' }
    }

    if (kind === 'frame') {
      return applyFrame((command as EditCommands['frame'])(project), () => record(project))
    }

    const made = (command as EditCommands['drawing'])(project)
    const updated = kind === 'drawing' ? keepAllowedEdits(project, made) : made
    if (updated === project) {
      return { kind: 'unchanged' }
    }
    record(project)
    deps.replaceProject(updated)
    // A drawing command that turned the Frame too (Rotate Frame, ticket 471) leaves the session built on the old one.
    if (!sameFrame(project.frame, updated.frame) || project.technique !== updated.technique) {
      deps.resetAfterFrameChange()
    }
    return { kind: 'applied' }
  }

  /** A Frame change held open (ticket 0640, ADR 0066): it lands on screen and is saved at once, as a frame edit is,
   * but its Undo step waits for `settle`, so however many held changes follow make one step. How a Custom frame's
   * steppers commit once, when the Frame panel closes. */
  function hold(command: EditCommands['frame']): EditOutcome {
    const project = deps.currentProject()
    if (!project) {
      return { kind: 'unchanged' }
    }
    return applyFrame(command(project), () => {
      if (held?.id === project.id) return
      settle()
      held = { id: project.id, baseline: snapshotOf(project) }
    })
  }

  /** A Frame change's result put on the open Project, after `before` takes its Undo step or holds it. */
  function applyFrame(result: FrameChangeResult, before: () => void): EditOutcome {
    if (result.kind === 'refused') {
      return { kind: 'refused', reason: result.reason }
    }
    if (result.kind === 'unchanged') {
      return { kind: 'unchanged' }
    }
    before()
    deps.replaceProject(result.project)
    deps.resetAfterFrameChange()
    return { kind: 'applied' }
  }

  /** Ends a held Frame change: its one Undo step, unless it came back to where it began or its Project is no longer
   * open. Every other Edit, a stroke, Undo and Redo settle first, so the steps stay in order. A no-op when none is held. */
  function settle() {
    const was = held
    held = undefined
    const project = deps.currentProject()
    if (was && project?.id === was.id && !sameLayers(project, was.baseline)) {
      deps.recordHistory(was.baseline)
    }
  }

  /** Starts a Paint/Eraser stroke: the baseline its one Undo step will go back to (ticket 55). */
  function beginStroke() {
    settle()
    const project = deps.currentProject()
    strokeBaseline = project && snapshotOf(project)
  }

  /** One step of a stroke: a drawing edit that lands on screen at once but defers its save and its Undo step to
   * endStroke. */
  function strokeStep(command: EditCommands['drawing']) {
    const project = deps.currentProject()
    if (!project) {
      return
    }
    const updated = keepAllowedEdits(project, command(project))
    if (updated !== project) {
      deps.replaceProject(updated, { deferSave: true })
    }
  }

  /** Ends a stroke: one Undo step if it changed anything, and the one write of the whole stroke. A no-op when no
   * stroke was running. */
  function endStroke() {
    const project = deps.currentProject()
    if (strokeBaseline && project && !sameBeads(project, strokeBaseline)) {
      deps.recordHistory(strokeBaseline)
    }
    strokeBaseline = undefined
    deps.flushPendingSave()
  }

  /** Drops a stroke as if it never began: the baseline goes back, with no Undo step. A no-op when no stroke was
   * running. */
  function cancelStroke() {
    const baseline = strokeBaseline
    const project = deps.currentProject()
    strokeBaseline = undefined
    if (baseline && project && !sameBeads(project, baseline)) {
      restore(baseline)
    }
    deps.flushPendingSave()
  }

  /** Puts a snapshot back for Undo/Redo: replays history, so no guard applies. A Frame or Technique that differs
   * resets the rest. */
  function restore(snapshot: UndoEntry) {
    const project = deps.currentProject()
    if (!project) {
      return
    }
    deps.replaceProject(restoreSnapshot(project, snapshot))
    if (!sameFrame(snapshot.frame, project.frame) || snapshot.technique !== project.technique || snapshot.frame?.technique !== project.frame?.technique) {
      deps.resetAfterFrameChange()
    }
  }

  return { edit, hold, settle, beginStroke, strokeStep, endStroke, cancelStroke, restore }
}

export type Edit = ReturnType<typeof useEdit>
