import { computed, ref, watch } from 'vue'
import { footprintOf } from '../../domain/footprint'
import type { GridPosition, Layer } from '../../domain/grid'
import { beadColorAt } from '../../domain/layerBeads'
import { inMargin } from '../../domain/margin'
import type { Project } from '../../domain/project'
import { RADIAL_ROOM, radialCenterOnScreen } from '../../domain/radialToolbox'
import type { Tool } from '../../domain/tool'

/** What the Radial toolbox needs from the shell (ticket 1064): the handlers its items' own controls call. */
export interface RadialToolboxDeps {
  currentProject: () => Project | null | undefined
  /** Whether the Canvas takes no press (open in another tab, ticket 0937): the ring does not open then. */
  readOnly: () => boolean
  /** Whether this shell is the Homepage's demo, which is only to watch: the ring never opens there. */
  demo: boolean
  canUndo: () => boolean
  canRedo: () => boolean
  /** The Tool pill's handler for a tool tile. */
  onSelectTool: (tool: Tool) => void
  /** The Tool pill's handler for a recent colour. */
  pickRecent: (hex: string) => void
  /** The Canvas strip's handlers. */
  onUndo: () => void
  onRedo: () => void
  /** Pick color from Canvas's one step (ticket 1073): takes the colour of the bead at a position. */
  takeColorAt: (row: number, column: number, layer?: Layer) => boolean
  /** The screen the ring stays on (ticket 1076): its size in client px, and how many of them make one of the design
   * system's px. Absent (a test's flow), the ring opens on the pressed point. */
  screen?: () => RadialScreen
}

interface RadialScreen {
  width: number
  height: number
  scale: number
}

/** The window as the ring's screen: the design system's px is 1/16 rem, which a larger text size draws larger. */
export function radialScreenOfWindow(): RadialScreen {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return { width: window.innerWidth, height: window.innerHeight, scale: rem > 0 ? rem / 16 : 1 }
}

/** The Radial toolbox's flow (spec 1072, ADR 0098): it owns the ring's state (open, where on screen, on which bead
 * position) and routes each pick to the handler the item's existing control calls, so nothing behaves differently in
 * the ring. A tool or a colour closes it; Undo and Redo keep it open. */
export function useRadialToolboxFlow(deps: RadialToolboxDeps) {
  const open = ref(false)
  /** The ring's centre, in client px; kept after it closes, so it leaves where it stood. */
  const center = ref({ x: 0, y: 0 })
  /** The bead position that was pressed; none between positions or off the grid. */
  const position = ref<GridPosition>()

  /** The colour of the pressed bead as the Project holds it now, so the ring follows it through an Undo; none on an
   * empty position and over the Frame's margin, where Pick color from Canvas is off. */
  const beadHex = computed(() => {
    const project = deps.currentProject()
    const at = position.value
    if (!project || !at || inMargin(footprintOf(project), at)) return null
    return beadColorAt(project, at.row, at.column, at.layer)
  })

  /** The pressed position while the ring is open, for its outline on the Canvas (ticket 1076): it says which bead Pick
   * color from Canvas means once the ring has moved off it. */
  const pressed = computed(() => (open.value ? position.value : undefined))

  /** Opens the ring on a point of the screen (client px), on the bead position pressed there: centred on the point, or
   * as near it as keeps the whole ring on the screen (ticket 1076). Not while the Canvas is read-only, with no Project
   * open, or on the Homepage's demo. */
  function openAt(at: { x: number; y: number }, pressed?: GridPosition) {
    if (deps.demo || deps.readOnly() || !deps.currentProject()) return
    const screen = deps.screen?.()
    center.value = screen ? radialCenterOnScreen(at, screen, { side: RADIAL_ROOM.side * screen.scale, top: RADIAL_ROOM.top * screen.scale }) : { x: at.x, y: at.y }
    position.value = pressed
    open.value = true
  }

  function close() {
    open.value = false
  }

  /** Whether a hold on the Canvas would open the ring (ticket 1065): the surface times one only then. */
  const canOpen = computed(() => !deps.demo && !deps.readOnly() && !!deps.currentProject())
  /** Where a hold is being timed, in client px: the hairline is drawn round it. None when no hold is. */
  const holdAt = ref<{ x: number; y: number }>()
  /** How many holds a pinch has ended: the surface, which never hears the second finger, stops timing its own. */
  const holdEnds = ref(0)

  /** The surface times a hold at a point (client px), or, with none, stopped: moved, lifted, or the ring is opening. */
  function hold(at?: { x: number; y: number }) {
    holdAt.value = at && canOpen.value ? { x: at.x, y: at.y } : undefined
  }

  /** A second finger made the press a pinch: the hold is off and its hairline goes. */
  function endHold() {
    holdAt.value = undefined
    holdEnds.value += 1
  }

  // A Canvas that turns read-only under the open ring, or a Project that closes, takes the ring with it.
  watch(() => deps.readOnly() || !deps.currentProject(), (gone) => {
    if (gone) close()
  })

  function selectTool(tool: Tool) {
    deps.onSelectTool(tool)
    close()
  }

  function pickRecent(hex: string) {
    deps.pickRecent(hex)
    close()
  }

  /** Pick color from Canvas: the pressed bead's colour, through the armed press's own step. Off, it does nothing and
   * the ring stays. */
  function pickColor() {
    const at = position.value
    if (!at || beadHex.value === null) return
    if (deps.takeColorAt(at.row, at.column, at.layer)) close()
  }

  function undo() {
    if (deps.canUndo()) deps.onUndo()
  }

  function redo() {
    if (deps.canRedo()) deps.onRedo()
  }

  return { open, center, beadHex, openAt, close, selectTool, pickRecent, pickColor, undo, redo, pressed, canOpen, holdAt, holdEnds, hold, endHold }
}
