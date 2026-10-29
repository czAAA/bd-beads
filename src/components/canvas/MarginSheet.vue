<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFittingForm } from '../../composables/canvas/useFittingForm'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { ExportOpener } from '../../composables/shell/openPanel'
import { boxesOverlap, overlapsSelectionHandles, type BarBox, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameAllows } from '../../domain/frameShape'
import type { Project } from '../../domain/project'
import { rowProgressStarted } from '../../domain/rowProgress'
import type { Technique } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import { marginForm, type MarginForm } from '../../rendering/marginForm'
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
import { frameOf } from '../../domain/layerRecord'

// The Frame's tools on its margin sheet (MarginSheet card, tickets 0657, 0658): Row progress, the Move bar and the tools
// in its top band, the title block in its bottom-right corner, laid over the sheet the canvas draws. The controls keep
// their size as the band grows and shrinks with the zoom, so the sheet changes form instead; bare, only the Move bar.
const props = defineProps<{
  project: Project
  anchor: FrameAnchor
  /** Whether the Frame's handles are on (Edit Frame): the sheet's edge is outlined in the accent meanwhile. */
  editing: boolean
  /** Whether a pointer is down on the canvas, so the Move bar knows when its drag has ended. */
  pressing: boolean
  rowHighlight?: boolean
  /** Whether the Export panel is open from this sheet's Export button. */
  exportOpen?: boolean
  /** Where the Selection is, if there is one: its handles win a press where the sheet's controls lie over them. */
  selection?: BarBox
  /** Where the Tool pill is: it wins a press over the sheet's controls under it. */
  pill?: BarBox
}>()

const emit = defineEmits<{
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
  'save-maker-name': [name: string]
  'set-letters': [on: boolean]
}>()

const { t } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const actions = {
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

const canvas = useCanvasBackground()
const fold = useTitleBlockFold()
/** The sheet's place, and its lines in the tint that reads on the margin color it is drawn in. */
const sheetStyle = computed(() => {
  const { sheet } = props.anchor
  return { left: `${sheet.left}px`, top: `${sheet.top}px`, width: `${sheet.width}px`, height: `${sheet.height}px`, '--margin-line': canvas.projectTheme.value.margin.line }
})

/** The sheet's form by its band's height (MarginSheet card, Zoom forms): what the canvas draws it in too. */
const form = computed(() => marginForm(props.anchor.band))

// The band's row and the title block step down a form where the sheet is too narrow for them, and are left out where
// nothing fits: `narrow` is the folded row with Margin color in the Frame tools menu and no Row progress.
type RowForm = 'full' | 'compact' | 'folded' | 'narrow'
const ROW_FORMS: Record<MarginForm, readonly RowForm[]> = {
  full: ['full', 'compact', 'folded', 'narrow'],
  compact: ['compact', 'folded', 'narrow'],
  folded: ['folded', 'narrow'],
  bare: [],
}
type TitleForm = 'full' | 'compact' | 'tab'
const TITLE_FORMS: Record<MarginForm, readonly TitleForm[]> = { full: ['full', 'compact', 'tab'], compact: ['compact', 'tab'], folded: ['tab'], bare: [] }

const place = computed(() => (form.value === 'full' ? MARGIN_PX.place.full : MARGIN_PX.place.compact))
/** The room between the sheet's top or bottom edge and the Frame's line: the folded row and tab sit in its middle. */
const roomAbove = computed(() => props.anchor.box.top - props.anchor.sheet.top)
const roomBelow = computed(() => props.anchor.sheet.top + props.anchor.sheet.height - props.anchor.box.top - props.anchor.box.height)
const middle = (room: number) => Math.max(0, (room - MARGIN_PX.tab) / 2)

const bandEl = ref<HTMLElement>()
const bandParts = () => [...(bandEl.value?.children ?? [])]
/** The band row's width: the Move bar centred, with room on each side for the wider of Row progress and the tools. */
function bandWidth(): number {
  const [start = 0, move = 0, end = 0] = bandParts().map((part) => part.getBoundingClientRect().width)
  return move ? move + 2 * Math.max(start, end) + 2 * MARGIN_PX.gap : 0
}
const row = useFittingForm({
  forms: () => ROW_FORMS[form.value],
  room: () => props.anchor.sheet.width - 2 * place.value.side,
  measure: bandWidth,
  observed: bandParts,
})
const rowTop = computed(() => (form.value === 'folded' ? middle(roomAbove.value) : place.value.top))
const rowHeight = computed(() => (row.value === 'full' ? MARGIN_PX.tool : MARGIN_PX.tab))
const bandStyle = computed(() => ({ top: `${rowTop.value}px`, left: `${place.value.side}px`, right: `${place.value.side}px`, height: `${rowHeight.value}px` }))
const small = computed(() => row.value !== 'full')
const iconSize = computed(() => (small.value ? MARGIN_PX.icon.compact : MARGIN_PX.icon.full))
const progressForm = computed(() => (row.value === 'full' ? 'margin' : row.value === 'compact' ? 'compact' : 'folded'))

const titleEl = ref<HTMLElement>()
/** The title block's room: the sheet's width inside its border. */
const titleRoom = computed(() => props.anchor.sheet.width - 2 * (form.value === 'folded' ? MARGIN_PX.place.compact.side : place.value.border))
const title = useFittingForm({
  forms: () => (canvas.margin.titleBlock.value && frame.value ? (fold.folded.value ? TITLE_FORMS[form.value].filter((shown) => shown === 'tab') : TITLE_FORMS[form.value]) : []),
  room: () => titleRoom.value,
  measure: () => titleEl.value?.firstElementChild?.getBoundingClientRect().width ?? 0,
  observed: () => [titleEl.value?.firstElementChild],
})
/** The tab unfolds the title block where the sheet has room for it; folded by the zoom, it only names the Frame. */
const unfoldable = computed(() => fold.folded.value && form.value !== 'folded' && form.value !== 'bare')
/** The title block's inset from the sheet's bottom-right corner: the inner border's, or folded, the tab's. */
const titleInset = computed(() => (form.value === 'folded' ? { right: MARGIN_PX.place.compact.side, bottom: middle(roomBelow.value) } : { right: place.value.border, bottom: place.value.border }))
const titleStyle = computed(() => ({ right: `${titleInset.value.right}px`, bottom: `${titleInset.value.bottom}px`, maxWidth: `${titleRoom.value}px` }))

// The band's row and the title block on the canvas box, for what they give way to: a Selection's handles (ticket 498)
// and the Tool pill.
const bandBox = computed<BarBox>(() => {
  const { sheet } = props.anchor
  return { left: sheet.left + place.value.side, top: sheet.top + rowTop.value, width: Math.max(0, sheet.width - 2 * place.value.side), height: rowHeight.value }
})
const titleSize = useElementSize(titleEl)
const titleBox = computed<BarBox>(() => {
  const { sheet } = props.anchor
  const { width, height } = { width: titleSize.width.value, height: titleSize.height.value }
  const { right, bottom } = titleInset.value
  return { left: sheet.left + sheet.width - right - width, top: sheet.top + sheet.height - bottom - height, width, height }
})
const yields = (box: BarBox) => (!!props.selection && overlapsSelectionHandles(box, props.selection)) || (!!props.pill && boxesOverlap(box, props.pill))
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

/** Folded, the Frame tools menu holds the tools the band has no room for (MarginSheet card, Zoom forms). */
const menuItems = computed(() =>
  [
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
  <div class="margin-sheet" :class="[`margin-sheet--${form}`, { 'margin-sheet--editing': editing && form !== 'bare' }]" :style="sheetStyle" data-testid="margin-sheet">
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
          :form="progressForm"
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
      :class="{ 'margin-sheet__yielding': titleYields }"
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

    <MarginColorPopover v-if="colorOpen && colorButton" :anchor="colorButton" @close="colorOpen = false" />
  </div>
</template>

<style scoped>
/* Over the sheet the canvas draws, letting every press but the controls' through to the canvas. While Edit Frame is on
 * its edge is outlined 1px dashed in the accent at 55%, 3px outside it (MarginSheet card). */
.margin-sheet {
  position: absolute;
  z-index: var(--z-context-bar);
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

/* Over a Selection's handles or under the Tool pill the controls give way (ticket 498). */
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

/* The title block, anchored to the inner border's bottom-right corner; folded, the tab in the middle of the band. */
.margin-sheet__title {
  position: absolute;
  display: flex;
  justify-content: flex-end;
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
