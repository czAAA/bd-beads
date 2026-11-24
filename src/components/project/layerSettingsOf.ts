import { beadLabel } from '../../domain/beads'
import { techniquesOf } from '../../domain/frameShape'
import type { FrameRef, Layer } from '../../domain/grid'
import { frameById, layerOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { rowProgressStarted } from '../../domain/rowProgress'
import { frameTechniqueWaits } from '../../domain/wovenLines'
import { techniqueName } from '../../i18n/techniqueName'
import type { Translations } from '../../i18n/translations'

/** What a layer's Layer settings show of an open Project (ADR 0079, ticket 0670): its Weave, the Techniques it may take,
 * its Bead, a Custom frame's shape and whether a Row progress pass holds the Frame's Weave. The
 * Background comes from the theme (`useCanvasBackground`). The Project must have the layer. */
export function layerSettingsOf(project: Project, layer: Layer) {
  const { weave, bead } = layerOf(project, layer)!
  const frame = layer === 'canvas' ? undefined : frameById(project, layer)
  return {
    layer,
    technique: weave.technique,
    techniqueSettings: weave.techniqueSettings ?? {},
    ...(frame ? { techniques: techniquesOf(frame) } : {}),
    bead,
    ...(frame?.shape ? { frame } : {}),
    locked: !!frame && rowProgressStarted(project, layer as FrameRef),
    techniqueOpen: !!frame && !frameTechniqueWaits(project, layer as FrameRef),
  }
}

/** A folded Layer settings section's summary (ticket 0670): the layer's Technique and Bead, "Loom · Miyuki Delica 11/0". */
export function layerSummary(t: Translations, { technique, bead }: Pick<ReturnType<typeof layerSettingsOf>, 'technique' | 'bead'>): string {
  return [techniqueName(t, technique), bead && beadLabel(bead)].filter(Boolean).join(' · ')
}
