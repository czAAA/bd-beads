import { computed } from 'vue'
import type { Project } from '../../domain/project'
import { removeLineQuestion, removeLineRefusal, removeSelectedLine, type RemoveLineQuestion } from '../../domain/removeLine'
import type { Selection } from '../../domain/selection'
import { fillBlanks } from '../../domain/fillBlanks'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import type { EditFn } from './useEdit'

/** What Remove line needs from the app shell: the open Project, Edit, the Selection, the dialog registry and the words
 * its question is put in. */
export interface RemoveLineFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  selection: () => Selection | undefined
  dialogs?: Dialogs
  messages: () => Translations
  /** The language a counted question is worded in. */
  locale: () => Locale
}

/** The Remove line dialog's title and message for the domain's question. */
function promptFor(asked: RemoveLineQuestion, t: Translations, locale: Locale): { title: string; message: string } {
  const words = t.removeLine
  const rows = asked.direction === 'rows'
  if (asked.kind === 'across-rows') {
    return { title: rows ? words.columnTitle : words.rowTitle, message: plural(locale, asked.rows, rows ? words.acrossRows : words.acrossColumns) }
  }
  const finished = fillBlanks(rows ? words.finishedRow : words.finishedColumn, { number: asked.row, backTo: asked.backTo })
  const shift = rows ? words.rowsShift : words.columnsShift
  return { title: rows ? words.rowTitle : words.columnTitle, message: asked.shifts ? `${finished} ${shift}` : finished }
}

// "Remove line" (tickets 123, 199, 0647; ADRs 0020, 0026, 0055): takes the selected row or column out of the Frame as
// one Edit, resetting Selection. Where it touches finished rows the domain has a question, asked first. Deps are lazy.
export function useRemoveLineFlow(deps: RemoveLineFlowDeps) {
  /** Whether Remove line applies right now: the Tools group's own enabled state. */
  const canRemoveSelectedLine = computed(() => {
    const project = deps.currentProject()
    return !!project && !removeLineRefusal(project, deps.selection())
  })

  /** The question the Remove line dialog shows; the line it asks about waits in `pending`. */
  const question = (deps.dialogs ?? useDialogs()).question<RemoveLineQuestion>('remove-line')
  let pending: Selection | undefined

  function remove(selection: Selection | undefined) {
    deps.edit('frame', (project) => removeSelectedLine(project, selection))
  }

  /** Remove line: at once, or after the question where the line touches finished rows (ticket 0647). */
  function onRemoveSelectedLine() {
    const selection = deps.selection()
    const project = deps.currentProject()
    const asked = project && removeLineQuestion(project, selection)
    if (asked) {
      pending = selection
      question.value = asked
      return
    }
    remove(selection)
  }

  /** The question answered Yes: the line goes, and with it any finished passes it held, as one Undo step. */
  function confirmRemoveLine() {
    const selection = pending
    pending = undefined
    question.value = undefined
    remove(selection)
  }

  /** The question answered No: nothing changes. */
  function cancelRemoveLine() {
    pending = undefined
    question.value = undefined
  }

  /** What the Remove line dialog says while it is asked. */
  const removeLinePrompt = computed(() => question.value && promptFor(question.value, deps.messages(), deps.locale()))

  return { canRemoveSelectedLine, onRemoveSelectedLine, removeLinePrompt, confirmRemoveLine, cancelRemoveLine }
}
