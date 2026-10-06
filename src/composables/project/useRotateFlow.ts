import type { MirrorAxisCounts } from '../../domain/mirror'
import type { Project, UndoEntry } from '../../domain/project'
import { changeFrame } from '../../domain/changeFrame'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'

export interface RotateFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  recordHistory: (entry: UndoEntry) => void
  mirrorAxisCounts: () => MirrorAxisCounts
  clearMirrorAxisCounts: () => void
  clearSelectionAndHover: () => void
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  locale: () => Locale
}

/**
 * Rotate (CONTEXT.md, ADR 0026): a quarter turn of the Frame and its beads about its centre, as one Undo step that
 * restores the beads, the Frame and any Piece it had to move. changeFrame refuses it without a Frame or while Row
 * progress is on. A Piece the turned Frame covers moves clear of it, and a
 * Message says how many, with Undo. Deps are read lazily.
 */
export function useRotateFlow(deps: RotateFlowDeps) {
  function onRotate(): void {
    const project = deps.currentProject()
    if (!project) {
      return
    }
    const result = changeFrame(project, { rotate: true })
    if (result.kind !== 'changed') {
      return
    }

    deps.recordHistory({
      beads: project.beads,
      rowProgress: project.rowProgress,
      size: { frame: project.frame, mirrorAxisCounts: deps.mirrorAxisCounts() },
    })
    deps.replaceProject(result.project)
    deps.clearMirrorAxisCounts()
    deps.clearSelectionAndHover()

    const t = deps.messages()
    if (result.moved > 0) {
      const text = plural(deps.locale(), result.moved, t.frame.rotatedMessage)
      deps.showToast('project-rotated', text, 'info', { label: t.palette.undoButton, run: deps.onUndo })
    } else {
      deps.announce(t.frame.announceRotated)
    }
  }

  return { onRotate }
}
