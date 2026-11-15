import { computed, ref } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import type { GridPosition } from '../../domain/grid'
import { beadColorAt, sameBeads } from '../../domain/layerBeads'
import { frameOf, quarterTurnOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import type { Tool } from '../../domain/tool'
import type { Translations } from '../../i18n/translations'

/** What the bead cursor needs from the shell (ADR 0093): the pointer's own press, release and Select drag, the view,
 * and the announcer. Deps are read lazily. */
export interface BeadCursorDeps {
  currentProject: () => Project | undefined
  messages: () => Translations
  activeTool: () => Tool
  selectedColorHex: () => string | null
  /** The bead in the middle of the view, where the cursor starts on a Canvas with no Frame. */
  visibleCentre: () => GridPosition | undefined
  /** Pans the view the shortest way that shows a bead. */
  showBead: (position: GridPosition) => void
  /** Whether a tap paints at all: Edit Frame takes the press for the Frame. */
  tapsBeads: () => boolean
  /** The pointer's press on a bead and its release: a tap. */
  press: (row: number, column: number) => void
  release: () => void
  /** The Select press and drag the pointer makes; `extendSelect` is false when nothing grew. */
  beginSelect: (row: number, column: number) => void
  extendSelect: (row: number, column: number) => boolean
  /** Shows the not-allowed cue for a Selection step that could not grow. */
  refuseSelection: () => void
  /** Leaves paste mode, so Shift + arrows select instead of aiming a stamp. */
  leavePasteMode: () => void
  selection: () => Selection | undefined
  /** The pointer's hover, so the preview shows what a tap would do at the cursor. */
  hover: (row: number, column: number) => void
  hoverEnd: () => void
  /** A bead color in words: the Palette's name, or "empty". */
  colorWords: (hex: string | null) => string
  announce: (text: string) => void
}

/** The on-screen arrows as grid steps, before the Canvas's quarter turn. */
const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

/** A screen step as a grid step on a Canvas turned clockwise by `turn` (the inverse of the drawing's own turn). */
function turned([dRow, dColumn]: [number, number], turn: number): [number, number] {
  if (turn === 90) return [-dColumn, dRow]
  if (turn === 180) return [-dRow, -dColumn]
  if (turn === 270) return [dColumn, -dRow]
  return [dRow, dColumn]
}

/** The keyboard's bead cursor on the Pattern (ticket 0942, ADR 0093): arrows move it a bead, Space or Enter is a tap
 * there through the pointer's own press and release, Shift + arrows the pointer's Select drag, each said once. */
export function useBeadCursor(deps: BeadCursorDeps) {
  const cursor = ref<GridPosition>({ row: 0, column: 0 })
  /** Whether the Pattern has keyboard focus that shows the ring: Tab brought it, or an arrow since a press did. */
  const active = ref(false)
  const shown = computed(() => active.value && deps.currentProject() !== undefined)
  let projectId: string | undefined
  /** Whether Shift + arrows are stretching a Selection from where the cursor was. */
  let extending = false

  function say(key: keyof Translations['beadCursor'], blanks: Record<string, string | number>): void {
    deps.announce(fillBlanks(deps.messages().beadCursor[key], blanks))
  }

  /** Says where the cursor is: row and column as the rulers count them, from the Frame's first bead when there is one. */
  function sayPlace(project: Project): void {
    const { row, column } = cursor.value
    const frame = frameOf(project)
    say('place', { row: row - (frame?.row ?? 0) + 1, column: column - (frame?.column ?? 0) + 1, color: deps.colorWords(beadColorAt(project, row, column)) })
  }

  function show(project: Project): void {
    deps.hover(cursor.value.row, cursor.value.column)
    deps.showBead(cursor.value)
    sayPlace(project)
  }

  /** A Project new to the cursor starts it at the Frame's first bead, or in the middle of the view. */
  function start(project: Project): void {
    if (projectId === project.id) return
    projectId = project.id
    const frame = frameOf(project)
    const at = frame ? { row: frame.row, column: frame.column } : deps.visibleCentre()
    cursor.value = at ? { row: at.row, column: at.column } : { row: 0, column: 0 }
  }

  /** Keyboard focus reached the Pattern by Tab: the ring shows where the cursor is, and it is said. */
  function onKeyboardFocus(): void {
    const project = deps.currentProject()
    if (!project) return
    start(project)
    active.value = true
    show(project)
  }

  function onBlur(): void {
    finishExtending()
    if (active.value) deps.hoverEnd()
    active.value = false
  }

  function finishExtending(): void {
    if (!extending) return
    extending = false
    deps.release()
  }

  function move(project: Project, step: [number, number], extend: boolean): void {
    start(project)
    const [dRow, dColumn] = turned(step, quarterTurnOf(project))
    const from = cursor.value
    const to = { row: from.row + dRow, column: from.column + dColumn }
    if (extend) {
      if (!extending) {
        extending = true
        deps.leavePasteMode()
        deps.beginSelect(from.row, from.column)
      }
      if (!deps.extendSelect(to.row, to.column)) {
        deps.refuseSelection()
        return
      }
    } else {
      finishExtending()
    }
    cursor.value = to
    active.value = true
    deps.hover(to.row, to.column)
    deps.showBead(to)
    const selected = deps.selection()
    if (extend && selected) say('selected', { columns: selected.columns, rows: selected.rows })
    else sayPlace(project)
  }

  /** A tap at the cursor, ending a Shift stretch first; what it changed is said once, nothing when it changed nothing. */
  function tap(project: Project): void {
    if (!deps.tapsBeads()) return
    finishExtending()
    const color = deps.selectedColorHex()
    const tool = deps.activeTool()
    deps.press(cursor.value.row, cursor.value.column)
    deps.release()
    const after = deps.currentProject()
    if (!after || sameBeads(project, after)) return
    if (tool === 'erase') say('erased', {})
    else if (tool === 'fill') say('filled', { color: deps.colorWords(color) })
    else if (tool === 'paint') say('painted', { color: deps.colorWords(color) })
  }

  /** A key on the focused Pattern. `pressed` is a pointer press having focused it: Space then pans, as it always has. */
  function onKey(event: KeyboardEvent, pressed: boolean): void {
    const project = deps.currentProject()
    if (!project || event.ctrlKey || event.metaKey || event.altKey) return
    const step = ARROWS[event.key]
    if (step) {
      move(project, step, event.shiftKey)
    } else if ((event.key === ' ' || event.key === 'Enter') && !pressed) {
      // A held key taps once; a first key after the ring was hidden only shows where the cursor is.
      if (!event.repeat && active.value) tap(project)
      else if (!event.repeat) onKeyboardFocus()
    } else {
      return
    }
    // Held here: the arrows don't scroll, Space doesn't pan, Enter doesn't mark the row done.
    event.preventDefault()
    event.stopPropagation()
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Shift') finishExtending()
  }

  return { cursor, shown, onKeyboardFocus, onBlur, onKey, onKeyUp }
}
