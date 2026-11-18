<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ownLength, ownPoint } from '../../composables/ui/cssZoom'
import { useFittingForm } from '../../composables/canvas/useFittingForm'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { ExportOpener } from '../../composables/shell/openPanel'
import { overlapsSelectionHandles, type BarBox, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameAllows } from '../../domain/frameShape'
import type { Project } from '../../domain/project'
import { rowProgressOf, rowProgressPosition, type ShownWay } from '../../domain/rowProgress'
import type { Technique } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import { marginForm, marginScale, type MarginForm } from '../../rendering/marginForm'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import AppButton from '../ui/AppButton.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import IconButton from '../ui/IconButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import EditableLine from '../project/EditableLine.vue'
import MarginColorPopover from './MarginColorPopover.vue'
import MarginMoveBar from './MarginMoveBar.vue'
import MarginTitleBlock from './MarginTitleBlock.vue'
import { frameNameLine } from './marginFrameName'
import RowProgressControls from './RowProgressControls.vue'
import type { RowPress } from '../../composables/project/useRowOps'
import { frameOf } from '../../domain/layerRecord'
import { useRotateCopy, type RotateCopyPlace } from './useRotateCopy'

// The Frame's tools on its margin sheet (MarginSheet card, tickets 0657, 0658, 0728): Row progress, the Move bar and the
// tools in its top band, the title block in the Frame's own bottom-right corner, laid over the sheet the canvas draws. The
// controls keep their size as the band grows and shrinks with the zoom, so the sheet changes form instead; bare, the Move bar.
const props = defineProps<{
  project: Project
  anchor: FrameAnchor
  /** Whether the Frame's handles are on (Edit Frame): the sheet's edge is outlined in the accent meanwhile. */
  editing: boolean
  /** Whether a pointer is down on the canvas, so the Move bar knows when its drag has ended. */
  pressing: boolean
  rowHighlight?: boolean
  /** The last press of Row done or Row not done (ticket 0730): Row done flares the track's spark. */
  rowPress?: RowPress
  /** Whether the Export panel is open from this sheet's Export button. */
  exportOpen?: boolean
  /** Where the Selection is, if there is one: its handles win a press where the sheet's controls lie over them. */
  selection?: BarBox
  /** Whether the whole Frame is the Mirror's Area (ADR 0082): its Mirror the whole Frame is pressed, in the accent. */
  mirrorOnFrame?: boolean
  /** The band has no Row not done: the Homepage demo's sheet, its one exception (MarginSheet card, ticket 0797). */
  withoutNotDone?: boolean
  /** The canvas view is not yet set for its area (ticket 0991): the sheet's place is a stand-in until it is. */
  placing?: boolean
}>()

const emit = defineEmits<{
  /** Mirror the whole Frame pressed: the Mirror onto the whole Frame, or off while it is there (ADR 0082). */
  mirror: []
  rotate: []
  'toggle-edit': []
  /** Export, hung from the button it was asked from: the sheet's Export or, folded, its Frame tools menu. */
  export: [opener: ExportOpener]
  remove: []
  'move-press': [event: PointerEvent]
  key: [event: KeyboardEvent]
  'move-row': [delta: number]
  'reset-progress': []
  /** A way chosen from Turn row direction's list (ticket 0973). */
  'set-row-direction': [way: ShownWay]
  'toggle-row-highlight': []
  rename: [name: string]
  'set-technique': [technique: Technique]
  /** A setting of the Frame's Technique, by its id (ticket 0698). */
  'set-setting': [id: string, value: number]
  'save-maker-name': [name: string]
  /** Replace Bead asked from the roomy title block's Change (ticket 1015): the Frame panel's own question. */
  'replace-bead': [beadId: string]
  'set-letters': [on: boolean]
}>()

const { t, locale } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const actions = {
  mirror: controlAction('mirror-frame'),
  rotate: controlAction('rotate-frame'),
  edit: controlAction('edit-frame'),
  export: controlAction('strip-export'),
  color: controlAction('margin-color'),
  remove: controlAction('remove-frame'),
  show: controlAction('show-title-block'),
}

const frame = computed(() => frameOf(props.project))
const nameLine = computed(() => frameNameLine(t.value, frame.value?.name))
/** The name the tab reads and is named by, or "Name this Frame". */
const tabName = computed(() => frame.value?.name || t.value.frame.nameEmpty)
const rotatable = computed(() => frameAllows(frame.value, 'rotate'))
/** Edit Frame, on a turned Frame too (ticket 1016), so no tool shifts as it turns. A Frame with a row done holds still,
 * its Edit Frame kept in place, disabled, saying why (ticket 0975). */
const editable = computed(() => frameAllows(frame.value, 'resize'))

const canvas = useCanvasBackground(() => props.project)
/** A finger: the band keeps Edit Frame and the Frame tools button, its other tools in that menu (ticket 0976). */
const touch = useMediaQuery('(pointer: coarse)')
// The margin's popups follow their cells as the canvas is panned or zoomed (ticket 0736).
const fold = useTitleBlockFold()
/** Unseen until the canvas view is set and two frames after (ticket 0991): the sheet would show at the view's stand-in
 * first, and the band's row and the title block then measure themselves and step down to the forms that fit, which can
 * take a frame, so the sheet is first seen where it stays, in the forms it keeps. */
const arriving = ref(true)
watch(
  () => props.placing,
  (placing) => {
    if (placing) return
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(() => (arriving.value = false)))
    else arriving.value = false
  },
  { immediate: true },
)
/** The sheet's place, and its lines in the tint that reads on the margin color it is drawn in. */
const sheetStyle = computed(() => {
  const { sheet, tilt, viewport } = props.anchor
  // A Canvas leaning off its quarter turn (ticket 0672) turns the sheet with it, about the middle the drawing turns on.
  const leaning = tilt ? { transform: `rotate(${tilt}deg)`, transformOrigin: `${viewport.width / 2 - sheet.left}px ${viewport.height / 2 - sheet.top}px` } : {}
  return { left: `${sheet.left}px`, top: `${sheet.top}px`, width: `${sheet.width}px`, height: `${sheet.height}px`, '--margin-line': canvas.projectTheme.value.margin.line, ...leaning }
})

/** The sheet's form by its band's height (MarginSheet card, Zoom forms): what the canvas draws it in too, at its least
 * scale (1, or the Homepage demo's; ticket 0851). */
const least = computed(() => canvas.projectTheme.value.margin.leastScale)
const form = computed(() => marginForm(props.anchor.band, least.value))
/** What the band's row and the title block are drawn at (ticket 0698): laid out in the drafting sheet's px and scaled
 * with the beads, so the fitting below measures in those px too. */
const scale = computed(() => marginScale(props.anchor.band, least.value))

// The band's row and the title block step down a form where the sheet is too narrow for them, and are left out where
// nothing fits: `narrow` is the folded row with Margin color in the Frame tools menu and no Row progress. Each tools form
// first gives up Row progress's track (`:1`), then its counter (`:2`): Row done and Row highlight stay to the last.
type RowForm = 'full' | 'compact' | 'folded' | 'narrow'
type RowFit = `${Exclude<RowForm, 'narrow'>}:${0 | 1 | 2}` | 'narrow'
const SMALL_FITS: readonly RowFit[] = ['compact:0', 'compact:1', 'compact:2', 'folded:0', 'folded:2', 'narrow']
const ROW_FITS: Record<MarginForm, readonly RowFit[]> = {
  full: ['full:0', 'full:1', 'full:2', ...SMALL_FITS],
  compact: SMALL_FITS,
  folded: SMALL_FITS.slice(3),
  bare: [],
}
// The legend is the first the title block gives up: `brief` is the compact row without it (ticket 0698).
type TitleForm = 'roomy' | 'full' | 'compact' | 'brief' | 'tab'
const TITLE_FORMS: Record<MarginForm, readonly TitleForm[]> = { full: ['full', 'compact', 'brief', 'tab'], compact: ['compact', 'brief', 'tab'], folded: ['tab'], bare: [] }
/** The roomy block (ticket 1015) is tried first where the band on screen holds it clear of the Frame's line. */
const titleForms = computed<readonly TitleForm[]>(() => (props.anchor.band >= MARGIN_PX.roomy ? ['roomy', ...TITLE_FORMS[form.value]] : TITLE_FORMS[form.value]))

/** The places of the sheet's form, in screen px at its scale. */
const place = computed(() => {
  const { top, side, border } = form.value === 'full' ? MARGIN_PX.place.full : MARGIN_PX.place.compact
  return { top: top * scale.value, side: side * scale.value, border: border * scale.value }
})
/** The room between the sheet's top or bottom edge and the Frame's line: the folded row and tab sit in its middle. */
const roomAbove = computed(() => props.anchor.box.top - props.anchor.sheet.top)
const roomBelow = computed(() => props.anchor.sheet.top + props.anchor.sheet.height - props.anchor.box.top - props.anchor.box.height)
const middle = (room: number) => Math.max(0, (room - MARGIN_PX.tab * scale.value) / 2)
/** The sheet's corner the title block sits in: the Frame's own bottom-right, wherever the Canvas's turn puts it. */
const corner = computed(() => props.anchor.titleCorner ?? { top: false, left: false })
/** The narrowest band row, the Move bar and the Frame tools button, in drafting px: at a top corner the title block
 * leaves it this much room beside it, so the Frame can always be moved. */
const NARROWEST_ROW = MARGIN_PX.moveWidth + 2 * MARGIN_PX.tab + 2 * MARGIN_PX.gap
/** A part drawn at the scale from its `origin` corner. */
const scaledFrom = (origin: string) => ({ transform: `scale(${scale.value})`, transformOrigin: origin })

const titleEl = ref<HTMLElement>()
const titleSize = useElementSize(titleEl)
/** The title block's inset from its corner's side, inside the border or, folded, as the row is. */
const titleSide = computed(() => (form.value === 'folded' ? MARGIN_PX.place.compact.side * scale.value : place.value.border))
/** The title block's room on screen: the sheet's width inside its border, less the narrowest row where it shares the
 * top edge with the band's row. */
const titleRoom = computed(() =>
  corner.value.top
    ? props.anchor.sheet.width - titleSide.value - place.value.side - (NARROWEST_ROW + MARGIN_PX.gap) * scale.value
    : props.anchor.sheet.width - 2 * titleSide.value,
)
const title = useFittingForm({
  forms: () => (canvas.margin.titleBlock.value && frame.value ? (fold.folded.value ? titleForms.value.filter((shown) => shown === 'tab') : titleForms.value) : []),
  room: () => titleRoom.value / scale.value,
  measure: () => ownLength(titleEl.value, titleEl.value?.firstElementChild?.getBoundingClientRect().width ?? 0) / scale.value,
  observed: () => [titleEl.value?.firstElementChild],
  // Its words: a shorter name, maker or language brings back the block it stepped down from (ticket 0851).
  labels: () => {
    const { name, technique, techniqueSettings, columns, rows } = frame.value ?? {}
    return JSON.stringify([locale.value, name, props.project.makerName, technique, techniqueSettings, columns, rows])
  },
})
/** What the title block is drawn at: the sheet's scale, or for the roomy block that scale by its own band over the
 * drafting sheet's, so it is 1 where it first shows and its words never under the sheet's least (ticket 1015). */
const titleScale = computed(() => scale.value * (title.value === 'roomy' ? MARGIN_PX.scale.band / MARGIN_PX.roomy : 1))
/** The tab unfolds the title block where the sheet has room for it; folded by the zoom, it only names the Frame. */
const unfoldable = computed(() => fold.folded.value && form.value !== 'folded' && form.value !== 'bare')
/** The title block's inset from its corner, along the sheet's side and its top or bottom edge: the inner border's, or
 * folded, the tab's in the middle of the room between the edge and the Frame's line. */
const titleInset = computed(() => ({
  side: titleSide.value,
  edge: form.value === 'folded' ? middle(corner.value.top ? roomAbove.value : roomBelow.value) : place.value.border,
}))
const titleStyle = computed(() => {
  const { top, left } = corner.value
  return {
    [left ? 'left' : 'right']: `${titleInset.value.side}px`,
    [top ? 'top' : 'bottom']: `${titleInset.value.edge}px`,
    maxWidth: `${titleRoom.value / titleScale.value}px`,
    transform: `scale(${titleScale.value})`,
    transformOrigin: [left ? 0 : '100%', top ? 0 : '100%'].join(' '),
  }
})

/** How much more of the top edge than the row's inset the title block takes there, with the gap after it, on screen:
 * none where it sits at the bottom (ticket 0728). */
const titleTaken = computed(() => {
  if (!corner.value.top || !title.value || titleSize.width.value === 0) return 0
  return titleInset.value.side + titleSize.width.value * titleScale.value + MARGIN_PX.gap * scale.value - place.value.side
})

const bandEl = ref<HTMLElement>()
const bandParts = () => [...(bandEl.value?.children ?? [])]
/** The band's room on screen: the sheet's width inside the row's inset, less what the title block takes beside it. */
const bandRoom = computed(() => Math.max(0, props.anchor.sheet.width - 2 * place.value.side - titleTaken.value))
const bandLeft = computed(() => place.value.side + (corner.value.left ? titleTaken.value : 0))
/** The band row's width in drafting px: the Move bar centred, with room on each side for the wider of Row progress and
 * the tools. */
function bandWidth(): number {
  const [start = 0, move = 0, end = 0] = bandParts().map((part) => ownLength(part, part.getBoundingClientRect().width) / scale.value)
  return move ? move + 2 * Math.max(start, end) + 2 * MARGIN_PX.gap : 0
}
const rowFit = useFittingForm({
  forms: () => ROW_FITS[form.value],
  room: () => bandRoom.value / scale.value,
  measure: bandWidth,
  observed: bandParts,
  // What the row reads and holds: Row done or Column done, the counter, the language, the tools shown. Turned back to
  // rows, the row it stepped down from shows whole again where it fits (ticket 0851).
  labels: () => {
    const { current, total } = rowProgressPosition(props.project)
    return JSON.stringify([locale.value, rowProgressOf(props.project).direction, current, total, rotatable.value, editable.value, touch.value])
  },
})
const row = computed(() => rowFit.value?.split(':')[0] as RowForm | undefined)
/** How much of Row progress the row gives up: nothing, its track, or its track and counter. */
const progressDrop = computed(() => Number(rowFit.value?.split(':')[1] ?? 0) as 0 | 1 | 2)
const rowTop = computed(() => (form.value === 'folded' ? middle(roomAbove.value) : place.value.top))
/** The row's height in drafting px; on screen, times the scale. */
const rowHeight = computed(() => (row.value === 'full' ? MARGIN_PX.tool : MARGIN_PX.tab))
const bandStyle = computed(() => ({ top: `${rowTop.value}px`, left: `${bandLeft.value}px`, width: `${bandRoom.value / scale.value}px`, height: `${rowHeight.value}px`, ...scaledFrom('0 0') }))
const small = computed(() => row.value !== 'full')
const iconSize = computed(() => (small.value ? MARGIN_PX.icon.compact : MARGIN_PX.icon.full))
const progressForm = computed(() => (row.value === 'full' ? 'margin' : row.value === 'compact' ? 'compact' : 'folded'))

// The band's row and the title block on the canvas box, for what they give way to: a Selection's handles (ticket 498).
// The Tool pill needs no such rule: it is drawn over the sheet, so it takes its own presses.
const bandBox = computed<BarBox>(() => {
  const { sheet } = props.anchor
  return { left: sheet.left + bandLeft.value, top: sheet.top + rowTop.value, width: bandRoom.value, height: rowHeight.value * scale.value }
})
const titleBox = computed<BarBox>(() => {
  const { sheet } = props.anchor
  const { width, height } = { width: titleSize.width.value * titleScale.value, height: titleSize.height.value * titleScale.value }
  const { side, edge } = titleInset.value
  const { top, left } = corner.value
  return { left: sheet.left + (left ? side : sheet.width - side - width), top: sheet.top + (top ? edge : sheet.height - edge - height), width, height }
})
const yields = (box: BarBox) => !!props.selection && overlapsSelectionHandles(box, props.selection)
const bandYields = computed(() => yields(bandBox.value))

// Bare, the Move bar stands alone over the middle of the Frame's top edge, above its line, so it takes no press meant
// for the beads (ticket 0682); so it does where the sheet is too narrow for even the narrowest row, so the Frame can
// always be moved (ticket 0851).
const handleShown = computed(() => form.value === 'bare' || !row.value)
const handleAt = computed(() => ({ left: props.anchor.box.left - props.anchor.sheet.left + props.anchor.box.width / 2, top: props.anchor.box.top - props.anchor.sheet.top }))
const handleStyle = computed(() => ({ left: `${handleAt.value.left}px`, top: `${handleAt.value.top}px` }))
const handleYields = computed(() => {
  const { sheet } = props.anchor
  return yields({ left: sheet.left + handleAt.value.left - MARGIN_PX.moveWidth / 2, top: sheet.top + handleAt.value.top - MARGIN_PX.tab, width: MARGIN_PX.moveWidth, height: MARGIN_PX.tab })
})
const titleYields = computed(() => titleSize.width.value > 0 && yields(titleBox.value))

/** Row progress is one Tab stop, ←/→ along its controls, as in the Progress bar (ADR 0075). */
const progressEl = ref<HTMLElement>()
const roving = useRovingFocus(progressEl, { axis: () => 'horizontal', managesTabIndex: true })

/** Whether the Move bar is being dragged: it turns accent until the canvas press ends. */
const dragging = ref(false)
watch(
  () => props.pressing,
  (pressing) => {
    if (!pressing) dragging.value = false
  },
)
function onMovePress(event: PointerEvent): void {
  dragging.value = true
  emit('move-press', event)
}

/** Which tools the band shows as buttons: all of them in the full and compact rows; folded, Margin color; on a coarse
 * pointer, Edit Frame alone, the rest in the Frame tools menu so no two 44px hit areas overlap (ticket 0976). The
 * narrow row shows none. */
const iconsShown = computed(() => !touch.value && (row.value === 'full' || row.value === 'compact'))
const editShown = computed(() => editable.value && (iconsShown.value || (touch.value && row.value !== 'narrow')))
const colorShown = computed(() => !touch.value && row.value !== 'narrow')

/** The Margin color popover, hung from its button, or from the Frame tools menu where that holds it. */
const toolsEl = ref<HTMLElement>()
/** The tools are one Tab stop too, ←/→ along them (ticket 0857), so the title block's name is the next stop. */
const toolsRoving = useRovingFocus(toolsEl, { selector: '.margin-sheet__tool', axis: () => 'horizontal', managesTabIndex: true })
const colorOpen = ref(false)
const colorButton = computed(() =>
  colorOpen.value ? (toolsEl.value?.querySelector<HTMLElement>('[data-testid="margin-color"], [data-testid="margin-frame-tools"]') ?? undefined) : undefined,
)
// It hangs from its button as a dropdown does (ticket 0698): where the zoom or the width takes that button away (into
// the Frame tools menu, or the row with it), it closes rather than float.
const colorHangsFrom = computed(() => (!row.value ? 'none' : colorShown.value ? 'button' : 'menu'))
watch(colorHangsFrom, () => (colorOpen.value = false))

const sheetEl = ref<HTMLElement>()
/** The pointer press on the band's Rotate Frame or its menu item, if the next Rotate Frame came from one: a press from
 * the keyboard leaves no copy, as focus goes with the band (ticket 1016). */
let rotatePress: { button?: DOMRect; at: { x: number; y: number }; touch: boolean } | undefined
function notePress(event: PointerEvent): void {
  const pressed = event.target instanceof Element ? event.target.closest('[data-rotate-frame]') : null
  const button = pressed?.getAttribute('data-rotate-frame') === 'band' ? pressed.getBoundingClientRect() : undefined
  rotatePress = pressed ? { button, at: { x: event.clientX, y: event.clientY }, touch: event.pointerType === 'touch' } : undefined
}

/** The Rotate Frame copy that waits where it was pressed (ticket 1016, MarginSheet card). */
const rotateCopy = useRotateCopy()
/** A screen point as a place in the sheet's parent, in its own px (ticket 1071), which the copy keeps however the sheet
 * moves. */
function inParent(x: number, y: number): { left: number; top: number } {
  const at = ownPoint(sheetEl.value, { clientX: x, clientY: y })
  return { left: at.x + props.anchor.sheet.left, top: at.y + props.anchor.sheet.top }
}
/** Rotate Frame from the band's button or its menu item: a pointer's press leaves the copy over the button, or a full
 * size one centred where the item was pressed. */
function rotateFromBand(): void {
  const press = rotatePress
  rotatePress = undefined
  emit('rotate')
  if (!press) return
  const at = inParent(press.at.x, press.at.y)
  const place: RotateCopyPlace = press.button
    ? { ...inParent(press.button.left, press.button.top), scale: scale.value, small: small.value }
    : { left: at.left - MARGIN_PX.tool / 2, top: at.top - MARGIN_PX.tool / 2, scale: 1, small: false }
  rotateCopy.pressed(place, press.touch)
}
/** A press on the copy turns the Frame again, as the band's own button does. */
let copyTouch = false
function noteCopyPress(event: PointerEvent): void {
  copyTouch = event.pointerType === 'touch'
}
function rotateFromCopy(): void {
  emit('rotate')
  rotateCopy.pressed(undefined, copyTouch)
}
const copyStyle = computed(() => {
  const place = rotateCopy.place.value
  if (!place) return {}
  return { left: `${place.left - props.anchor.sheet.left}px`, top: `${place.top - props.anchor.sheet.top}px`, '--copy-scale': place.scale }
})
/** How near, in px, the band's own button must come back to the copy to stand under it: the same place, less rounding. */
const SAME_PLACE_PX = 1
// Turned back, the band's own Rotate Frame is under the copy again: it takes over.
watch(
  () => props.anchor,
  () => {
    const place = rotateCopy.place.value
    const own = toolsEl.value?.querySelector('[data-rotate-frame="band"]')?.getBoundingClientRect()
    if (!place || !own) return
    const at = inParent(own.left, own.top)
    if (Math.abs(at.left - place.left) < SAME_PLACE_PX && Math.abs(at.top - place.top) < SAME_PLACE_PX) rotateCopy.handOver()
  },
  { flush: 'post' },
)
watch(frame, (now) => now || rotateCopy.drop())
// A pointer that left before the copy was drawn under it never enters or leaves it: each move tells it where it is.
const copyEl = ref<HTMLElement>()
function onPointerMove(event: PointerEvent): void {
  const box = copyEl.value?.getBoundingClientRect()
  if (!box) return
  const over = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
  if (over) rotateCopy.enter(event)
  else rotateCopy.leave(event)
}
watch(
  () => !!rotateCopy.place.value,
  (shown) => (shown ? window.addEventListener('pointermove', onPointerMove, { passive: true }) : window.removeEventListener('pointermove', onPointerMove)),
)
onBeforeUnmount(() => window.removeEventListener('pointermove', onPointerMove))

/** Mirror the whole Frame's name: "Mirror off" while it is on (MarginSheet card). */
const mirrorName = computed(() => (props.mirrorOnFrame ? t.value.mirror.mirrorOff : undefined))

/** The Frame tools menu holds the tools the band shows no button for (MarginSheet card, Zoom forms); Mirror the whole
 * Frame first, checked while on, shown as Rotate Frame is. */
const menuItems = computed(() =>
  [
    rotatable.value && { id: 'mirror', action: actions.mirror, run: () => emit('mirror'), checked: !!props.mirrorOnFrame },
    rotatable.value && { id: 'rotate', action: actions.rotate, run: rotateFromBand },
    editable.value && !editShown.value && { id: 'edit', action: actions.edit, run: () => emit('toggle-edit') },
    { id: 'export', action: actions.export, run: () => emit('export', 'margin-frame-tools') },
    !colorShown.value && { id: 'color', action: actions.color, run: () => (colorOpen.value = true) },
    { id: 'remove', action: actions.remove, run: () => emit('remove') },
  ].filter((item) => !!item),
)
const itemDisabled = (action: (typeof actions)[keyof typeof actions]) => (action.enabled ? !action.enabled(deps.value) : false)
</script>

<template>
  <div
    ref="sheetEl"
    class="margin-sheet"
    :class="[`margin-sheet--${form}`, { 'margin-sheet--editing': editing && form !== 'bare', 'margin-sheet--arriving': arriving }]"
    :style="sheetStyle"
    data-testid="margin-sheet"
  >
    <div
      v-if="row"
      ref="bandEl"
      class="margin-sheet__band"
      :class="[`margin-sheet__band--${row}`, { 'margin-sheet__band--touch': touch, 'margin-sheet__yielding': bandYields }]"
      :style="bandStyle"
      :data-form="row"
      data-testid="margin-band"
    >
      <div ref="progressEl" class="margin-sheet__progress" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
        <RowProgressControls
          v-if="row !== 'narrow'"
          :project="project"
          :row-highlight="rowHighlight"
          :row-press="rowPress"
          :form="progressForm"
          :drop="progressDrop"
          :without-not-done="withoutNotDone"
          testid="margin-progress"
          @move-row="emit('move-row', $event)"
          @reset-progress="emit('reset-progress')"
          @set-row-direction="emit('set-row-direction', $event)"
          @toggle-row-highlight="emit('toggle-row-highlight')"
        />
      </div>
      <MarginMoveBar :dragging="dragging" @press="onMovePress" @key="emit('key', $event)" />
      <div ref="toolsEl" class="margin-sheet__tools" @keydown="toolsRoving.onKeydown" @focusin="toolsRoving.onFocusin" @pointerdown.capture="notePress">
        <template v-if="iconsShown">
          <IconButton
            v-if="rotatable"
            variant="plain"
            class="margin-sheet__tool margin-sheet__mirror"
            :class="{ 'margin-sheet__mirror--on': mirrorOnFrame }"
            :icon-size="iconSize"
            :action="actions.mirror"
            :label="mirrorName"
            :pressed="!!mirrorOnFrame"
            data-testid="margin-mirror-frame"
            @click="emit('mirror')"
          />
          <IconButton v-if="rotatable" variant="plain" class="margin-sheet__tool" :icon-size="iconSize" :action="actions.rotate" :deps="deps" data-testid="margin-rotate-frame" data-rotate-frame="band" @click="rotateFromBand" />
        </template>
        <IconButton
          v-if="editShown"
          variant="plain"
          class="margin-sheet__tool"
          :icon-size="iconSize"
          :action="actions.edit"
          :deps="deps"
          :selected="editing"
          data-testid="frame-edit-toggle"
          @click="emit('toggle-edit')"
        />
        <IconButton
          v-if="iconsShown"
          variant="plain"
          class="margin-sheet__tool"
          :icon-size="iconSize"
          :action="actions.export"
          :selected="exportOpen"
          data-testid="margin-export"
          @click="emit('export', 'margin-export')"
        />
        <IconButton
          v-if="colorShown"
          variant="plain"
          class="margin-sheet__tool"
          :icon-size="iconSize"
          :action="actions.color"
          :selected="colorOpen"
          aria-haspopup="dialog"
          :aria-expanded="colorOpen"
          data-testid="margin-color"
          @click="colorOpen = !colorOpen"
        />
        <template v-if="iconsShown">
          <span class="margin-sheet__divider" aria-hidden="true" />
          <IconButton variant="plain" :icon-size="iconSize" :action="actions.remove" :deps="deps" class="margin-sheet__tool margin-sheet__remove" data-testid="frame-chrome-remove" @click="emit('remove')" />
        </template>
        <MenuButton v-else variant="plain" class="margin-sheet__tool" icon="more" icon-only :label="t.frame.margin.frameTools" align="end" data-testid="margin-frame-tools">
          <AppMenuItem
            v-for="item in menuItems"
            :key="item.id"
            :icon="item.action.icon"
            :disabled="itemDisabled(item.action)"
            :name="item.action.name(t)"
            :disabled-body="itemDisabled(item.action) ? item.action.disabledBody?.(t, deps) : undefined"
            :checked="'checked' in item ? item.checked : undefined"
            :data-testid="`margin-frame-tools-${item.id}`"
            :data-rotate-frame="item.id === 'rotate' ? 'menu' : undefined"
            @select="item.run()"
          >
            {{ item.action.name(t) }}
          </AppMenuItem>
        </MenuButton>
      </div>
    </div>

    <div v-if="handleShown" class="margin-sheet__handle" :class="{ 'margin-sheet__yielding': handleYields }" :style="handleStyle" data-testid="margin-handle">
      <MarginMoveBar :dragging="dragging" @press="onMovePress" @key="emit('key', $event)" />
    </div>

    <div
      v-if="title"
      ref="titleEl"
      class="margin-sheet__title"
      :class="{ 'margin-sheet__yielding': titleYields, 'margin-sheet__title--left': corner.left }"
      :style="titleStyle"
      :data-form="title"
      data-testid="margin-title"
    >
      <MarginTitleBlock
        v-if="title !== 'tab'"
        :project="project"
        :form="title"
        @rename="emit('rename', $event)"
        @set-technique="emit('set-technique', $event)"
        @set-setting="(id, value) => emit('set-setting', id, value)"
        @save-maker-name="emit('save-maker-name', $event)"
        @replace-bead="emit('replace-bead', $event)"
        @set-letters="emit('set-letters', $event)"
        @fold="fold.fold()"
      />
      <!-- Folded, the title block is its name on a tab; where the sheet has room, the tab unfolds it. Unnamed, the tab
           invites a name: "Name this Frame" opens the name field and its chevron unfolds (ticket 0803). -->
      <span v-else-if="!frame?.name" class="margin-sheet__tab margin-sheet__tab--unnamed" data-testid="margin-title-tab">
        <EditableLine v-bind="nameLine" invite-only class="margin-sheet__tab-name" @save="emit('rename', $event)" />
        <IconButton
          v-if="unfoldable"
          variant="plain"
          icon="chevron-up"
          :icon-size="12"
          :action="actions.show"
          :label="fillBlanks(t.frame.margin.showTitleBlockOf, { name: tabName })"
          data-testid="margin-title-unfold"
          @click="fold.unfold()"
        />
      </span>
      <AppButton
        v-else-if="unfoldable"
        variant="text"
        class="margin-sheet__tab"
        :action="actions.show"
        :aria-label="fillBlanks(t.frame.margin.showTitleBlockOf, { name: tabName })"
        trailing-icon="chevron-up"
        data-testid="margin-title-tab"
        @click="fold.unfold()"
      >
        <span class="margin-sheet__tab-name">{{ tabName }}</span>
      </AppButton>
      <span v-else class="margin-sheet__tab" data-testid="margin-title-tab">
        <span class="margin-sheet__tab-name">{{ tabName }}</span>
      </span>
    </div>

    <!-- Rotate Frame's copy, lifted off the paper where it was pressed (ticket 1016): no Tab stop and hidden from a
         screen reader, so Rotate Frame is there once; the band's own button is the keyboard's. -->
    <div
      v-if="rotateCopy.place.value"
      ref="copyEl"
      class="margin-sheet__rotate-copy"
      :class="{ 'margin-sheet__rotate-copy--leaving': rotateCopy.leaving.value, 'margin-sheet__rotate-copy--small': rotateCopy.place.value.small }"
      :style="copyStyle"
      data-testid="margin-rotate-copy"
      aria-hidden="true"
      @pointerenter="rotateCopy.enter"
      @pointerleave="rotateCopy.leave"
    >
      <IconButton
        variant="plain"
        class="margin-sheet__tool"
        :icon-size="rotateCopy.place.value.small ? MARGIN_PX.icon.compact : MARGIN_PX.icon.full"
        :action="actions.rotate"
        :deps="deps"
        tabindex="-1"
        @pointerdown="noteCopyPress"
        @mousedown.prevent
        @click="rotateFromCopy"
      />
    </div>

    <MarginColorPopover v-if="colorOpen && colorButton" :project="project" :anchor="colorButton" @close="colorOpen = false" />
  </div>
</template>

<style scoped>
/* Over the sheet the canvas draws, letting every press but the controls' through to the canvas. It is part of the
 * drawing, so it takes no z-index: the Tool pill, its color popover and the Selection bar float over it (StackingOrder
 * card). While Edit Frame is on its edge is outlined 1px dashed in the accent at 55%, 3px outside it (MarginSheet card). */
.margin-sheet {
  position: absolute;
  box-sizing: border-box;
  color: var(--ink);
  border-radius: var(--margin-sheet-radius);
  pointer-events: none;
}

.margin-sheet--arriving {
  visibility: hidden;
}

.margin-sheet--editing {
  outline: 1px dashed color-mix(in srgb, var(--accent) 55%, transparent);
  outline-offset: 3px;
}

/* The top band, 14px in from the sheet's corner (8px down and 10px in compact, in the middle of the band folded): Row
 * progress at the left, the Move bar centred, the tools at the right. */
.margin-sheet__band {
  position: absolute;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
}

.margin-sheet__band > *,
.margin-sheet__title,
.margin-sheet__handle {
  pointer-events: auto;
}

/* Over a Selection's handles the controls give way (ticket 498). */
.margin-sheet__yielding,
.margin-sheet__band.margin-sheet__yielding > * {
  pointer-events: none;
}

.margin-sheet__progress {
  justify-self: start;
  display: flex;
}

.margin-sheet__tools {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* 28px icon buttons, no fill, hover `ink` at 10%; Edit Frame on is `ink` with a `canvas` icon (IconButton selected). */
.margin-sheet__tools :deep(.icon-btn) {
  width: var(--margin-tool);
  height: var(--margin-tool);
  border-radius: var(--radius-md);
}

.margin-sheet__tools :deep(.icon-btn:not(.icon-btn--selected):hover) {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

/* Compact and folded, the tools are 24px with 14px icons, 2px apart (MarginSheet card, Zoom forms). */
.margin-sheet__band:not(.margin-sheet__band--full) .margin-sheet__tools {
  gap: var(--space-2);
}

.margin-sheet__band:not(.margin-sheet__band--full) .margin-sheet__tools :deep(.icon-btn) {
  width: var(--margin-tool-compact);
  height: var(--margin-tool-compact);
}

/* On a coarse pointer (ticket 0976) Edit Frame and the Frame tools button stand apart by what their 44px hit areas
 * reach past their drawn size, and clear of the Move bar's, so no two overlap. */
.margin-sheet__band--touch.margin-sheet__band--full .margin-sheet__tools {
  gap: calc(var(--touch-target) - var(--margin-tool));
  padding-inline-start: calc((var(--touch-target) - var(--margin-tool)) / 2);
}

.margin-sheet__band--touch:not(.margin-sheet__band--full) .margin-sheet__tools {
  gap: calc(var(--touch-target) - var(--margin-tool-compact));
  padding-inline-start: calc((var(--touch-target) - var(--margin-tool-compact)) / 2);
}

/* So do Row progress's 28px Turn row direction and Reset progress, and Back a row beside Row done, in the full row. */
.margin-sheet__band--touch :deep(.row-progress--margin > .icon-btn-wrap + .icon-btn-wrap) {
  margin-inline-start: calc(var(--touch-target) - var(--margin-tool) - var(--space-4));
}

.margin-sheet__band--touch :deep(.row-progress__steps > .icon-btn-wrap + *) {
  margin-inline-start: calc((var(--touch-target) - var(--margin-tool)) / 2 - var(--space-4));
}

/* Mirror the whole Frame on is the band's own selected look (MarginSheet card): `accent` with its icon `on-accent`, not
 * Edit Frame's `ink`, the Mirror being a setting that stays on. */
.margin-sheet__tools :deep(.margin-sheet__mirror--on),
.margin-sheet__tools :deep(.margin-sheet__mirror--on:hover) {
  color: var(--on-accent);
  background: var(--accent);
}

/* Its focus ring takes on-accent on that fill (KeyboardFocus card, ticket 0938). */
.margin-sheet__tools :deep(.icon-btn.margin-sheet__mirror--on:focus-visible) {
  outline-color: var(--focus-ring-on-accent);
}

/* Remove Frame is `ink` on the paper and `danger` on hover. */
.margin-sheet__tools :deep(.margin-sheet__remove:hover) {
  color: var(--danger);
}

.margin-sheet__divider {
  width: 1px;
  height: var(--space-16);
  margin: 0 var(--space-2);
  background: var(--margin-line);
}

/* The Move bar is 24 high compact, folded and bare (28 in the full form). */
.margin-sheet__band:not(.margin-sheet__band--full) :deep(.margin-move),
.margin-sheet__handle :deep(.margin-move) {
  height: var(--margin-tab);
}

/* Bare, the Move bar is centred along the Frame's top edge, its bottom on the Frame's line (ticket 0682). On a coarse pointer
 * it rises by the part of its 44px hit area below it and 16px more, the reach of a browser's touch adjustment, so a
 * finger on the first row reaches the bead. */
.margin-sheet__handle {
  position: absolute;
  display: flex;
  transform: translate(-50%, -100%);
}

@media (pointer: coarse) {
  .margin-sheet__handle {
    transform: translate(-50%, calc(-100% - (var(--touch-target) - var(--margin-tab)) / 2 - var(--space-16)));
  }
}

/* Rotate Frame's copy (MarginSheet card, ticket 1016): the band's button lifted off the paper on an `elevated` pill with
 * `elevation-3`, at the scale the band drew it, its button where the band's was; it fades on leaving. */
.margin-sheet__rotate-copy {
  position: absolute;
  display: flex;
  margin: calc(-1 * (var(--space-4) + 1px));
  padding: var(--space-4);
  background: var(--elevated);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  transform: scale(var(--copy-scale));
  transform-origin: calc(var(--space-4) + 1px) calc(var(--space-4) + 1px);
  pointer-events: auto;
  transition: opacity var(--rotate-copy-fade) var(--ease-in);
}

.margin-sheet__rotate-copy--leaving {
  opacity: 0;
}

.margin-sheet__rotate-copy :deep(.icon-btn) {
  width: var(--margin-tool);
  height: var(--margin-tool);
  border-radius: var(--radius-md);
}

.margin-sheet__rotate-copy--small :deep(.icon-btn) {
  width: var(--margin-tool-compact);
  height: var(--margin-tool-compact);
}

.margin-sheet__rotate-copy :deep(.icon-btn:hover) {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

/* The title block, anchored to the inner border's corner at the Frame's own bottom-right; folded, the tab in the middle
 * of the band. */
.margin-sheet__title {
  position: absolute;
  display: flex;
  justify-content: flex-end;
}

.margin-sheet__title--left {
  justify-content: flex-start;
}

/* The name tab: 24px, `margin-title` fill, the name (Inter 600 11) and `chevron-up` when it unfolds the block. */
.margin-sheet__tab,
.margin-sheet__title :deep(.margin-sheet__tab) {
  display: inline-flex;
  align-items: center;
  gap: var(--space-6);
  max-width: 100%;
  height: var(--margin-tab);
  padding: 0 var(--space-6) 0 var(--space-10);
  box-sizing: border-box;
  color: var(--ink);
  font: var(--margin-tab-name);
  background: var(--margin-title);
  border: 1px solid var(--margin-line);
  border-radius: var(--radius-sm);
}

/* Only the tab that unfolds as a whole fills on hover; the span forms are not pressed (ticket 0803). */
.margin-sheet__title :deep(button.margin-sheet__tab:hover) {
  background: color-mix(in srgb, var(--ink) 10%, var(--margin-title));
}

/* Unnamed, the tab holds "Name this Frame" and, where it unfolds, an 18px chevron button (ticket 0803). */
.margin-sheet__tab--unnamed :deep(.icon-btn) {
  width: var(--margin-pencil);
  height: var(--margin-pencil);
  color: var(--body);
  border-radius: var(--radius-sm);
}

.margin-sheet__tab-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
