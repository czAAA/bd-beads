<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ownPoint } from '../../composables/ui/cssZoom'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { ExportOpener } from '../../composables/shell/openPanel'
import { overlapsSelectionHandles, type BarBox, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { FrameEdge } from '../../domain/frame'
import type { FrameSettings } from '../../domain/frameShape'
import type { Background, Project } from '../../domain/project'
import type { SeenWay } from '../../domain/rowProgress'
import type { Technique } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import { marginForm, marginScale, type MarginForm } from '../../rendering/marginForm'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { bandNameRoom, bandTools, type BandFit, type BandRow, type BandToolId } from '../../rendering/marginBand'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import IconButton from '../ui/IconButton.vue'
import MarginColorPopover from './MarginColorPopover.vue'
import MarginFrameTools from './MarginFrameTools.vue'
import { takeExpandFocus } from './expandFocus'
import { useFrameTools } from './frameTools'
import MarginMoveBar from './MarginMoveBar.vue'
import MarginFoot from './MarginFoot.vue'
import MarginFrameIdentity from './MarginFrameIdentity.vue'
import type { IdentityForm } from './marginForms'
import type { RowPress } from '../../composables/project/useRowOps'
import type { FrameId } from '../../domain/grid'
import { frameById } from '../../domain/layerRecord'
import { useRotateCopy } from '../../composables/ui/useRotateCopy'
import { FRAME_TURN_MS } from '../../rendering/frameTurn'

// The margin sheet's controls over the sheet the canvas draws (MarginSheet card, tickets 0657, 0658, 1170, 1258): who
// the Frame is and its tools in the top band, what weaving reads and Row progress along the bottom. The controls keep
// their size as the band grows and shrinks with the zoom, so the sheet changes form instead; bare, the Move bar.
const props = defineProps<{
  project: Project
  /** The Frame whose sheet this is (ticket 1220): every control on it acts on this Frame alone. */
  frame: FrameId
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
  /** The canvas view is not yet set for its area (ticket 0991): the sheet's place is a stand-in until it is. */
  placing?: boolean
  /** The Frame's settings popover is asked to open (ticket 1222): the Frame stays toast's Open Frame. */
  popoverAsked?: boolean
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
  'set-row-direction': [way: SeenWay]
  'toggle-row-highlight': []
  rename: [name: string]
  'set-technique': [technique: Technique]
  /** A setting of the Frame's Technique, by its id (ticket 0698). */
  'set-setting': [id: string, value: number]
  'save-maker-name': [name: string]
  /** Replace Bead asked from the foot's Bead chip (ticket 1015): the shell's own question. */
  'replace-bead': [beadId: string]
  'set-letters': [on: boolean]
  /** The settings popover's size, its edge steppers and a Custom frame's own settings (ticket 1222). */
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  'set-settings': [change: FrameSettings]
  /** The Frame's Background, from the Margin color popover's second row (ticket 1222). */
  'set-background': [background: Background]
  /** The settings popover is gone, so what it held settles into one Undo step; or it opened as asked. */
  'settle-settings': []
  'popover-opened': []
  /** Expand the Frame (ticket 1169): the expanded sheet is `MarginRails`. */
  'toggle-expand': []
}>()

const { t } = useI18n()
const own = computed(() => props.frame)
const deps = computed(() => controlDeps({ activeProject: () => props.project, frame: () => own.value }))
const frameTools = useFrameTools(() => props.project, () => own.value, {
  mirrorOn: () => !!props.mirrorOnFrame,
  run: {
    mirror: () => emit('mirror'),
    rotate: () => rotateFromBand(),
    edit: () => emit('toggle-edit'),
    export: () => emit('export', 'margin-frame-tools'),
    color: () => (colorOpen.value = true),
    remove: () => emit('remove'),
  },
})
const toolIds = frameTools.ids
/** The ··· popover is always there and holds every tool, the band's own among them as second triggers (ticket 1220,
 * MarginSheet card: the Frame popover). */
const menuItems = frameTools.items
const actions = { expand: controlAction('expand-frame'), ...frameTools.actions }

const frame = computed(() => frameById(props.project, own.value))

const canvas = useCanvasBackground(() => props.project)
/** A finger: its 44px hit areas stand the band's tools further apart (ticket 0976). */
const touch = useMediaQuery('(pointer: coarse)')
// The margin's popups follow their cells as the canvas is panned or zoomed (ticket 0736).
const fold = useTitleBlockFold()
/** Unseen until the canvas view is set and two frames after (ticket 0991): the sheet would show at the view's stand-in
 * first, and the band's chips and the foot then measure themselves and step down to the forms that fit, which can
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
const form = computed<MarginForm>(() => marginForm(props.anchor.band, least.value))
/** What the band's row and the foot are drawn at (ticket 0698): laid out in the drafting sheet's px and scaled
 * with the beads, so the fitting below measures in those px too. */
const scale = computed(() => marginScale(props.anchor.band, least.value))

// The band's row steps down a form where the sheet is too narrow for it; its tools then leave it for the Frame tools
// menu as the width runs out (ticket 1195).
type RowForm = BandRow
const ROW_FITS: Record<MarginForm, readonly RowForm[]> = {
  full: ['full', 'compact', 'folded'],
  compact: ['compact', 'folded'],
  folded: ['folded'],
  bare: [],
}

/** Whether the foot's two rows fit the band, the facts over Row progress (tickets 1197, 1258). */
const stacks = computed(
  () => form.value === 'full' || (form.value === 'compact' && props.anchor.band >= MARGIN_PX.band.stacked * (least.value ?? MARGIN_PX.scale.min)),
)
/** The places of the sheet's form, in screen px at its scale. */
const place = computed(() => {
  const { top, side, border } = form.value === 'full' ? MARGIN_PX.place.full : MARGIN_PX.place.compact
  return { top: top * scale.value, side: side * scale.value, border: border * scale.value }
})
/** The room between the sheet's top or bottom edge and the Frame's line: the folded row and tab sit in its middle. */
const roomAbove = computed(() => props.anchor.box.top - props.anchor.sheet.top)
const roomBelow = computed(() => props.anchor.sheet.top + props.anchor.sheet.height - props.anchor.box.top - props.anchor.box.height)
const middle = (room: number) => Math.max(0, (room - MARGIN_PX.tab * scale.value) / 2)
/** A part drawn at the scale from its `origin` corner. */
const scaledFrom = (origin: string) => ({ transform: `scale(${scale.value})`, transformOrigin: origin })

/** The foot's inset from the sheet's bottom-left corner: along its left side and its bottom edge, clear of the inner
 * border; folded, one line in the middle of the room between the bottom edge and the Frame's line. */
const footInset = computed(() => {
  const { side, bottom } = MARGIN_PX.foot[form.value === 'full' ? 'full' : 'compact']
  return { side: side * scale.value, edge: form.value === 'folded' ? middle(roomBelow.value) : bottom * scale.value }
})
/** The foot's room on screen, the sheet's width inside its inset; in drafting px, what the facts and Row progress fit
 * into. */
const footRoom = computed(() => Math.max(0, props.anchor.sheet.width - 2 * footInset.value.side))
const footRoomAt1 = computed(() => footRoom.value / scale.value)

const foot = ref<InstanceType<typeof MarginFoot>>()
const footSize = useElementSize(computed(() => foot.value?.$el as HTMLElement | undefined))
// Always the bottom-left as seen, whatever the Canvas or the Frame is turned (ticket 1170): it never shares the top
// band with the row.
const footStyle = computed(() => ({
  left: `${footInset.value.side}px`,
  bottom: `${footInset.value.edge}px`,
  width: `${footRoomAt1.value}px`,
  ...scaledFrom('0 100%'),
}))

/** The band's room on screen: the sheet's width inside the row's inset. */
const bandRoom = computed(() => Math.max(0, props.anchor.sheet.width - 2 * place.value.side))
const bandLeft = computed(() => place.value.side)

// Which of the Frame's tools stand on the band and which are under the Frame tools button (ticket 1195).
/** Whether the band holds the Frame's name: Name and size on the margin is on (MarginSheet card). */
const titleOn = computed(() => canvas.margin.titleBlock.value && !!frame.value)
const bandFit = computed<BandFit | undefined>(() =>
  bandTools({
    tools: toolIds.value,
    rows: ROW_FITS[form.value],
    room: bandRoom.value / scale.value,
    touch: touch.value,
    name: titleOn.value,
    unfold: fold.folded.value,
  }),
)
/** The row shown, if any. */
const row = computed(() => bandFit.value?.row)
const onBand = (id: BandToolId) => !!bandFit.value?.onBand.includes(id)
/** The divider before Remove Frame, with a mouse and another tool before it (as `bandRowWidth` counts it). */
const dividerShown = computed(() => !touch.value && (bandFit.value?.onBand.length ?? 0) > 1)
const rowTop = computed(() => (form.value === 'folded' ? middle(roomAbove.value) : place.value.top))
/** The row's height in drafting px; on screen, times the scale. */
const rowHeight = computed(() => (row.value === 'full' ? MARGIN_PX.tool : MARGIN_PX.tab))
const bandStyle = computed(() => ({ top: `${rowTop.value}px`, left: `${bandLeft.value}px`, width: `${bandRoom.value / scale.value}px`, height: `${rowHeight.value}px`, ...scaledFrom('0 0') }))

// Who the Frame is, after Expand (ticket 1258): all of it in the full and expanded rows, the name alone compact and
// folded; folded by hand, the name with the chevron that unfolds, where there is room to.
const identityForms = computed<readonly IdentityForm[]>(() => {
  if (!bandFit.value?.named) return []
  if (form.value === 'folded') return ['alone']
  if (fold.folded.value) return ['name', 'alone']
  return form.value === 'full' ? ['all', 'noMaker', 'noSettings', 'name', 'alone'] : ['alone']
})
const identityRoom = computed(() => (bandFit.value ? bandNameRoom(bandFit.value, bandRoom.value / scale.value, touch.value) : 0))
const small = computed(() => row.value !== 'full')
const iconSize = computed(() => (small.value ? MARGIN_PX.icon.compact : MARGIN_PX.icon.full))

// The band's row and the foot on the canvas box, for what they give way to: a Selection's handles (ticket 498).
// The Tool pill needs no such rule: it is drawn over the sheet, so it takes its own presses.
const bandBox = computed<BarBox>(() => {
  const { sheet } = props.anchor
  return { left: sheet.left + bandLeft.value, top: sheet.top + rowTop.value, width: bandRoom.value, height: rowHeight.value * scale.value }
})
const footBox = computed<BarBox>(() => {
  const { sheet } = props.anchor
  const { width, height } = { width: footSize.width.value * scale.value, height: footSize.height.value * scale.value }
  const { side, edge } = footInset.value
  return { left: sheet.left + side, top: sheet.top + sheet.height - edge - height, width, height }
})
const yields = (box: BarBox) => !!props.selection && overlapsSelectionHandles(box, props.selection)
const bandYields = computed(() => yields(bandBox.value))

// Bare, the Move bar stands alone over the middle of the Frame's top edge, above its line, so it takes no press meant
// for the beads (ticket 0682); so it does where the sheet is too narrow for even the narrowest row, so the Frame can
// always be moved (ticket 0851).
const handleShown = computed(() => form.value === 'bare' || !row.value)
const handleAt = computed(() => ({ left: props.anchor.box.left - props.anchor.sheet.left + props.anchor.box.width / 2, top: props.anchor.box.top - props.anchor.sheet.top }))
const handleStyle = computed(() => ({ left: `${handleAt.value.left}px`, top: `${handleAt.value.top}px` }))
/** The Move bar and the Frame tools button beside it (ticket 1164), each 24 high, as one box that gives way. */
const handleWidth = MARGIN_PX.moveWidth + MARGIN_PX.gap + MARGIN_PX.tab
const handleYields = computed(() => {
  const { sheet } = props.anchor
  return yields({ left: sheet.left + handleAt.value.left - MARGIN_PX.moveWidth / 2, top: sheet.top + handleAt.value.top - MARGIN_PX.tab, width: handleWidth, height: MARGIN_PX.tab })
})
const footYields = computed(() => footSize.width.value > 0 && yields(footBox.value))

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

/** The Margin color popover, hung from its button, or from the Frame tools menu where that holds it. */
const toolsEl = ref<HTMLElement>()
/** The Frame tools button beside the lone Move bar (ticket 1164). */
const handleToolsEl = ref<HTMLElement>()
/** The tools are one Tab stop too, ←/→ along them (ticket 0857). */
const toolsRoving = useRovingFocus(toolsEl, { selector: '.margin-sheet__tool', axis: () => 'horizontal', managesTabIndex: true })
const colorOpen = ref(false)
const colorButton = computed(() =>
  colorOpen.value ? ((toolsEl.value ?? handleToolsEl.value)?.querySelector<HTMLElement>('[data-testid="margin-color"], [data-testid="margin-frame-tools"]') ?? undefined) : undefined,
)
// It hangs from its button as a dropdown does (ticket 0698): where the zoom or the width takes that button away (into
// the Frame tools menu, the row's or the lone Move bar's), it closes rather than float.
const colorHangsFrom = computed(() => (!row.value ? 'handle' : onBand('color') ? 'button' : 'menu'))
watch(colorHangsFrom, () => (colorOpen.value = false))

const sheetEl = ref<HTMLElement>()
// Back from the expanded rails, the focus returns to Expand the Frame once the sheet is shown (ticket 1260).
watch(
  [arriving, sheetEl],
  ([hidden, sheet]) => {
    if (!hidden && sheet && takeExpandFocus(own.value) && document.activeElement === document.body) sheet.querySelector<HTMLElement>('[data-testid$="expand-frame"]')?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)

/** The Rotate Frame copy that waits where it was pressed (ticket 1016, MarginSheet card). */
const rotateCopy = useRotateCopy({ handOverMs: FRAME_TURN_MS })
/** A screen point as a place in the sheet's parent, in its own px (ticket 1071), which the copy keeps however the sheet
 * moves. */
function inParent(x: number, y: number): { left: number; top: number } {
  const at = ownPoint(sheetEl.value, { clientX: x, clientY: y })
  return { left: at.x + props.anchor.sheet.left, top: at.y + props.anchor.sheet.top }
}
/** Rotate Frame from the band's button or the popover's tile: a pointer's press on the button leaves the copy over it. */
function rotateFromBand(): void {
  const press = rotateCopy.takePress()
  emit('rotate')
  // The popover's Rotate leaves none: the popover itself stays where it is (ticket 1257).
  if (!press?.button) return
  rotateCopy.pressed({ ...inParent(press.button.left, press.button.top), scale: scale.value, small: small.value }, press.touch)
}
/** A press on the copy turns the Frame again, as the band's own button does. */
function rotateFromCopy(): void {
  emit('rotate')
  rotateCopy.pressedAgain()
}
const copyStyle = computed(() => {
  const place = rotateCopy.place.value
  if (!place) return {}
  return { left: `${place.left - props.anchor.sheet.left}px`, top: `${place.top - props.anchor.sheet.top}px`, '--copy-scale': place.scale }
})
// Turned back, the band's own Rotate Frame is under the copy again: it takes over.
watch(
  () => props.anchor,
  () => {
    const own = toolsEl.value?.querySelector('[data-rotate-from="button"]')?.getBoundingClientRect()
    rotateCopy.ownAt(own && inParent(own.left, own.top))
  },
  { flush: 'post' },
)
watch(frame, (now) => now || rotateCopy.drop())

/** Mirror the whole Frame's name: "Mirror off" while it is on (MarginSheet card). */
const mirrorName = computed(() => (props.mirrorOnFrame ? t.value.mirror.mirrorOff : undefined))

/** Where the popover is held through a turn: a Frame tools button drawn anew (the band's to the bare one) reopens there. */
const popoverHeld = ref<Record<string, string>>()
const popoverBindings = computed(() => ({ project: props.project, asked: props.popoverAsked, held: popoverHeld.value, rowHighlight: props.rowHighlight, rowPress: props.rowPress }))
const popoverHandlers = {
  step: (edge: FrameEdge, step: 1 | -1) => emit('step', edge, step),
  resize: (columns: number, rows: number) => emit('resize', columns, rows),
  'set-settings': (change: FrameSettings) => emit('set-settings', change),
  'reset-progress': () => emit('reset-progress'),
  settle: () => emit('settle-settings'),
  opened: () => emit('popover-opened'),
  held: (place: Record<string, string> | undefined) => (popoverHeld.value = place),
  // The popover's fields and Row progress are second triggers of the sheet's chips and strip (ticket 1257).
  rename: (name: string) => emit('rename', name),
  'save-maker-name': (name: string) => emit('save-maker-name', name),
  'set-technique': (technique: Technique) => emit('set-technique', technique),
  'set-setting': (id: string, value: number) => emit('set-setting', id, value),
  'replace-bead': (beadId: string) => emit('replace-bead', beadId),
  'move-row': (delta: number) => emit('move-row', delta),
  'set-row-direction': (way: SeenWay) => emit('set-row-direction', way),
  'toggle-row-highlight': () => emit('toggle-row-highlight'),
}
</script>

<template>
  <div
    ref="sheetEl"
    class="margin-sheet"
    :class="[`margin-sheet--${form}`, { 'margin-sheet--editing': editing && form !== 'bare', 'margin-sheet--arriving': arriving }]"
    :style="sheetStyle"
    :data-frame="own"
    data-testid="margin-sheet"
  >
    <div
      v-if="row"
      class="margin-sheet__band"
      :class="[`margin-sheet__band--${row}`, { 'margin-sheet__band--touch': touch, 'margin-sheet__yielding': bandYields }]"
      :style="bandStyle"
      :data-form="row"
      data-testid="margin-band"
    >
      <div class="margin-sheet__start">
      <IconButton
        variant="plain"
        class="margin-sheet__expand"
        :icon-size="iconSize"
        :action="actions.expand"
        data-testid="margin-expand-frame"
        @click="emit('toggle-expand')"
      />
      <MarginFrameIdentity
        v-if="identityForms.length"
        :project="project"
        :frame="own"
        :forms="identityForms"
        :room="identityRoom"
        @rename="emit('rename', $event)"
        @set-technique="emit('set-technique', $event)"
        @set-setting="(id, value) => emit('set-setting', id, value)"
        @save-maker-name="emit('save-maker-name', $event)"
      />
      </div>
      <MarginMoveBar :dragging="dragging" @press="onMovePress" @key="emit('key', $event)" />
      <div ref="toolsEl" class="margin-sheet__tools" @keydown="toolsRoving.onKeydown" @focusin="toolsRoving.onFocusin" @pointerdown.capture="rotateCopy.notePress" @keydown.capture="rotateCopy.forgetPress">
        <IconButton
          v-if="onBand('mirror')"
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
        <IconButton v-if="onBand('rotate')" variant="plain" class="margin-sheet__tool" :icon-size="iconSize" :action="actions.rotate" :deps="deps" data-testid="margin-rotate-frame" data-rotate-from="button" @click="rotateFromBand" />
        <IconButton
          v-if="onBand('edit')"
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
          v-if="onBand('export')"
          variant="plain"
          class="margin-sheet__tool"
          :icon-size="iconSize"
          :action="actions.export"
          :selected="exportOpen"
          :data-frame="own"
          data-testid="margin-export"
          @click="emit('export', 'margin-export')"
        />
        <IconButton
          v-if="onBand('color')"
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
        <template v-if="onBand('remove')">
          <span v-if="dividerShown" class="margin-sheet__divider" aria-hidden="true" />
          <IconButton variant="plain" :icon-size="iconSize" :action="actions.remove" :deps="deps" class="margin-sheet__tool margin-sheet__remove" data-testid="frame-chrome-remove" @click="emit('remove')" />
        </template>
        <MarginFrameTools v-bind="popoverBindings" :items="menuItems" :deps="deps" :frame="own" v-on="popoverHandlers" />
      </div>
    </div>

    <!-- Bare, or too narrow for even the narrowest row, the Move bar stands alone with the Frame tools button beside it, so
         every Frame tool is a press away at any zoom (ticket 1164). -->
    <div
      v-if="handleShown"
      class="margin-sheet__handle"
      :class="{ 'margin-sheet__yielding': handleYields }"
      :style="handleStyle"
      data-testid="margin-handle"
      @pointerdown.capture="rotateCopy.notePress"
      @keydown.capture="rotateCopy.forgetPress"
    >
      <span class="margin-sheet__handle-expand">
        <IconButton variant="plain" :icon-size="MARGIN_PX.icon.compact" :action="actions.expand" data-testid="margin-handle-expand-frame" @click="emit('toggle-expand')" />
      </span>
      <MarginMoveBar :dragging="dragging" @press="onMovePress" @key="emit('key', $event)" />
      <span ref="handleToolsEl" class="margin-sheet__handle-tools"><MarginFrameTools v-bind="popoverBindings" :items="menuItems" :deps="deps" :frame="own" v-on="popoverHandlers" /></span>
    </div>

    <!-- The foot (tickets 1176, 1258): what weaving reads and Row progress, in the bottom-left corner. -->
    <MarginFoot
      v-if="form !== 'bare'"
      ref="foot"
      :class="{ 'margin-sheet__yielding': footYields }"
      :style="footStyle"
      data-testid="margin-foot"
      :project="project"
      :frame="own"
      :row-highlight="rowHighlight"
      :row-press="rowPress"
      :room="footRoomAt1"
      :scale="scale"
      :sheet-form="form"
      :stacks="stacks"
      @move-row="emit('move-row', $event)"
      @reset-progress="emit('reset-progress')"
      @set-row-direction="emit('set-row-direction', $event)"
      @toggle-row-highlight="emit('toggle-row-highlight')"
      @replace-bead="emit('replace-bead', $event)"
      @set-letters="emit('set-letters', $event)"
    />

    <!-- Rotate Frame's copy, lifted off the paper where it was pressed (ticket 1016): no Tab stop and hidden from a
         screen reader, so Rotate Frame is there once; the band's own button is the keyboard's. -->
    <div
      v-if="rotateCopy.place.value"
      :ref="rotateCopy.copyEl"
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
        @pointerdown="rotateCopy.noteCopyPress"
        @mousedown.prevent
        @click="rotateFromCopy"
      />
    </div>

    <MarginColorPopover v-if="colorOpen && colorButton" :project="project" :frame="own" :anchor="colorButton" @set-background="emit('set-background', $event)" @close="colorOpen = false" />
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
  /* The tools are never squeezed; the name and its chips give way. */
  grid-template-columns: minmax(0, 1fr) auto minmax(max-content, 1fr);
  align-items: center;
  gap: var(--space-4);
}

.margin-sheet__band > *,
.margin-sheet__foot,
.margin-sheet__handle {
  pointer-events: auto;
}

/* Over a Selection's handles the controls give way (ticket 498). */
.margin-sheet__yielding,
.margin-sheet__band.margin-sheet__yielding > * {
  pointer-events: none;
}

.margin-sheet__start {
  justify-self: start;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  max-width: 100%;
}

/* A finger: Expand's 44px hit area stands clear of the name's chip. */
.margin-sheet__band--touch .margin-sheet__start {
  gap: var(--space-12);
}

.margin-sheet__band--touch :deep(.margin-identity__fold) {
  margin-inline-start: var(--space-8);
}

.margin-sheet__start > :deep(.icon-btn-wrap) {
  flex: none;
}

/* Expand the Frame (ticket 1169): the band's first item, a tool's size and look, a divider after it. */
.margin-sheet__start :deep(.margin-sheet__expand),
.margin-sheet__handle-expand :deep(.icon-btn) {
  width: var(--margin-tool);
  height: var(--margin-tool);
  border-radius: var(--radius-md);
}

.margin-sheet__band:not(.margin-sheet__band--full) .margin-sheet__start :deep(.margin-sheet__expand),
.margin-sheet__handle-expand :deep(.icon-btn) {
  width: var(--margin-tool-compact);
  height: var(--margin-tool-compact);
}

.margin-sheet__start :deep(.margin-sheet__expand:hover),
.margin-sheet__handle-expand :deep(.icon-btn:hover) {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

.margin-sheet__tools {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* 28px icon buttons, no fill, hover `ink` at 10%; Edit Frame on is `ink` with a `canvas` icon (IconButton selected). */
.margin-sheet__tools :deep(.icon-btn),
.margin-sheet__handle-tools :deep(.icon-btn) {
  width: var(--margin-tool);
  height: var(--margin-tool);
  border-radius: var(--radius-md);
}

.margin-sheet__tools :deep(.icon-btn:not(.icon-btn--selected):hover),
.margin-sheet__handle-tools :deep(.icon-btn:hover) {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

/* Compact and folded, the tools are 24px with 14px icons, 2px apart (MarginSheet card, Zoom forms); so is the Frame tools
 * button beside the lone Move bar. */
.margin-sheet__band:not(.margin-sheet__band--full) .margin-sheet__tools {
  gap: var(--space-2);
}

.margin-sheet__band:not(.margin-sheet__band--full) .margin-sheet__tools :deep(.icon-btn),
.margin-sheet__handle-tools :deep(.icon-btn) {
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

/* Beside it, the Frame tools button (ticket 1164): 24px, as folded, out to the Move bar's right so the bar stays centred
 * on the Frame; 4px from it, or on a coarse pointer by what its 44px hit area reaches past its drawn size, so the two
 * hit areas never overlap. */
.margin-sheet__handle-tools {
  position: absolute;
  top: 0;
  left: 100%;
  display: flex;
  align-items: center;
  height: 100%;
  margin-inline-start: var(--space-4);
}

@media (pointer: coarse) {
  .margin-sheet__handle-tools {
    margin-inline-start: calc((var(--touch-target) - var(--margin-tool-compact)) / 2);
  }
}

/* Bare, Expand the Frame stands to the Move bar's left as the Frame tools button stands to its right (ticket 1169). */
.margin-sheet__handle-expand {
  position: absolute;
  top: 0;
  right: 100%;
  display: flex;
  align-items: center;
  height: 100%;
  margin-inline-end: var(--space-4);
}

@media (pointer: coarse) {
  .margin-sheet__handle-expand {
    margin-inline-end: calc((var(--touch-target) - var(--margin-tool-compact)) / 2);
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

/* The foot (ticket 1176), anchored to the inner border's bottom-left corner as seen; MarginFoot lays it out. */
.margin-sheet__foot {
  position: absolute;
}
</style>
