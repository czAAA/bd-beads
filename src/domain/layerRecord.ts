import { beadCopy, type Bead } from './beads'
import type { BeadMap } from './canvas'
import type { Layer } from './grid'
import type { Project } from './project'
import type { ShapedBead } from './projectBead'
import { beadCell, DEFAULT_BEAD_SHAPE, heldSettings, withCell, type BeadShape, type Weave } from './weave'

// The one way to read and write a layer, the Canvas or the Frame (ADR 0079, ticket 0661). The Canvas's Weave, Bead,
// Bead shape and beads are still the Project's own fields and the Frame's on its sheet; only this file knows that.

/** A layer, the Canvas or the Frame, as one record (ADR 0079): what a canvas has, wherever the Project keeps it. */
export interface LayerRecord {
  /** Its Technique and settings as held, with the cell its Bead and Bead shape draw it in. */
  weave: Weave
  beadId: string
  /** Its Bead's saved copy (ADR 0072); absent only for an id the catalog never had. */
  bead?: Bead
  beadShape: BeadShape
  /** Its own beads, by its own positions: a Frame's counted from its first row and column. */
  beads: BeadMap
  /** The Canvas's is the Project's name; a Frame's is its own, absent when unnamed. */
  name?: string
}

/** What a layer's record is written with: each field given replaces the layer's, the rest stay. */
export interface LayerChange {
  /** Its Technique and settings; a cell given is not stored, the Bead and Bead shape decide it. */
  weave?: Weave
  bead?: Bead
  beadShape?: BeadShape
  beads?: BeadMap
  /** The Canvas's renames the Project; an empty one clears a Frame's. */
  name?: string
}

/** What a layer's Weave is read from: the Project's Technique and settings, its Frame, its Bead and Bead shape. */
type Woven = Pick<Project, 'technique' | 'techniqueSettings'> & Partial<Pick<Project, 'frame'>> & ShapedBead

/** A layer's Weave as its record holds it (ticket 0625): its Technique and its settings map, read from that map alone
 * and left out where it holds none. A Frame's other fields are left out. */
export function weaveOf({ technique, techniqueSettings }: Weave): Weave {
  const settings = heldSettings(technique, techniqueSettings)
  return Object.keys(settings).length > 0 ? { technique, techniqueSettings: settings } : { technique }
}

/** A layer's record without its Weave's settings: what a new Weave is written over. */
export function unwoven<T extends Partial<Weave>>(record: T): Omit<T, 'techniqueSettings'> {
  const { techniqueSettings: _settings, ...rest } = record
  return rest
}

/** A layer's Weave, with the cell the Project's Bead and Bead shape draw both layers in (ADR 0068); none for a Frame the
 * Project lacks. The Weave of `layerOf`, for a reader given less than a whole Project. */
export function weaveOfLayer(project: Woven, layer: 'canvas'): Weave
export function weaveOfLayer(project: Woven, layer: Layer): Weave | undefined
export function weaveOfLayer(project: Woven, layer: Layer): Weave | undefined {
  const held = layer === 'frame' ? project.frame : project
  // `projectCell`'s rule, kept here as projectBead writes through this file.
  return held && withCell(weaveOf(held), beadCell(project.bead, project.beadShape ?? DEFAULT_BEAD_SHAPE))
}

/** A layer as one record (ADR 0079): the Canvas from the Project's own fields, the Frame from its sheet, both with the
 * Project's Bead and Bead shape. None for a Frame the Project lacks. */
export function layerOf(project: Project, layer: 'canvas'): LayerRecord
export function layerOf(project: Project, layer: Layer): LayerRecord | undefined
export function layerOf(project: Project, layer: Layer): LayerRecord | undefined {
  const weave = weaveOfLayer(project, layer)
  if (!weave) {
    return undefined
  }
  const { beads, name } = layer === 'frame' ? project.frame! : project
  return {
    weave,
    beadId: project.beadId,
    ...(project.bead ? { bead: project.bead } : {}),
    beadShape: project.beadShape ?? DEFAULT_BEAD_SHAPE,
    beads,
    ...(name ? { name } : {}),
  }
}

/** The Project with a layer written (ADR 0079), into the fields that hold it today: the Canvas's into the Project's
 * own, the Frame's onto its sheet, and either's Bead and Bead shape into the Project's, which both share until ticket
 * 0665. Not stamped as a change: the caller does that, as a change of view is not. The same Project without a Frame. */
export function withLayer(project: Project, layer: Layer, change: LayerChange): Project {
  if (layer === 'frame' && !project.frame) {
    return project
  }
  const { weave, bead, beadShape, beads, name } = change
  const rewoven = <T extends Weave>(held: T): Omit<T, 'techniqueSettings'> & Weave => (weave ? { ...unwoven(held), ...weaveOf(weave) } : held)
  let next: Project
  if (layer === 'canvas') {
    next = { ...rewoven(project), ...(beads ? { beads } : {}), ...(name !== undefined ? { name } : {}) }
  } else {
    const { name: previous, ...frame } = rewoven(project.frame!)
    const kept = name ?? previous
    next = { ...project, frame: { ...frame, ...(beads ? { beads } : {}), ...(kept ? { name: kept } : {}) } }
  }
  if (bead) {
    next = { ...next, beadId: bead.id, bead: beadCopy(bead) }
  }
  if (beadShape) {
    const { beadShape: _old, ...rest } = next
    next = beadShape === DEFAULT_BEAD_SHAPE ? rest : { ...rest, beadShape }
  }
  return next
}

/** What a layer's beads are read from: the Canvas's, and the Frame's when the Project has one. */
export type Beaded = Pick<Project, 'beads'> & Partial<Pick<Project, 'frame'>>

/** A layer's own beads (ADR 0079), the Frame's counted from its first row and column; none for a Frame the Project
 * lacks. The beads of `layerOf`, for a reader given less than a whole Project (ticket 0662). */
export function beadsOfLayer(project: Pick<Project, 'beads'>, layer: 'canvas'): BeadMap
export function beadsOfLayer(project: Beaded, layer: Layer): BeadMap | undefined
export function beadsOfLayer(project: Beaded, layer: Layer): BeadMap | undefined {
  return layer === 'frame' ? project.frame?.beads : project.beads
}

/** A layer's Bead copy and Bead shape (ADR 0068, 0072), the Project's for both layers until ticket 0665. Those of
 * `layerOf`, for a reader given less than a whole Project (ticket 0662). */
export function beadOfLayer(project: ShapedBead, _layer: Layer): Pick<LayerRecord, 'bead' | 'beadShape'> {
  return { ...(project.bead ? { bead: project.bead } : {}), beadShape: project.beadShape ?? DEFAULT_BEAD_SHAPE }
}

/** The id of a layer's Bead (ADR 0072), the Project's for both layers until ticket 0665: what its built-in colors and
 * Swatch letters are read from. That of `layerOf`, for a reader given less than a whole Project (ticket 0662). */
export function beadIdOfLayer(project: Pick<Project, 'beadId'>, _layer: Layer): string {
  return project.beadId
}

/** A layer's Weave as held (ticket 0625): its Technique and settings, without the cell its Bead draws it in, for a
 * reader that counts positions as the bare Weave does (ticket 0662). None for a Frame the Project lacks. */
export function heldWeave(project: Pick<Project, 'technique' | 'techniqueSettings'>, layer: 'canvas'): Weave
export function heldWeave(project: { frame?: Weave }, layer: 'frame'): Weave | undefined
export function heldWeave(project: Pick<Project, 'technique' | 'techniqueSettings'> & Partial<Pick<Project, 'frame'>>, layer: Layer): Weave | undefined
export function heldWeave(project: Partial<Weave> & { frame?: Weave }, layer: Layer): Weave | undefined {
  const held = layer === 'frame' ? project.frame : (project as Weave)
  return held && weaveOf(held)
}
