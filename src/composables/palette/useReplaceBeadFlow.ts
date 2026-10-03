import { computed, ref } from 'vue'
import { BEAD_CATALOG, beadLabel, findBead, type Bead } from '../../domain/beads'
import { replaceBead, resolvePatternBead, type Pattern, type UndoEntry } from '../../domain/pattern'
import { estimatedSizeMm, formatSizeMm } from '../../domain/patternSize'
import type { Locale, Translations } from '../../i18n/translations'

/** What Replace Bead needs from the app shell: the open Pattern, its write path, the history's record, and the app's language. */
export interface ReplaceBeadFlowDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
  /** useUndoHistory's record: one undo step for the state Replace Bead is about to replace. */
  recordHistory: (entry: UndoEntry) => void
  messages: () => Translations
  locale: () => Locale
}

/** Replace Bead and its confirmation modal (tickets 48, 113, 205; ADR 0017, 0023). Deps are read lazily. */
export function useReplaceBeadFlow(deps: ReplaceBeadFlowDeps) {
  /** The Bead id picked from the Replace bead select, awaiting confirmation (ticket 48); undefined when its modal is closed. */
  const pendingId = ref<string | undefined>()

  /** The other built-in catalog Beads the open Pattern could switch to (ticket 48) — everything but its current one. */
  const candidates = computed(() => {
    const pattern = deps.currentPattern()
    return pattern ? BEAD_CATALOG.filter((bead) => bead.id !== pattern.beadId) : []
  })

  /** The Bead behind the pending id, resolved from the catalog — also doubles as "is the Replace bead modal open" (ticket 48), since a pending id always names a real catalog Bead. */
  const pendingBead = computed(() => {
    const id = pendingId.value
    return id ? findBead(id) : undefined
  })

  /**
   * The modal's message (ticket 48, ADR 0017): the Pattern's Estimated size with the new Bead next to the one it has
   * now, plus the static reassurance that the design and its bead count stay put and that rows and columns can be
   * adjusted afterwards. The grid itself never changes, so there is no new grid size to show.
   */
  const confirmMessage = computed(() => {
    const pattern = deps.currentPattern()
    const bead = pendingBead.value
    if (!pattern || !bead) {
      return ''
    }

    const t = deps.messages()
    const unitLabels = { mm: t.form.unitMm, cm: t.form.unitCm }
    const estimateWith = (candidate: Bead | undefined) =>
      candidate ? formatSizeMm(estimatedSizeMm(pattern, candidate), unitLabels, deps.locale()) : '—'

    return t.replaceBead.confirmMessage
      .replace('{bead}', () => beadLabel(bead))
      .replace('{new}', () => estimateWith(bead))
      .replace('{old}', () => estimateWith(resolvePatternBead(pattern)))
  })

  /** Opens the confirmation modal (ticket 48) for the picked Bead id; does nothing with no Pattern open or an empty pick (the select's placeholder option). */
  function onRequestReplaceBead(beadId: string) {
    if (beadId && deps.currentPattern()) {
      pendingId.value = beadId
    }
  }

  /**
   * Reads the pick off the Replace bead select and puts the select back on its placeholder straight away (ticket
   * 113): its bound value is a constant '', which Vue never re-applies, so left alone the select would keep showing the
   * picked Bead — after a Cancel that reads as though the declined Bead were the current one, and picking it again
   * would not fire a change.
   */
  function onPickReplaceBead(select: HTMLSelectElement) {
    const beadId = select.value
    select.value = ''
    onRequestReplaceBead(beadId)
  }

  function onCancelReplaceBead() {
    pendingId.value = undefined
  }

  /**
   * Confirms Replace Bead (ticket 48, ADR 0017): swaps the Bead and nothing else, as a single undo step. The grid, Row
   * progress and Mirror all stay as they are, since the grid — the Pattern's size — is untouched; only its Estimated
   * size changes. Applied directly rather than through commitGridChange/keepFinishedRows: it doesn't draw, so the Row
   * progress lock has nothing to guard.
   */
  function onConfirmReplaceBead() {
    const pattern = deps.currentPattern()
    const bead = pendingBead.value
    pendingId.value = undefined
    if (!pattern || !bead) {
      return
    }

    deps.recordHistory({ beads: pattern.beads, beadId: pattern.beadId })
    deps.replacePattern(replaceBead(pattern, bead))
  }

  return {
    replaceBeadCandidates: candidates,
    replaceBeadPendingBead: pendingBead,
    replaceBeadConfirmMessage: confirmMessage,
    onPickReplaceBead,
    onCancelReplaceBead,
    onConfirmReplaceBead,
  }
}
