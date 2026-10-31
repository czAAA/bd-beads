<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'
import { useFittingForm } from '../../composables/canvas/useFittingForm'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { ExportOpener } from '../../composables/shell/openPanel'
import { overlapsSelectionHandles, type BarBox, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { sheetMovedKey } from '../../composables/ui/useAnchoredPosition'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameAllows } from '../../domain/frameShape'
import type { Project } from '../../domain/project'
import { rowProgressStarted } from '../../domain/rowProgress'
import type { Technique } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import { marginForm, marginScale, type MarginForm } from '../../rendering/marginForm'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import AppButton from '../ui/AppButton.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import IconButton from '../ui/IconButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import MarginColorPopover from './MarginColorPopover.vue'
import MarginMoveBar from './MarginMoveBar.vue'
import MarginTitleBlock from './MarginTitleBlock.vue'
import RowProgressControls from './RowProgressControls.vue'
import type { RowPress } from '../../composables/project/useRowOps'
import { frameOf } from '../../domain/layerRecord'

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
  'toggle-row-direction': []
  'toggle-row-highlight': []
  rename: [name: string]
  'set-technique': [technique: Technique]
  /** A setting of the Frame's Technique, by its id (ticket 0698). */
  'set-setting': [id: string, value: number]
  'save-maker-name': [name: string]
  'set-letters': [on: boolean]
}>()

const { t } = useI18n()
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
const rotatable = computed(() => frameAllows(frame.value, 'rotate'))
/** A Custom frame's shape comes from its settings, and a Frame with a pass done holds still: no Edit Frame then. */
const editable = computed(() => frameAllows(frame.value, 'resize') && !rowProgressStarted(props.project))

const canvas = useCanvasBackground(() => props.project)
// The margin's popups follow their cells as the canvas is panned or zoomed (ticket 0736).
provide(sheetMovedKey, () => props.anchor)
const fold = useTitleBlockFold()
/** The sheet's place, and its lines in the tint that reads on the margin color it is drawn in. */
const sheetStyle = computed(() => {
  const { sheet, tilt, viewport } = props.anchor
  // A Canvas leaning off its quarter turn (ticket 0672) turns the sheet with it, about the middle the drawing turns on.
  const leaning = tilt ? { transform: `rotate(${tilt}deg)`, transformOrigin: `${viewport.width / 2 - sheet.left}px ${viewport.height / 2 - sheet.top}px` } : {}
  return { left: `${sheet.left}px`, top: `${sheet.top}px`, width: `${sheet.width}px`, height: `${sheet.height}px`, '--margin-line': canvas.projectTheme.value.margin.line, ...leaning }
})

/** The sheet's form by its band's height (MarginSheet card, Zoom forms): what the canvas draws it in too. */
const form = computed(() => marginForm(props.anchor.band))
/** What the band's row and the title block are drawn at (ticket 0698): laid out in the drafting sheet's px and scaled
 * with the beads, so the fitting below measures in those px too. */
const scale = computed(() => marginScale(props.anchor.band))

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
type TitleForm = 'full' | 'compact' | 'brief' | 'tab'
const TITLE_FORMS: Record<MarginForm, readonly TitleForm[]> = { full: ['full', 'compact', 'brief', 'tab'], compact: ['compact', 'brief', 'tab'], folded: ['tab'], bare: [] }

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
  forms: () => (canvas.margin.titleBlock.value && frame.value ? (fold.folded.value ? TITLE_FORMS[form.value].filter((shown) => shown === 'tab') : TITLE_FORMS[form.value]) : []),
  room: () => titleRoom.value / scale.value,
  measure: () => (titleEl.value?.firstElementChild?.getBoundingClientRect().width ?? 0) / scale.value,
  observed: () => [titleEl.value?.firstElementChild],
})
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
    maxWidth: `${titleRoom.value / scale.value}px`,
    ...scaledFrom([left ? 0 : '100%', top ? 0 : '100%'].join(' ')),
  }
})

/** How much more of the top edge than the row's inset the title block takes there, with the gap after it, on screen:
 * none where it sits at the bottom (ticket 0728). */
const titleTaken = computed(() => {
  if (!corner.value.top || !title.value || titleSize.width.value === 0) return 0
  return titleInset.value.side + (titleSize.width.value + MARGIN_PX.gap) * scale.value - place.value.side
})

const bandEl = ref<HTMLElement>()
const bandParts = () => [...(bandEl.value?.children ?? [])]
/** The band's room on screen: the sheet's width inside the row's inset, less what the title block takes beside it. */
const bandRoom = computed(() => Math.max(0, props.anchor.sheet.width - 2 * place.value.side - titleTaken.value))
const bandLeft = computed(() => place.value.side + (corner.value.left ? titleTaken.value : 0))
/** The band row's width in drafting px: the Move bar centred, with room on each side for the wider of Row progress and
 * the tools. */
function bandWidth(): number {
  const [start = 0, move = 0, end = 0] = bandParts().map((part) => part.getBoundingClientRect().width / scale.value)
  return move ? move + 2 * Math.max(start, end) + 2 * MARGIN_PX.gap : 0
}
const rowFit = useFittingForm({
  forms: () => ROW_FITS[form.value],
  room: () => bandRoom.value / scale.value,
  measure: bandWidth,
  observed: bandParts,
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
  const { width, height } = { width: titleSize.width.value * scale.value, height: titleSize.height.value * scale.value }
  const { side, edge } = titleInset.value
  const { top, left } = corner.value
  return { left: sheet.left + (left ? side : sheet.width - side - width), top: sheet.top + (top ? edge : sheet.height - edge - height), width, height }
})
const yields = (box: BarBox) => !!props.selection && overlapsSelectionHandles(box, props.selection)
const bandYields = computed(() => yields(bandBox.value))

// Bare, the Move bar stands alone over the middle of the Frame's top edge, above its line, so it takes no press meant
// for the beads (ticket 0682).
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

/** The Margin color popover, hung from its button, or from the Frame tools menu where that holds it. */
const toolsEl = ref<HTMLElement>()
const colorOpen = ref(false)
const colorButton = computed(() =>
  colorOpen.value ? (toolsEl.value?.querySelector<HTMLElement>('[data-testid="margin-color"], [data-testid="margin-frame-tools"]') ?? undefined) : undefined,
)
// It hangs from its button as a dropdown does (ticket 0698): where the zoom or the width takes that button away (into
// the Frame tools menu, or the row with it), it closes rather than float.
const colorHangsFrom = computed(() => (row.value === 'narrow' ? 'menu' : row.value ? 'button' : 'none'))
watch(colorHangsFrom, () => (colorOpen.value = false))

/** Mirror the whole Frame's name: "Mirror off" while it is on (MarginSheet card). */
const mirrorName = computed(() => (props.mirrorOnFrame ? t.value.mirror.mirrorOff : undefined))

/** Folded, the Frame tools menu holds the tools the band has no room for (MarginSheet card, Zoom forms); Mirror the
 * whole Frame first, checked while on, shown as Rotate Frame is. */
const menuItems = computed(() =>
  [
    rotatable.value && { id: 'mirror', action: actions.mirror, run: () => emit('mirror'), checked: !!props.mirrorOnFrame },
    rotatable.value && { id: 'rotate', action: actions.rotate, run: () => emit('rotate') },
    editable.value && { id: 'edit', action: actions.edit, run: () => emit('toggle-edit') },
    { id: 'export', action: actions.export, run: () => emit('export', 'margin-frame-tools') },
    row.value === 'narrow' && { id: 'color', action: actions.color, run: () => (colorOpen.value = true) },
    { id: 'remove', action: actions.remove, run: () => emit('remove') },
  ].filter((item) => !!item),
)
const itemDisabled = (action: (typeof actions)[keyof typeof actions]) => (action.enabled ? !action.enabled(deps.value) : false)
</script>

<template>
  <div
    class="margin-sheet"
    :class="[`margin-sheet--${form}`, { 'margin-sheet--editing': editing && form !== 'bare' }]"
    :style="sheetStyle"
    data-testid="margin-sheet"
  >
    <div
      v-if="row"
      ref="bandEl"
      class="margin-sheet__band"
      :class="[`margin-sheet__band--${row}`, { 'margin-sheet__yielding': bandYields }]"
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
          testid="margin-progress"
          @move-row="emit('move-row', $event)"
          @reset-progress="emit('reset-progress')"
          @toggle-row-direction="emit('toggle-row-direction')"
          @toggle-row-highlight="emit('toggle-row-highlight')"
        />
      </div>
      <MarginMoveBar :dragging="dragging" @press="onMovePress" @key="emit('key', $event)" />
      <div ref="toolsEl" class="margin-sheet__tools">
        <template v-if="row === 'full' || row === 'compact'">
          <IconButton
            v-if="rotatable"
            variant="plain"
            class="margin-sheet__mirror"
            :class="{ 'margin-sheet__mirror--on': mirrorOnFrame }"
            :icon-size="iconSize"
            :action="actions.mirror"
            :label="mirrorName"
            :pressed="!!mirrorOnFrame"
            data-testid="margin-mirror-frame"
            @click="emit('mirror')"
          />
          <IconButton v-if="rotatable" variant="plain" :icon-size="iconSize" :action="actions.rotate" :deps="deps" data-testid="margin-rotate-frame" @click="emit('rotate')" />
          <IconButton
            v-if="editable"
            variant="plain"
            :icon-size="iconSize"
            :action="actions.edit"
            :deps="deps"
            :selected="editing"
            data-testid="frame-edit-toggle"
            @click="emit('toggle-edit')"
          />
          <IconButton variant="plain" :icon-size="iconSize" :action="actions.export" :selected="exportOpen" data-testid="margin-export" @click="emit('export', 'margin-export')" />
        </template>
        <IconButton
          v-if="row !== 'narrow'"
          variant="plain"
          :icon-size="iconSize"
          :action="actions.color"
          :selected="colorOpen"
          aria-haspopup="dialog"
          :aria-expanded="colorOpen"
          data-testid="margin-color"
          @click="colorOpen = !colorOpen"
        />
        <template v-if="row === 'full' || row === 'compact'">
          <span class="margin-sheet__divider" aria-hidden="true" />
          <IconButton variant="plain" :icon-size="iconSize" :action="actions.remove" :deps="deps" class="margin-sheet__remove" data-testid="frame-chrome-remove" @click="emit('remove')" />
        </template>
        <MenuButton v-else variant="plain" icon="more" icon-only :label="t.frame.margin.frameTools" align="end" data-testid="margin-frame-tools">
          <AppMenuItem
            v-for="item in menuItems"
            :key="item.id"
            :icon="item.action.icon"
            :disabled="itemDisabled(item.action)"
            :name="item.action.name(t)"
            :disabled-body="itemDisabled(item.action) ? item.action.disabledBody?.(t, deps) : undefined"
            :checked="'checked' in item ? item.checked : undefined"
            :data-testid="`margin-frame-tools-${item.id}`"
            @select="item.run()"
          >
            {{ item.action.name(t) }}
          </AppMenuItem>
        </MenuButton>
      </div>
    </div>

    <div v-if="form === 'bare'" class="margin-sheet__handle" :class="{ 'margin-sheet__yielding': handleYields }" :style="handleStyle" data-testid="margin-handle">
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
        @set-letters="emit('set-letters', $event)"
        @fold="fold.fold()"
      />
      <!-- Folded, the title block is its name on a tab; where the sheet has room, the tab unfolds it. -->
      <AppButton
        v-else-if="unfoldable"
        variant="text"
        class="margin-sheet__tab"
        :action="actions.show"
        :aria-label="fillBlanks(t.frame.margin.showTitleBlockOf, { name: frame?.name || t.frame.nameEmpty })"
        trailing-icon="chevron-up"
        data-testid="margin-title-tab"
        @click="fold.unfold()"
      >
        <span class="margin-sheet__tab-name">{{ frame?.name || t.frame.nameEmpty }}</span>
      </AppButton>
      <span v-else class="margin-sheet__tab" data-testid="margin-title-tab">
        <span class="margin-sheet__tab-name">{{ frame?.name || t.frame.nameEmpty }}</span>
      </span>
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
  border-radius: var(--radius-lg);
  pointer-events: none;
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

/* Mirror the whole Frame on is the band's own selected look (MarginSheet card): `accent` with its icon `on-accent`, not
 * Edit Frame's `ink`, the Mirror being a setting that stays on. */
.margin-sheet__tools :deep(.margin-sheet__mirror--on),
.margin-sheet__tools :deep(.margin-sheet__mirror--on:hover) {
  color: var(--on-accent);
  background: var(--accent);
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

.margin-sheet__title :deep(.margin-sheet__tab:hover) {
  background: color-mix(in srgb, var(--ink) 10%, var(--margin-title));
}

.margin-sheet__tab-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
