import { computed, ref } from 'vue'
import { beadLabel, findBead, offeredBeads, type Bead } from '../../domain/beads'
import { replaceBead, resolveProjectBead, type Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import type { Locale, Translations } from '../../i18n/translations'
import type { EditFn } from '../project/useEdit'

/** What Replace Bead needs from the app shell: the open Project, Edit, and the app's language. */
export interface ReplaceBeadFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  messages: () => Translations
  locale: () => Locale
}

/** Replace Bead and its confirmation modal (tickets 48, 113, 205; ADR 0007, 0023). Deps are read lazily. */
export function useReplaceBeadFlow(deps: ReplaceBeadFlowDeps) {
  /** The Bead id picked from the Replace bead menu, awaiting confirmation (ticket 48); undefined when its modal is
   * closed. */
  const pendingId = ref<string | undefined>()

  /** The other built-in catalog Beads the open Project could switch to (ticket 48) — everything but its current one. */
  const candidates = computed(() => {
    const project = deps.currentProject()
    return project ? offeredBeads().filter((bead) => bead.id !== resolveProjectBead(project)?.id) : []
  })

  /** The Bead behind the pending id, resolved from the catalog — also doubles as "is the Replace bead modal open"
   * (ticket 48), since a pending id always names a real catalog Bead. */
  const pendingBead = computed(() => {
    const id = pendingId.value
    return id ? findBead(id) : undefined
  })

  /** The modal's message (ticket 48, ADR 0007): the Estimated size with the new Bead beside the old, and reassurance
   * the design stays put; no new grid size to show. */
  const confirmMessage = computed(() => {
    const project = deps.currentProject()
    const bead = pendingBead.value
    if (!project || !bead) {
      return ''
    }

    const t = deps.messages()
    const unitLabels = { mm: t.form.unitMm, cm: t.form.unitCm }
    const estimateWith = (candidate: Bead | undefined) =>
      candidate ? formatSizeMm(estimatedSizeMm(project, candidate), unitLabels, deps.locale()) : '—'

    return t.replaceBead.confirmMessage
      .replace('{bead}', () => beadLabel(bead, t.formFactors))
      .replace('{new}', () => estimateWith(bead))
      .replace('{old}', () => estimateWith(resolveProjectBead(project)))
  })

  /** Opens the confirmation modal (ticket 48) for the picked Bead id; does nothing with no Project open. */
  function onRequestReplaceBead(beadId: string) {
    if (deps.currentProject()) {
      pendingId.value = beadId
    }
  }

  function onCancelReplaceBead() {
    pendingId.value = undefined
  }

  /** Confirms Replace Bead (ticket 48, ADR 0007): swaps the Bead only, as one undo step. An exempt Edit: it doesn't
   * draw, so the Row progress lock has nothing to guard. */
  function onConfirmReplaceBead() {
    const bead = pendingBead.value
    pendingId.value = undefined
    if (bead) {
      deps.edit('exempt', (project) => replaceBead(project, bead))
    }
  }

  return {
    replaceBeadCandidates: candidates,
    replaceBeadPendingBead: pendingBead,
    replaceBeadConfirmMessage: confirmMessage,
    onRequestReplaceBead,
    onCancelReplaceBead,
    onConfirmReplaceBead,
  }
}
