import type { BeadMap } from './canvas'
import { changeFrame, type FrameChangeResult } from './changeFrame'
import { customFrameSize, frameKindOf, frameLayoutOf, sizeSettingOf, type CustomFrameKindId, type FrameSettingName } from './frameKind'
import type { GridPosition } from './grid'
import { createProject, type Project } from './project'
import { parseProjectsFile } from './projectFile'
import triangleDesign from '../data/starters/triangle.json'
import warpedSquareDesign from '../data/starters/warpedSquare.json'
import kiteDesign from '../data/starters/kite.json'
import starDesign from '../data/starters/star.json'
import kaleidocycleDesign from '../data/starters/kaleidocycle.json'

// The Starters (spec 0590, ticket 0596; StarterGallery card): each a design for one Frame kind at one best size, a
// Project file kept with the app in `src/data/starters/` (the JSON inside an exported `.openbeads`, so a design tweaked
// in the app replaces its file by `gunzip -c`). Its Frame's beads are the design; nothing else of the file is used.

/** The Starter gallery's categories: Earrings, Rings and Bands join with ticket 0597. */
export type StarterCategoryId = 'shapes'

/** A Starter by id; the id is also the key of its copy (`starters.options.<id>` in the translations). */
export type StarterId = 'triangle' | 'warpedSquare' | 'kite' | 'star' | 'kaleidocycle'

/** A ready-made design for one Frame kind (ADR 0077): the kind, the size the design is made for in its kind's one
 * setting, the sizes offered as chips, and the design itself. */
export interface Starter {
  id: StarterId
  category: StarterCategoryId
  kind: CustomFrameKindId
  /** The kind's setting the size is in: Rounds, Part size or Rows. */
  setting: FrameSettingName
  /** The size the design is made for: it is never cropped, scaled or repeated to another. */
  size: number
  /** The usual sizes, offered as chips; the design's own among them. */
  presets: readonly number[]
  /** The Project file the design is, as its JSON. */
  file: unknown
}

/** A category of the gallery: its Starters in the order its step shows them, and the one whose design is its picture. */
export interface StarterCategory {
  id: StarterCategoryId
  starters: readonly Starter[]
  best: Starter
}

/** A Shape: a Custom frame of its kind, sized in its kind's setting. */
function shape(kind: StarterId & CustomFrameKindId, size: number, presets: readonly number[], file: unknown): Starter {
  return { id: kind, category: 'shapes', kind, setting: sizeSettingOf({ kind })!.name, size, presets, file }
}

const SHAPES: readonly Starter[] = [
  shape('triangle', 10, [6, 8, 10, 12], triangleDesign),
  shape('warpedSquare', 8, [6, 8, 10], warpedSquareDesign),
  shape('kite', 21, [15, 21, 30], kiteDesign),
  shape('star', 5, [3, 5, 7, 9], starDesign),
  shape('kaleidocycle', 9, [9, 11, 13], kaleidocycleDesign),
]

/** The registry, in the order step 1 shows the categories. */
export const STARTER_CATEGORIES: readonly StarterCategory[] = [{ id: 'shapes', starters: SHAPES, best: SHAPES.find((starter) => starter.id === 'star')! }]

/** The Starter with this id. */
export function starterById(id: StarterId): Starter {
  return SHAPES.find((starter) => starter.id === id)!
}

const designs = new Map<StarterId, BeadMap>()

/** A Starter's design: the beads of its Project file's Frame, by their position in the layout. Read once. */
export function starterDesign(starter: Starter): BeadMap {
  const known = designs.get(starter.id)
  if (known) return known
  const beads = parseProjectsFile(JSON.stringify(starter.file)).projects[0]?.frame?.beads ?? {}
  designs.set(starter.id, beads)
  return beads
}

/** How many beads a Starter's Frame holds at a size: every position of its layout. */
export function starterBeadCount(starter: Starter, size: number): number {
  return frameLayoutOf({ kind: starter.kind, settings: { [starter.setting]: size } })!.positions.length
}

/** What the setup asks of a Starter: its size, and whether the design is put in place or the Frame starts empty. The
 * design goes in only at its own size. */
export interface StarterChoice {
  size: number
  useDesign: boolean
}

/** The beads a Starter puts in place: its design when asked for at its size, else none. */
function chosenBeads(starter: Starter, { size, useDesign }: StarterChoice): BeadMap {
  return useDesign && size === starter.size ? starterDesign(starter) : {}
}

/** Add Frame from Starter and Replace Frame (ticket 0596): the Starter's Frame round a Canvas position, in place of any
 * Frame there, pre-filled with its design or empty. Colours stay as painted, whatever the Project's Bead. */
export function placedStarter(project: Project, starter: Starter, choice: StarterChoice, centre: GridPosition): FrameChangeResult {
  return changeFrame(project, { custom: { kind: starter.kind, size: choice.size, centre, beads: chosenBeads(starter, choice) } })
}

/** A new Project from a Starter (New Project's Pick a starter): its Canvas in the kind's Technique, and the Starter's
 * Frame with its first row and column at the origin. Nothing in it records the Starter. */
export function starterProject(starter: Starter, choice: StarterChoice & { name: string; beadId: string }): Project {
  const technique = frameKindOf({ kind: starter.kind }).custom!.technique
  const project = createProject({ name: choice.name, technique, beadId: choice.beadId })
  const { rows, columns } = customFrameSize(starter.kind, { [starter.setting]: choice.size })
  const placed = placedStarter(project, starter, choice, { row: Math.floor(rows / 2), column: Math.floor(columns / 2) })
  return placed.kind === 'changed' ? placed.project : project
}
