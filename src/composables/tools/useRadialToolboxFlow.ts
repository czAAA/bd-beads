import { computed, ref, watch } from 'vue'
import type { GridPosition } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { pressBecomes } from '../../domain/canvasPress'
import { RADIAL_HOLE, RADIAL_PLACES, RADIAL_ROOM, radialCenterOnScreen, radialItemAt, radialItemOff, type RadialItemId, type RadialScreen } from '../../domain/radialToolbox'
import type { Tool } from '../../domain/tool'
import { cssZoomOf } from '../ui/cssZoom'
import { scopeRoom, type ShellScope } from '../ui/shellScope'

/** What the Radial toolbox needs from the shell (ticket 1064): the handlers its items' own controls call. */
export interface RadialToolboxDeps {
  currentProject: () => Project | null | undefined
  /** Whether the Canvas takes no press (open in another tab, ticket 0937): the ring does not open then. */
  readOnly: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
  /** The recent colours the Tool pill shows, in its order: what the ring's three colour places hold. */
  recents: () => readonly string[]
  /** The Tool pill's handler for a tool tile. */
  onSelectTool: (tool: Tool) => void
  /** The Tool pill's handler for a recent colour. */
  pickRecent: (hex: string) => void
  /** The Canvas strip's handlers. */
  onUndo: () => void
  onRedo: () => void
  /** The Palette's handler for Pick color from Canvas (ticket 1089): arms the pick, or ends an armed one. */
  toggleColorPick: () => void
  /** The screen the ring stays on (ticket 1076): its place and size in client px, and how many of them make one of
   * the design system's px. Absent (a test's flow), the ring opens on the pressed point. */
  screen?: () => ScaledScreen
}

/** The ring's screen and how many of its px make one of the design system's. */
type ScaledScreen = RadialScreen & { scale: number }

/** The room of a shell as the ring's screen: the window, or the box a shell lives in (the Homepage's demo, ticket
 * 1114). The design system's px is 1/16 rem, which a larger text size draws larger, and the Homepage's zoom again. */
export function radialScreenOf(scope: ShellScope): ScaledScreen {
  const room = scopeRoom(scope)
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return { left: room.left, top: room.top, width: room.right - room.left, height: room.bottom - room.top, scale: (rem > 0 ? rem / 16 : 1) * cssZoomOf(scope.root()) }
}

/** The Radial toolbox's flow (spec 1072, ADR 0098): it owns the ring's state (open, where on screen, on which bead
 * position) and routes each pick, a tap's or a slide's lift (ticket 1077), to the handler the item's existing control
 * calls, so nothing behaves differently in the ring. A tool or a colour closes it; Undo and Redo keep it open. */
export function useRadialToolboxFlow(deps: RadialToolboxDeps) {
  const open = ref(false)
  /** The ring's centre, in client px; kept after it closes, so it leaves where it stood. */
  const center = ref({ x: 0, y: 0 })
  /** The bead position that was pressed; none between positions or off the grid. */
  const position = ref<GridPosition>()

  /** The item under the pointer that opened the ring by a hold and is still down, once its lift would pick (ticket
   * 1077): it wears the pressed look. Kept through a pick that closes the ring, which leaves with it pressed. */
  const held = ref<RadialItemId>()

  /** The pressed position while the ring is open, for its outline on the Canvas (ticket 1076): it says where the ring
   * was opened once the ring has moved off it. */
  const pressed = computed(() => (open.value ? position.value : undefined))

  /** Opens the ring on a point of the screen (client px), on the bead position pressed there: centred on the point, or
   * as near it as keeps the whole ring on the screen (ticket 1076). Not while the Canvas is read-only or with no
   * Project open. On the Homepage's demo only the tour's ghost reaches it (ticket 1114): the demo's box is inert. */
  function openAt(at: { x: number; y: number }, pressed?: GridPosition) {
    if (deps.readOnly() || !deps.currentProject()) return
    const screen = deps.screen?.()
    center.value = screen ? radialCenterOnScreen(at, screen, { side: RADIAL_ROOM.side * screen.scale, top: RADIAL_ROOM.top * screen.scale }) : { x: at.x, y: at.y }
    position.value = pressed
    held.value = undefined
    open.value = true
  }

  function close() {
    open.value = false
  }

  /** Whether a hold on the Canvas would open the ring (ticket 1065): the surface times one only then. */
  const canOpen = computed(() => !deps.readOnly() && !!deps.currentProject())
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

  /** Pick color from Canvas: what its button in the Palette does (ticket 1089), so the next press on a bead takes its
   * colour, wherever the ring was opened; picked while the pick is armed, it ends it. */
  function pickColor() {
    deps.toggleColorPick()
    close()
  }

  function undo() {
    if (deps.canUndo()) deps.onUndo()
  }

  function redo() {
    if (deps.canRedo()) deps.onRedo()
  }

  /** The item a point of the screen (client px) is over, by the ring's rule: measured from where the ring stands,
   * which near a screen edge is not where it was pressed. */
  function itemAt(at: { x: number; y: number }): RadialItemId | undefined {
    return radialItemAt({ x: at.x - center.value.x, y: at.y - center.value.y }, RADIAL_HOLE * (deps.screen?.().scale ?? 1))
  }

  /** The armed pointer slid to a point (client px), or, with none, its press ended away from the ring. */
  function slide(at?: { x: number; y: number }) {
    held.value = at && open.value ? itemAt(at) : undefined
  }

  /** The armed pointer lifted at a point (client px): an item that is on is picked as a tap picks it, the hole closes
   * the ring, and an item that is off leaves it open. */
  function slideLift(at: { x: number; y: number }) {
    if (!open.value) return
    const id = itemAt(at)
    const off = id !== undefined && radialItemOff(id, { canUndo: deps.canUndo(), canRedo: deps.canRedo(), recents: deps.recents() })
    const lift = pressBecomes('armed', { type: 'lift', over: id === undefined ? 'hole' : off ? 'off' : 'on' })
    held.value = lift === 'pick' ? id : undefined
    if (lift === 'close') close()
    if (lift === 'pick' && id) pick(id)
    // Undo and Redo leave the ring open with no pointer down: nothing stays pressed.
    if (open.value) held.value = undefined
  }

  /** Picks an item that is on, through the handler its tap calls. */
  function pick(id: RadialItemId) {
    const place = RADIAL_PLACES.find((each) => each.id === id)!
    if ('tool' in place) selectTool(place.tool)
    else if ('recent' in place) pickRecent(deps.recents()[place.recent])
    else if (id === 'pick-color') pickColor()
    else if (id === 'undo') undo()
    else redo()
  }

  return { open, center, openAt, close, selectTool, pickRecent, pickColor, undo, redo, pressed, canOpen, holdAt, holdEnds, hold, endHold, held, slide, slideLift }
}
