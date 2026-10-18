import { toRaw } from 'vue'
import type { FrameChangeRefusal, FrameChangeResult } from '../../domain/changeFrame'
import { keepAllowedEdits } from '../../domain/margin'
import type { MirrorAxisCounts } from '../../domain/mirror'
import { sameFrame } from '../../domain/frame'
import { restoreSnapshot, snapshotOf, type Project, type UndoEntry } from '../../domain/project'
import type { ReplaceOptions } from './useProjectLibrary'

// The three kinds of undoable change (ADR 0036): drawing (Paint, Fill, Paste, Eraser, Mirror: lock and keep-out margin
// applied silently, a no-op is no step), frame (through changeFrame, which refuses; the session resets after), exempt
// (Delete all, Replace Bead: no guards).
type EditKind = 'drawing' | 'frame' | 'exempt'

/** What a command of each kind hands back: the Project it makes, or for a Frame change changeFrame's result. */
export interface EditCommands {
  drawing: (project: Project) => Project
  frame: (project: Project) => FrameChangeResult
  exempt: (project: Project) => Project
}

/** What an Edit came to. */
type EditOutcome =
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
  mirrorAxisCounts: () => MirrorAxisCounts
  restoreMirrorAxisCounts: (counts: MirrorAxisCounts) => void
  /** What a change of the Frame invalidates: Mirror's axis counts, the Selection and the hover, all built against
   * the old Frame. */
  resetAfterFrameChange: () => void
  /** Writes the save every stroke step deferred. */
  flushPendingSave: () => void
}

// Edit (ADR 0036): every undoable change to the open Project goes through here, which applies the rules (row lock,
// keep-out margin, one Undo step, session resets). Outside Edit: Row progress toggles, Row direction and the pointer.
// Deps are read lazily.
export function useEdit(deps: EditDeps) {
  /** What a stroke started from, taken at its start; undefined when none is in progress. */
  let strokeBaseline: UndoEntry | undefined

  function record(project: Project) {
    deps.recordHistory(snapshotOf(project, deps.mirrorAxisCounts()))
  }

  const edit: EditFn = (kind, command) => {
    const project = deps.currentProject()
    if (!project) {
      return { kind: 'unchanged' }
    }

    if (kind === 'frame') {
      const result = (command as EditCommands['frame'])(project)
      if (result.kind === 'refused') {
        return { kind: 'refused', reason: result.reason }
      }
      if (result.kind === 'unchanged') {
        return { kind: 'unchanged' }
      }
      record(project)
      deps.replaceProject(result.project)
      deps.resetAfterFrameChange()
      return { kind: 'applied' }
    }

    const made = (command as EditCommands['drawing'])(project)
    const updated = kind === 'drawing' ? keepAllowedEdits(project, made) : made
    if (updated === project) {
      return { kind: 'unchanged' }
    }
    record(project)
    deps.replaceProject(updated)
    return { kind: 'applied' }
  }

  /** Starts a Paint/Eraser stroke: the baseline its one Undo step will go back to (ticket 55). */
  function beginStroke() {
    const project = deps.currentProject()
    strokeBaseline = project && snapshotOf(project, deps.mirrorAxisCounts())
  }

  /** One step of a stroke: a drawing edit that lands on screen at once but defers its save and its Undo step to
   * endStroke. */
  function strokeStep(command: EditCommands['drawing']) {
    // Worked on as the Project itself, not through the library's reactive wrapper: a step reads a bead or two, but
    // comparing what it left for finished rows reads them all, and each read through a proxy is many times the cost.
    const current = deps.currentProject()
    const project = current && toRaw(current)
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
    if (strokeBaseline && project && project.beads !== strokeBaseline.beads) {
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
    if (baseline && project && project.beads !== baseline.beads) {
      restore(baseline)
    }
    deps.flushPendingSave()
  }

  /** Puts a snapshot back for Undo/Redo: replays history, so no guard applies. Mirror's counts come from the
   * snapshot; a Frame or Technique that differs resets the rest. */
  function restore(snapshot: UndoEntry) {
    const project = deps.currentProject()
    if (!project) {
      return
    }
    deps.replaceProject(restoreSnapshot(project, snapshot))
    if (!sameFrame(snapshot.frame, project.frame) || snapshot.technique !== project.technique) {
      deps.resetAfterFrameChange()
    }
    deps.restoreMirrorAxisCounts(snapshot.mirrorAxisCounts)
  }

  return { edit, beginStroke, strokeStep, endStroke, cancelStroke, restore }
}

export type Edit = ReturnType<typeof useEdit>
