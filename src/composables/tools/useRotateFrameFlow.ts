import { coveredByRotation, frameAreaSelection, rotateFrame } from '../../domain/rotate'
import { rowProgressStarted, type Project } from '../../domain/project'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from '../project/useEdit'

export interface RotateFrameFlowDeps {
  edit: EditFn
  currentProject: () => Project | undefined
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  locale: () => Locale
}

/**
 * Rotate Frame (CONTEXT.md, ticket 471, ADR 0063): the Frame, its keep-out margin and the beads inside both a quarter turn
 * clockwise, as one drawing Edit with Rotate's rules, so Undo brings the Frame and every bead the turn covered back at once.
 * A Message says how many beads outside it covered, with Undo. The Edit chrome is left as it was. Deps are read lazily.
 */
export function useRotateFrameFlow(deps: RotateFrameFlowDeps) {
  function onRotateFrame(): void {
    const before = deps.currentProject()
    if (!before?.frame || rowProgressStarted(before)) {
      return
    }
    const area = frameAreaSelection(before.frame)

    let turnedArea = area
    const outcome = deps.edit('drawing', (project) => {
      const turned = rotateFrame(project)
      if (!turned) {
        return project
      }
      turnedArea = turned.area
      return turned.project
    })

    const after = deps.currentProject()
    const covered = outcome.kind === 'applied' && after ? coveredByRotation(before, after, area, turnedArea) : 0
    const t = deps.messages()
    if (covered > 0) {
      const text = plural(deps.locale(), covered, t.frame.rotateCoveredMessage)
      deps.showToast('frame-rotated', text, 'info', { label: t.palette.undoButton, run: deps.onUndo })
    } else {
      deps.announce(t.frame.announceFrameRotated)
    }
  }

  return { onRotateFrame }
}
