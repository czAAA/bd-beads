import { computed } from 'vue'
import { beadPitchMm, beadsDiffer, findBead, offeredBeads, type Bead } from '../../domain/beads'
import type { Layer } from '../../domain/grid'
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

/** What one layer's Bead pickers offer (ticket 0687): every Bead but its own, and whether its own copy is out of date,
 * in which case the catalog's current Bead of its id is offered too and its own shown "(as saved)" (ticket 534). */
export interface LayerBeadChoice {
  candidates: readonly Bead[]
  outdated: boolean
}

/** The Bead a layer's panel picked, awaiting confirmation (ticket 0687): the layer is the panel's, never asked. */
interface PendingReplace {
  layer: Layer
  beadId: string
}

/** Replace Bead and its confirmation modal (tickets 48, 113, 205, 0665, 0687; ADR 0007, 0020, 0079): the Project panel's
 * Canvas section replaces the Canvas's Bead, the Frame panel the Frame's, until ticket 0670 folds both into Layer
 * settings. Deps are read lazily. */
export function useReplaceBeadFlow(deps: ReplaceBeadFlowDeps) {
  const pending = (deps.dialogs ?? useDialogs()).question<PendingReplace>('replace-bead')

  /** A layer's own Bead in the open Project; undefined with no Project, or for the Frame with none. */
  const ownBead = (layer: Layer) => {
    const project = deps.currentProject()
    if (!project || (layer === 'frame' && !frameOf(project))) return undefined
    return beadOfLayer(project, layer).bead
  }

  /** The Beads a layer could switch to (tickets 48, 534): everything offered but its own, and the catalog's current Bead
   * of its id when its copy differs from it; nothing for a layer the Project doesn't have. */
  function choiceOf(layer: Layer): LayerBeadChoice {
    const project = deps.currentProject()
    if (!project || (layer === 'frame' && !frameOf(project))) return { candidates: [], outdated: false }
    const own = ownBead(layer)
    const current = own && offeredBeads().find((bead) => bead.id === own.id)
    const outdated = !!own && !!current && beadsDiffer(own, current)
    return { candidates: offeredBeads().filter((bead) => bead.id !== own?.id || (outdated && bead === current)), outdated }
  }

  /** Each layer's choice, for the panel that shows it. */
  const choices = computed<Record<Layer, LayerBeadChoice>>(() => ({ canvas: choiceOf('canvas'), frame: choiceOf('frame') }))

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
    const own = layer && ownBead(layer)
    if (!project || !bead || !layer || !own) {
      return ''
    }

    const t = deps.messages()
    const mm = (size: { widthMm: number; heightMm: number }) => formatSizeInMm(size, t.form.unitMm, deps.locale())
    // A Bead's size as it lies in the work, its width with the correction the Estimated size counts too.
    const beadSize = (of: Bead) => mm({ widthMm: beadPitchMm(of), heightMm: of.heightMm })
    const sizes = { old: beadSize(own), new: beadSize(bead) }
    const frame = frameOf(project)
    if (layer === 'canvas' || !frame) {
      return fillBlanks(t.replaceBead.canvasMessage, sizes)
    }
    return fillBlanks(t.replaceBead.frameMessage, {
      ...sizes,
      newSize: mm(estimatedSizeMm(frame, bead)),
      oldSize: mm(estimatedSizeMm(frame, own)),
    })
  })

  /** Opens the confirmation modal (ticket 48) for the Bead id a layer's panel picked; does nothing with no Project open. */
  function onRequestReplaceBead(layer: Layer, beadId: string) {
    if (deps.currentProject()) {
      pending.value = { layer, beadId }
    }
  }

  function onCancelReplaceBead() {
    pending.value = undefined
  }

  /** Confirms Replace Bead (ticket 48, ADR 0007): the asking panel's layer's Bead, one undo step, exempt as it draws
   * nothing. With coded swatches the new Bead's Color catalog loads first, so those it lists keep their codes in the
   * same step (ticket 0538); one that won't load drops them. */
  async function onConfirmReplaceBead() {
    const bead = pendingBead.value
    const layer = pending.value?.layer
    pending.value = undefined
    if (!bead || !layer) return
    const catalogId = bead.formFactor.colorCatalog
    const coded = Object.keys(deps.currentProject()?.paletteCodes ?? {}).length > 0
    const catalog = coded && catalogId ? await loadColorCatalog(catalogId).catch(() => undefined) : undefined
    deps.edit('exempt', (project) => replaceBead(project, bead, catalog, layer))
  }

  return {
    replaceBeadChoices: choices,
    replaceBeadPendingBead: pendingBead,
    replaceBeadConfirmMessage: confirmMessage,
    onRequestReplaceBead,
    onCancelReplaceBead,
    onConfirmReplaceBead,
  }
}
