import { computed, ref } from 'vue'
import { beadLabel, beadsDiffer, findBead, offeredBeads, type Bead } from '../../domain/beads'
import { replaceBead, resolveProjectBead, type Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import type { Locale, Translations } from '../../i18n/translations'
import { loadColorCatalog } from '../../services/colorCatalogs'
import type { EditFn } from '../project/useEdit'
import { fillBlanks } from '../../domain/fillBlanks'

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

  /** The catalog's current Bead of the Project's own id, when the Project's copy differs from it (ticket 534, ADR 0072);
   * undefined when they match, or when that Bead is retired and so offered nowhere. */
  const currentOfSameId = computed(() => {
    const own = deps.currentProject()?.bead
    const current = own && offeredBeads().find((bead) => bead.id === own.id)
    return own && current && beadsDiffer(own, current) ? current : undefined
  })

  /** The Project's own Bead, shown beside the catalog's current one of the same id because the two differ (ticket 534);
   * picking it would change nothing, so the list shows it without offering it. */
  const outdated = computed(() => (currentOfSameId.value ? deps.currentProject()?.bead : undefined))

  /** The Beads the open Project could switch to (ticket 48): everything offered but its own, and the catalog's current
   * Bead of its id when its copy has gone out of date. */
  const candidates = computed(() => {
    const project = deps.currentProject()
    return project ? offeredBeads().filter((bead) => bead.id !== resolveProjectBead(project)?.id || bead === currentOfSameId.value) : []
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

    return fillBlanks(t.replaceBead.confirmMessage, {
      bead: beadLabel(bead, t.formFactors),
      new: estimateWith(bead),
      old: estimateWith(resolveProjectBead(project)),
    })
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
   * draw, so the Row progress lock has nothing to guard. A Project with coded swatches first loads the new Bead's Color
   * catalog, so the swatches it lists keep their codes in the same step (ticket 0538); one that won't load drops them. */
  async function onConfirmReplaceBead() {
    const bead = pendingBead.value
    pendingId.value = undefined
    if (!bead) return
    const catalogId = bead.formFactor.colorCatalog
    const coded = Object.keys(deps.currentProject()?.paletteCodes ?? {}).length > 0
    const catalog = coded && catalogId ? await loadColorCatalog(catalogId).catch(() => undefined) : undefined
    deps.edit('exempt', (project) => replaceBead(project, bead, catalog))
  }

  return {
    replaceBeadCandidates: candidates,
    replaceBeadOutdated: outdated,
    replaceBeadPendingBead: pendingBead,
    replaceBeadConfirmMessage: confirmMessage,
    onRequestReplaceBead,
    onCancelReplaceBead,
    onConfirmReplaceBead,
  }
}
