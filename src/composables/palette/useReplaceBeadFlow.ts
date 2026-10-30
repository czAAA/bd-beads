import { computed } from 'vue'
import { beadPitchMm, colorCatalogOf, findBead, type Bead } from '../../domain/beads'
import type { Layer } from '../../domain/grid'
import { relaidInBead } from '../../domain/changeFrame'
import { beadOfLayer, frameOf } from '../../domain/layerRecord'
import { replaceBead } from '../../domain/projectBead'
import type { Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeInMm } from '../../domain/projectSize'
import type { Locale, Translations } from '../../i18n/translations'
import { loadColorCatalog } from '../../services/colorCatalogs'
import type { EditFn } from '../project/useEdit'
import { fillBlanks } from '../../domain/fillBlanks'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What Replace Bead needs from the app shell: the open Project, Edit, and the app's language. */
export interface ReplaceBeadFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  messages: () => Translations
  locale: () => Locale
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** Replace Bead and its confirmation modal (tickets 48, 113, 205, 0665, 0670, 0687; ADR 0007, 0020, 0079): a layer's
 * Bead, picked in that layer's Layer settings, so it never asks which layer. Deps are read lazily. */
export function useReplaceBeadFlow(deps: ReplaceBeadFlowDeps) {
  /** The layer and the Bead id picked in its Layer settings, awaiting confirmation (ticket 48); undefined when its modal
   * is closed. */
  const pending = (deps.dialogs ?? useDialogs()).question<{ layer: Layer; beadId: string }>('replace-bead')

  /** The Bead behind the pending id, resolved from the catalog — also doubles as "is the Replace bead modal open"
   * (ticket 48), since a pending id always names a real catalog Bead. */
  const pendingBead = computed(() => {
    const id = pending.value?.beadId
    return id ? findBead(id) : undefined
  })

  /** The modal's message (tickets 48, 0687; ADR 0007): the layer, its Bead's size in mm before and after, that it looks
   * different but the design and bead count stay, and for the Frame its Estimated size with the new Bead and the old. */
  const confirmMessage = computed(() => {
    const project = deps.currentProject()
    const bead = pendingBead.value
    const layer = pending.value?.layer
    const frame = project && frameOf(project)
    const own = project && layer && (layer === 'canvas' || frame) ? beadOfLayer(project, layer).bead : undefined
    if (!bead || !layer || !own) {
      return ''
    }

    const t = deps.messages()
    const mm = (size: { widthMm: number; heightMm: number }) => formatSizeInMm(size, t.form.unitMm, deps.locale())
    // A Bead's size as it lies in the work, its width with the correction the Estimated size counts too.
    const beadSize = (of: Bead) => mm({ widthMm: beadPitchMm(of), heightMm: of.heightMm })
    const sizes = { old: beadSize(own), new: beadSize(bead) }
    if (layer === 'canvas' || !frame) {
      return fillBlanks(t.replaceBead.canvasMessage, sizes)
    }
    return fillBlanks(t.replaceBead.frameMessage, {
      ...sizes,
      newSize: mm(estimatedSizeMm(frame, bead)),
      oldSize: mm(estimatedSizeMm(frame, own)),
    })
  })

  /** Opens the confirmation modal (ticket 48) for a Bead id picked in a layer's Layer settings; does nothing with no
   * Project open. */
  function onRequestReplaceBead(layer: Layer, beadId: string) {
    if (deps.currentProject()) {
      pending.value = { layer, beadId }
    }
  }

  function onCancelReplaceBead() {
    pending.value = undefined
  }

  /** Confirms Replace Bead (ticket 48, ADR 0007): the chosen layer's Bead, one undo step, exempt as it draws nothing; a
   * Custom frame's rectangle follows its new layout in it (ticket 0723). With coded swatches the new Bead's Color catalog
   * loads first, so those it lists keep their codes in the same step (ticket 0538); one that won't load drops them. */
  async function onConfirmReplaceBead() {
    const bead = pendingBead.value
    const chosen = pending.value?.layer
    pending.value = undefined
    if (!bead || !chosen) return
    const catalogId = colorCatalogOf(bead.id)
    const coded = Object.keys(deps.currentProject()?.paletteCodes ?? {}).length > 0
    const catalog = coded && catalogId ? await loadColorCatalog(catalogId).catch(() => undefined) : undefined
    deps.edit('exempt', (project) => relaidInBead(project, replaceBead(project, bead, catalog, chosen)))
  }

  return {
    replaceBeadPendingBead: pendingBead,
    replaceBeadConfirmMessage: confirmMessage,
    onRequestReplaceBead,
    onCancelReplaceBead,
    onConfirmReplaceBead,
  }
}
