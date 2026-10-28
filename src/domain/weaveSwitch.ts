import { forEachBead, type BeadMap, type Rect } from './canvas'
import { canvasWeave, clampBrickBlock, frameWeave, weaveOf } from './layerWeave'
import { touch, type Project } from './project'
import { clampNetSize, describeWeave, type Technique, type Weave } from './weave'

// Switching a layer's Weave (ADR 0038): its Technique, Brick block and Net size, and the beads a switch drops.

/** The layer's Weave switched to another Technique (ADR 0038): the Brick block stays, the Net size is the one given, the
 * layer's own if it has one, or the default, and only a Technique with a Net size keeps one. A Brick block given (ticket 568)
 * replaces the layer's. */
export function switchedWeave(current: Weave, technique: Technique, netSize?: number, brickBlock?: number): Weave {
  return weaveOf({
    technique,
    brickBlock: brickBlock === undefined ? current.brickBlock : clampBrickBlock(brickBlock),
    netSize: describeWeave({ technique }).hasNetSize ? clampNetSize(netSize ?? current.netSize) : undefined,
  })
}

/** The beads of a layer that keep a place in `weave` (a Frame's counted from its own corner, `shape`), and how many are
 * left without one: a hole of Netting, the empty last column of a Right-angle weave line. */
function beadsInWeave(beads: BeadMap, weave: Weave, shape?: Pick<Rect, 'rows' | 'columns'>): { kept: BeadMap; lost: number } {
  const { hasPosition } = describeWeave(weave)
  const kept: BeadMap = {}
  let lost = 0
  forEachBead(beads, (row, column, color) => {
    if (hasPosition({ row, column }, shape && { row: 0, column: 0, ...shape })) {
      kept[row] ??= {}
      kept[row]![column] = color
    } else {
      lost++
    }
  })
  return { kept, lost }
}

/** How many beads of the Canvas, or of the Frame, a switch to `weave` would drop. */
export function switchLoss(project: Project, layer: 'canvas' | 'frame', technique: Technique, netSize?: number): number {
  if (layer === 'frame') {
    return project.frame ? beadsInWeave(project.frame.beads, switchedWeave(frameWeave(project), technique, netSize), project.frame).lost : 0
  }
  return beadsInWeave(project.beads, switchedWeave(canvasWeave(project), technique, netSize)).lost
}

/** The Canvas woven in another Technique (ticket 351, 492, ADR 0038): its beads keep their row and column where the
 * Technique has a position there and the rest are dropped. The Frame is another layer and stays as it is. */
export function withTechnique(project: Project, technique: Technique, netSize?: number, brickBlock?: number): Project {
  const weave = switchedWeave(canvasWeave(project), technique, netSize, brickBlock)
  const { netSize: _netSize, brickBlock: _brickBlock, ...rest } = project
  return touch({ ...rest, ...(weave.netSize ? { netSize: weave.netSize } : {}), ...(weave.brickBlock ? { brickBlock: weave.brickBlock } : {}) }, { technique: weave.technique, beads: beadsInWeave(project.beads, weave).kept })
}

/** The Project with the Canvas's Brick block changed (ticket 477): the same cells, only the shift's rhythm changes. */
export function withBrickBlock(project: Project, brickBlock: number): Project {
  return touch(project, { brickBlock: clampBrickBlock(brickBlock) })
}

/** The Frame woven in another Technique (ticket 492, ADR 0038): its beads keep their row and column where the Technique
 * has a position there and the rest are dropped. Its local row 0 is always an unshifted one, so nothing else moves. A
 * Project with no Frame is unchanged. */
export function withFrameTechnique(project: Project, technique: Technique, netSize?: number, brickBlock?: number): Project {
  if (!project.frame) {
    return project
  }
  const weave = switchedWeave(frameWeave(project), technique, netSize, brickBlock)
  const { netSize: _netSize, brickBlock: _brickBlock, ...frame } = project.frame
  return touch(project, { frame: { ...frame, ...(weave.netSize ? { netSize: weave.netSize } : {}), ...(weave.brickBlock ? { brickBlock: weave.brickBlock } : {}), technique: weave.technique, beads: beadsInWeave(project.frame.beads, weave, project.frame).kept } })
}

/** The Frame with its Brick block changed (ticket 492). */
export function withFrameBrickBlock(project: Project, brickBlock: number): Project {
  return project.frame ? touch(project, { frame: { ...project.frame, brickBlock: clampBrickBlock(brickBlock) } }) : project
}
