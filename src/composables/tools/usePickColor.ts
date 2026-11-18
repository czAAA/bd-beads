import type { Ref } from 'vue'
import { beadColorAt } from '../../domain/layerBeads'
import type { Layer } from '../../domain/layers'
import type { Project } from '../../domain/project'

/** What Pick color from Canvas needs from the shell. */
export interface PickColorDeps {
  /** Whether Pick color from Canvas is armed: the next press on a bead takes its colour. */
  picking: Ref<boolean>
  currentProject: () => Project | null | undefined
  /** Chooses a colour as the paint colour; it joins the Palette and the recent colours (ticket 398). */
  onSelectCustomColor: (hex: string) => void
}

/** Pick color from Canvas (ticket 398): the press that takes a bead's colour while the pick is armed. The Palette's
 * button and the Radial toolbox arm it (ticket 1089). */
export function usePickColor(deps: PickColorDeps) {
  /** Chooses the colour of the bead you see at a Canvas position, on the Canvas or in the Frame. An empty position
   * changes nothing. Returns whether a colour was taken. */
  function takeColorAt(row: number, column: number, layer?: Layer): boolean {
    const project = deps.currentProject()
    const hex = project ? beadColorAt(project, row, column, layer) : null
    if (!hex) return false
    deps.onSelectCustomColor(hex)
    return true
  }

  /** The press while armed: takes the bead's colour and ends the pick; an empty position keeps it armed. Returns
   * whether the press was consumed, which is whenever the pick is armed. */
  function pickColorAt(row: number, column: number, layer?: Layer): boolean {
    if (!deps.picking.value) return false
    if (takeColorAt(row, column, layer)) deps.picking.value = false
    return true
  }

  return { pickColorAt }
}
