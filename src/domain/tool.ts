/** The active editing tool: what a click/drag on the canvas does. */
export type Tool = 'paint' | 'fill' | 'select' | 'piece' | 'erase' | 'hand'

/** The modes on besides the tool in hand that change what a press and the pointer do on the Drawing surface. */
export interface ToolModes {
  /** Pick color from canvas is on (ticket 403). */
  picking?: boolean
  /** Space is held, so a drag moves the canvas and the bead marker gives way to the grab cursor (ticket 353). */
  spaceHeld?: boolean
  /** The Frame is being edited (Edit Frame, ticket 417). */
  settingFrame?: boolean
  /** A paste is armed: a press places its beads (ticket 276). */
  pasteArmed?: boolean
  /** Mirror mode (ADR 0082): the Select tool's drag makes the Mirror's Area. */
  markingArea?: boolean
}

/** What the tool in hand and the modes on let a press, the pointer and the overlay do on the Drawing surface. */
export interface ToolCapabilities {
  /** The tool in hand, whose Tool pointer is the canvas pointer (ticket 542); none, and the bead marker shows. */
  tool: Tool | undefined
  /** A drag moves the canvas instead of drawing (the Hand tool); Edit Frame takes the drag over it. */
  moves: boolean
  /** Select or Piece (ticket 414): the Selection shows its handles, and a Selection cannot start in the margin
   * (ticket 428, ADR 0051). */
  selects: boolean
  /** Select (ticket 505): a press and a drag are read at the nearest bead position wherever the pointer is. */
  selectsAnywhere: boolean
  /** A press off a bead lands on the nearest bead instead of opening a stroke (Fill, ticket 504). */
  nearestOnPress: boolean
  /** The tool cannot place beads in the Frame's margin (Paint, Fill, a paste): `not-allowed` there (ticket 276). */
  blocksMargin: boolean
  /** Pick color from canvas is on (ticket 403): the pointer is an eyedropper with the color under it. */
  picking: boolean
  /** The bead-shaped marker is held back over the beads: Space is down (ticket 353). */
  markerHidden: boolean
  /** The Frame is being edited (ticket 417): a drag moves or resizes it, and its handles and size show. */
  settingFrame: boolean
  /** Mirror mode (ADR 0082): the Select drag marks out the Mirror's Area and cannot start in the Frame, and the Area's
   * handles take a press as the Selection's do. */
  marksArea: boolean
}

/** Works out once what the tool and modes let the Drawing surface do (ticket 0619), so the surface reads one value
 * instead of a boolean per tool and mode. */
export function toolCapabilities(tool: Tool | undefined, modes: ToolModes = {}): ToolCapabilities {
  const picking = modes.picking === true
  return {
    tool,
    moves: tool === 'hand',
    selects: tool === 'select' || tool === 'piece',
    selectsAnywhere: tool === 'select',
    nearestOnPress: tool === 'fill',
    blocksMargin: !picking && (tool === 'paint' || tool === 'fill' || modes.pasteArmed === true),
    picking,
    markerHidden: modes.spaceHeld === true,
    settingFrame: modes.settingFrame === true,
    marksArea: tool === 'select' && modes.markingArea === true,
  }
}
