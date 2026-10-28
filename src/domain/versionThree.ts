import { beadsInFrame, beadsOver, beadsWithout, frameContains, shiftedBeads, type BeadMap, type Rect } from './canvas'
import { weaveOf } from './layerWeave'
import type { Project } from './project'

// TEMPORARY (ADR 0066, ticket 489; on ticket 391's cleanup list, removed with the public release): a Project as file
// and library version 3 stored it, when the Frame was a rectangle of the Canvas's own beads and the beads it covered
// were kept in `coveredBeads`. Read only. `liftVersionThree` makes it the Project of today, looking identical.

/** A Project as version 3 stored it: every bead on the one map, the Frame a bare rectangle. */
export interface VersionThreeProject extends Omit<Project, 'frame'> {
  frame?: Rect
  /** Beads hidden under the Frame (ticket 476), now ordinary Canvas beads under it (ADR 0066). */
  coveredBeads?: BeadMap
}

/** Whether a stored Project is in the version 3 shape: a Frame that holds no beads of its own, or beads covered by one.
 * A Project with no Frame and nothing covered reads the same in both versions. */
export function isVersionThree(project: Omit<Project, 'frame'> & { frame?: Rect & { beads?: unknown } }): project is VersionThreeProject {
  return (project.frame !== undefined && project.frame.beads === undefined) || 'coveredBeads' in project
}

/** The Project of today from a version 3 one: the beads inside its Frame move into the Frame, which takes the Project's
 * Technique, and its covered beads become ordinary Canvas beads under the Frame. A Piece name anchored on a bead in the
 * Frame becomes the Frame's name. */
export function liftVersionThree(stored: VersionThreeProject): Project {
  const { coveredBeads, frame, pieceNames, ...rest } = stored
  // A bead covered where another still stands stays hidden: the one in view is kept.
  const outside = frame ? beadsWithout(rest.beads, frame) : rest.beads
  const beads = coveredBeads ? beadsOver(coveredBeads, outside) : outside
  if (!frame) {
    return { ...rest, beads, ...(pieceNames ? { pieceNames } : {}) }
  }
  const named = pieceNames?.find((entry) => frameContains(frame, entry))
  const kept = pieceNames?.filter((entry) => !frameContains(frame, entry))
  return {
    ...rest,
    beads,
    frame: {
      ...frame,
      beads: shiftedBeads(beadsInFrame(stored.beads, frame), -frame.row, -frame.column),
      ...weaveOf(rest),
      ...(named ? { name: named.name } : {}),
    },
    ...(kept?.length ? { pieceNames: kept } : {}),
  }
}
