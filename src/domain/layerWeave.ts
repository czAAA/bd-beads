import type { GridPosition, Layer } from './grid'
import type { Project } from './project'
import { projectCell, type ShapedBead } from './projectBead'
import { heldSettings, positionStep, weaveSettings, withCell, type Weave } from './weave'

// The Weave each layer is woven in (ticket 492): the Canvas's from the Project's own fields, the Frame's from its own,
// and how a distance in one reads in the other.

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

/** The Canvas's Weave: the Project's own Technique and settings (tickets 492, 0625). */
export function canvasWeave(project: Pick<Project, 'technique' | 'techniqueSettings'> & ShapedBead): Weave {
  return withCell(weaveOf(project), projectCell(project))
}

/** The Frame's Weave (ticket 492), which may differ from the Canvas's; a Canvas with no Frame counts its rows in its
 * own. The one place that says which Weave a Frame's rows, rulers, passes and exports are counted in. */
export function frameWeave(project: Pick<Project, 'technique' | 'techniqueSettings' | 'frame'> & ShapedBead): Weave {
  return withCell(weaveOf(project.frame ?? project), projectCell(project))
}

/** The Weave of one layer, the Frame's or the Canvas's (ticket 0625). */
export function layerWeave(project: Pick<Project, 'technique' | 'techniqueSettings' | 'frame'> & ShapedBead, layer: Layer): Weave {
  return layer === 'frame' ? frameWeave(project) : canvasWeave(project)
}

/** Whether two Weaves lay positions out alike: the same Technique, and the same value of every setting it describes. */
export function sameWeave(a: Weave, b: Weave): boolean {
  if (a.technique !== b.technique) {
    return false
  }
  const [x, y] = [weaveSettings(a), weaveSettings(b)]
  return Object.keys(x).every((id) => x[id] === y[id])
}

/** A distance counted in the Frame's own rows and columns, as Canvas positions (ticket 492): the nearest whole ones,
 * exactly the same where Frame and Canvas are woven alike. A half rounds away from zero both ways, so an edge moved out
 * and back puts the Frame where it was (ticket 0638). */
export function canvasDistance(project: Pick<Project, 'technique' | 'techniqueSettings'>, frame: Weave, rows: number, columns: number): GridPosition {
  const canvas = canvasWeave(project)
  if (sameWeave(canvas, frame)) {
    return { row: rows, column: columns }
  }
  const own = positionStep(frame)
  const target = positionStep(canvas)
  const nearest = (distance: number) => Math.sign(distance) * Math.round(Math.abs(distance)) || 0
  return { row: nearest((rows * own.down) / target.down), column: nearest((columns * own.across) / target.across) }
}
