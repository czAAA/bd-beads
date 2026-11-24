import { framesOf, type Layered } from './layerRecord'

/** How many Frames a Project holds (spec 1214): one constant, to be raised after an iPad measurement. The renderer's kept
 * draft images follow it. */
export const MAX_FRAMES = 4

/** Whether the Project holds as many Frames as it may: every way of making one is then disabled, with its reason. */
export function framesFull(project: Layered | undefined): boolean {
  return !!project && framesOf(project).length >= MAX_FRAMES
}
