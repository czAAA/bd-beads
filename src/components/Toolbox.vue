<script setup lang="ts">
import { computed } from 'vue'
import PalettePicker from './PalettePicker.vue'
import ToolGroup from './ToolGroup.vue'
import { useI18n } from '../i18n/useI18n'
import type { Tool } from '../domain/tool'
import { maxAxisCount, type MirrorAxisCounts } from '../domain/mirror'
import { rowProgressPosition, type MirrorAxes, type Pattern } from '../domain/pattern'

const props = defineProps<{
  pattern: Pattern
  activeTool: Tool
  selectedColorId?: string
  canUndo: boolean
  canCopy: boolean
  mirrorAxes: MirrorAxes
  /** Rich Mirror (ticket 44, flag VITE_RICH_MIRROR): swaps the two on/off toggles below for axis counters when on. */
  richMirror: boolean
  mirrorAxisCounts: MirrorAxisCounts
  /** Rich Mirror's copy-mode switch (ticket 45): only rendered when richMirror is on. */
  mirrorCopyMode: boolean
}>()

const emit = defineEmits<{
  'select-tool': [tool: Tool]
  'select-color': [colorId: string]
  undo: []
  'toggle-rotate': []
  copy: []
  'toggle-mirror-axis': [axis: 'horizontal' | 'vertical']
  'set-mirror-axis-count': [axis: 'columns' | 'rows', count: number]
  'toggle-mirror-copy-mode': []
  'mirror-current': [axis: 'horizontal' | 'vertical']
  'mirror-current-hover': [axis: 'horizontal' | 'vertical' | null]
  'toggle-row-progress': [enabled: boolean]
  'toggle-row-direction': []
  'move-row': [delta: number]
}>()

const { t } = useI18n()

/**
 * Which grid-space axis ('columns'/'rows') the on-screen Left–right and Top–bottom counters each drive, given the
 * Pattern's current view-only rotation (see Pattern.rotated / PatternCanvas.vue): rotating swaps the two, the same
 * relabeling PatternCanvas already does for width/height, never a transform of the counts or grid data themselves.
 */
const leftRightAxis = computed<'columns' | 'rows'>(() => (props.pattern.rotated ? 'rows' : 'columns'))
const topBottomAxis = computed<'columns' | 'rows'>(() => (props.pattern.rotated ? 'columns' : 'rows'))

const leftRightCount = computed(() => props.mirrorAxisCounts[leftRightAxis.value])
const topBottomCount = computed(() => props.mirrorAxisCounts[topBottomAxis.value])

const leftRightMax = computed(() =>
  maxAxisCount(props.pattern.rotated ? props.pattern.rows : props.pattern.columns),
)
const topBottomMax = computed(() =>
  maxAxisCount(props.pattern.rotated ? props.pattern.columns : props.pattern.rows),
)
</script>

<template>
  <div class="toolbox" data-testid="toolbox">
    <ToolGroup :title="t.toolbox.groups.tools" data-testid="tool-group-tools">
      <button
        type="button"
        class="icon-button"
        data-testid="tool-paint"
        :title="t.tools.paintLabel"
        :aria-label="t.tools.paintLabel"
        :aria-pressed="activeTool === 'paint'"
        :class="{ 'tool-picker__button--selected': activeTool === 'paint' }"
        @click="emit('select-tool', 'paint')"
      >
        <!-- A brush held at an angle, bristles splaying to the low corner. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M17.5 2.5 21.5 6.5 11 17 7 13z" />
          <path d="M7 13 3.5 20.5 11 17" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="tool-fill"
        :title="t.tools.fillLabel"
        :aria-label="t.tools.fillLabel"
        :aria-pressed="activeTool === 'fill'"
        :class="{ 'tool-picker__button--selected': activeTool === 'fill' }"
        @click="emit('select-tool', 'fill')"
      >
        <!-- A tipped paint bucket with a drop coming off it. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10.5 2.5 3.9 9.1a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0l6.6-6.6z" />
          <path d="M20.5 14.5c.9 1.3 1.4 2.2 1.4 2.8a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.5 1.4-2.8z" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="tool-select"
        :title="t.tools.selectLabel"
        :aria-label="t.tools.selectLabel"
        :aria-pressed="activeTool === 'select'"
        :class="{ 'tool-picker__button--selected': activeTool === 'select' }"
        @click="emit('select-tool', 'select')"
      >
        <!-- A dashed rectangle: the marquee this tool drags out. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 8V6a3 3 0 0 1 3-3h2" />
          <path d="M16 3h2a3 3 0 0 1 3 3v2" />
          <path d="M21 16v2a3 3 0 0 1-3 3h-2" />
          <path d="M8 21H6a3 3 0 0 1-3-3v-2" />
          <path d="M11 3h2M11 21h2M3 11v2M21 11v2" />
        </svg>
      </button>
    </ToolGroup>

    <ToolGroup :title="t.toolbox.groups.colors" data-testid="tool-group-colors">
      <PalettePicker :selected-color-id="selectedColorId" @select="(colorId) => emit('select-color', colorId)" />
    </ToolGroup>

    <ToolGroup :title="t.toolbox.groups.edit" data-testid="tool-group-edit">
      <button
        type="button"
        class="icon-button"
        data-testid="undo-button"
        :title="t.palette.undoButton"
        :aria-label="t.palette.undoButton"
        :disabled="!canUndo"
        @click="emit('undo')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7 7 3 11l4 4" />
          <path d="M3 11h11a7 7 0 1 1 -7 7" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="rotate-button"
        :title="t.palette.rotateButton"
        :aria-label="t.palette.rotateButton"
        :aria-pressed="pattern.rotated"
        :class="{ 'tool-picker__button--selected': pattern.rotated }"
        @click="emit('toggle-rotate')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="11" width="13" height="9" rx="1.5" />
          <rect x="9" y="4" width="9" height="13" rx="1.5" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="copy-button"
        :title="t.tools.copyButton"
        :aria-label="t.tools.copyButton"
        :disabled="!canCopy"
        @click="emit('copy')"
      >
        <!-- One sheet laid over a second: the duplicate the Selection becomes. Only the back sheet's exposed corner is drawn, so it doesn't read as Rotate's two full rectangles. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 8V3H3v13h5" />
        </svg>
      </button>
    </ToolGroup>

    <ToolGroup :title="t.toolbox.groups.mirror" data-testid="tool-group-mirror">
      <template v-if="richMirror">
        <p class="tool-group__full-row mirror-axis-counter" data-testid="mirror-left-right">
          <button
            type="button"
            class="icon-button"
            data-testid="mirror-left-right-decrease"
            :title="t.mirror.decreaseLeftRightButton"
            :aria-label="t.mirror.decreaseLeftRightButton"
            :disabled="leftRightCount === 0"
            @click="emit('set-mirror-axis-count', leftRightAxis, leftRightCount - 1)"
          >
            −
          </button>
          <span class="mirror-axis-counter__label" data-testid="mirror-left-right-value">
            {{ t.mirror.leftRightLabel }}: {{ leftRightCount }}
          </span>
          <button
            type="button"
            class="icon-button"
            data-testid="mirror-left-right-increase"
            :title="t.mirror.increaseLeftRightButton"
            :aria-label="t.mirror.increaseLeftRightButton"
            :disabled="leftRightCount === leftRightMax"
            @click="emit('set-mirror-axis-count', leftRightAxis, leftRightCount + 1)"
          >
            +
          </button>
        </p>
        <p class="tool-group__full-row mirror-axis-counter" data-testid="mirror-top-bottom">
          <button
            type="button"
            class="icon-button"
            data-testid="mirror-top-bottom-decrease"
            :title="t.mirror.decreaseTopBottomButton"
            :aria-label="t.mirror.decreaseTopBottomButton"
            :disabled="topBottomCount === 0"
            @click="emit('set-mirror-axis-count', topBottomAxis, topBottomCount - 1)"
          >
            −
          </button>
          <span class="mirror-axis-counter__label" data-testid="mirror-top-bottom-value">
            {{ t.mirror.topBottomLabel }}: {{ topBottomCount }}
          </span>
          <button
            type="button"
            class="icon-button"
            data-testid="mirror-top-bottom-increase"
            :title="t.mirror.increaseTopBottomButton"
            :aria-label="t.mirror.increaseTopBottomButton"
            :disabled="topBottomCount === topBottomMax"
            @click="emit('set-mirror-axis-count', topBottomAxis, topBottomCount + 1)"
          >
            +
          </button>
        </p>
        <button
          type="button"
          class="icon-button"
          data-testid="mirror-copy-mode"
          :title="t.mirror.copyModeLabel"
          :aria-label="t.mirror.copyModeLabel"
          :aria-pressed="mirrorCopyMode"
          :class="{ 'tool-picker__button--selected': mirrorCopyMode }"
          @click="emit('toggle-mirror-copy-mode')"
        >
          <!-- Three identical rectangles in a row: this switch makes every strip repeat the same way round (A | A | A) instead of mirror-imaging. -->
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="2" y="8" width="5" height="8" rx="1" />
            <rect x="9.5" y="8" width="5" height="8" rx="1" />
            <rect x="17" y="8" width="5" height="8" rx="1" />
          </svg>
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          class="icon-button"
          data-testid="mirror-horizontal"
          :title="t.mirror.horizontalLabel"
          :aria-label="t.mirror.horizontalLabel"
          :aria-pressed="mirrorAxes.horizontal"
          :class="{ 'tool-picker__button--selected': mirrorAxes.horizontal }"
          @click="emit('toggle-mirror-axis', 'horizontal')"
        >
          <!-- A bead and the counterpart a live-mirrored stroke also paints, either side of this axis. The one-time "Mirror current" icons below use arrows instead, since they move content rather than doubling it. -->
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 3v3M12 10.5v3M12 18v3" />
            <rect x="2.5" y="8.5" width="7" height="7" rx="1.5" />
            <rect x="14.5" y="8.5" width="7" height="7" rx="1.5" />
          </svg>
        </button>
        <button
          type="button"
          class="icon-button"
          data-testid="mirror-vertical"
          :title="t.mirror.verticalLabel"
          :aria-label="t.mirror.verticalLabel"
          :aria-pressed="mirrorAxes.vertical"
          :class="{ 'tool-picker__button--selected': mirrorAxes.vertical }"
          @click="emit('toggle-mirror-axis', 'vertical')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M3 12h3M10.5 12h3M18 12h3" />
            <rect x="8.5" y="2.5" width="7" height="7" rx="1.5" />
            <rect x="8.5" y="14.5" width="7" height="7" rx="1.5" />
          </svg>
        </button>
      </template>
      <button
        type="button"
        class="icon-button"
        data-testid="mirror-current-horizontal"
        :title="t.mirror.mirrorCurrentHorizontalButton"
        :aria-label="t.mirror.mirrorCurrentHorizontalButton"
        @click="emit('mirror-current', 'horizontal')"
        @mouseenter="emit('mirror-current-hover', 'horizontal')"
        @mouseleave="emit('mirror-current-hover', null)"
      >
        <!-- Two shapes facing away from a dashed vertical axis: the left-right flip this button performs. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3v3M12 10.5v3M12 18v3" />
          <path d="M8.5 7 3.5 12l5 5z" />
          <path d="M15.5 7l5 5-5 5z" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="mirror-current-vertical"
        :title="t.mirror.mirrorCurrentVerticalButton"
        :aria-label="t.mirror.mirrorCurrentVerticalButton"
        @click="emit('mirror-current', 'vertical')"
        @mouseenter="emit('mirror-current-hover', 'vertical')"
        @mouseleave="emit('mirror-current-hover', null)"
      >
        <!-- The same glyph turned a quarter turn: a dashed horizontal axis with the shapes above and below it. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 12h3M10.5 12h3M18 12h3" />
          <path d="M7 8.5 12 3.5l5 5z" />
          <path d="M7 15.5 12 20.5l5-5z" />
        </svg>
      </button>
    </ToolGroup>

    <ToolGroup
      :title="t.toolbox.groups.rowProgress"
      class="tool-group--row-progress"
      data-testid="tool-group-row-progress"
    >
      <button
        type="button"
        class="icon-button"
        data-testid="row-progress-enabled"
        :title="t.rowProgress.enabledLabel"
        :aria-label="t.rowProgress.enabledLabel"
        :aria-pressed="pattern.rowProgress.enabled"
        :class="{ 'tool-picker__button--selected': pattern.rowProgress.enabled }"
        @click="emit('toggle-row-progress', !pattern.rowProgress.enabled)"
      >
        <!-- Rows of weaving with the current one boxed: the overlay this toggles on. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 5.5h18" />
          <rect x="3" y="9.5" width="18" height="5" rx="1.5" />
          <path d="M3 18.5h18" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="row-progress-direction"
        :title="t.rowProgress.directionButton"
        :aria-label="t.rowProgress.directionButton"
        :aria-pressed="pattern.rowProgress.direction === 'columns'"
        :class="{ 'tool-picker__button--selected': pattern.rowProgress.direction === 'columns' }"
        @click="emit('toggle-row-direction')"
      >
        <!-- A row lying across and a row standing upright, with a quarter-turn arrow from one to the other. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="3" y="3" width="11" height="5" rx="1.5" />
          <rect x="16" y="10" width="5" height="11" rx="1.5" />
          <path d="M6 11.5v1.5a4 4 0 0 0 4 4h2.5" />
          <path d="M10.5 14.5 13 17l-2.5 2.5" />
        </svg>
      </button>
      <p class="row-progress__position tool-group__full-row" data-testid="row-progress-position">
        {{ t.rowProgress.positionLabel }}
        {{ rowProgressPosition(pattern).current + 1 }} / {{ rowProgressPosition(pattern).total }}
      </p>
      <button
        type="button"
        class="icon-button"
        data-testid="row-progress-previous"
        :title="t.rowProgress.previousButton"
        :aria-label="t.rowProgress.previousButton"
        :disabled="!pattern.rowProgress.enabled || rowProgressPosition(pattern).current === 0"
        @click="emit('move-row', -1)"
      >
        <!-- Rows are woven top to bottom, so stepping back up the Pattern is a plain up arrow. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 20V5" />
          <path d="M5.5 11.5 12 5l6.5 6.5" />
        </svg>
      </button>
      <button
        type="button"
        class="icon-button"
        data-testid="row-progress-next"
        :title="t.rowProgress.nextButton"
        :aria-label="t.rowProgress.nextButton"
        :disabled="
          !pattern.rowProgress.enabled || rowProgressPosition(pattern).current === rowProgressPosition(pattern).total - 1
        "
        @click="emit('move-row', 1)"
      >
        <!-- A tick, not a down arrow: what this button means is "this row is woven", and advancing is the consequence. -->
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 13l5.5 5.5L20 6" />
        </svg>
      </button>
    </ToolGroup>
  </div>
</template>

<style scoped>
/* The default button is already wedgewood, so the selected tool/state reads as ink-on-paper instead. */
.tool-picker__button--selected,
.tool-picker__button--selected:hover:not(:disabled) {
  background: var(--color-ink);
  color: var(--color-paper);
}

/*
 * The Toolbox (CONTEXT.md): the strip of Tool groups above the canvas, on a dot-grid notepad-paper texture. The
 * dots are a muted tint of --color-ink, derived with color-mix rather than a new token — a decorative texture, not
 * a palette addition (ticket 20's "no new tokens" constraint is about the header boxes, not this).
 */
.toolbox {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  background-color: var(--color-paper-solid);
  background-image: radial-gradient(color-mix(in srgb, var(--color-ink) 15%, transparent) 1.5px, transparent 1.5px);
  background-size: 16px 16px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-lg);
}

/*
 * Each Tool group sizes to its own content (ToolGroup.vue: flex: 0 0 auto) rather than stretching to fill the row —
 * a three-control group like Edit stays narrow, while Colors, with a dozen swatches, is wide (ticket 40).
 *
 * :deep() reaches into PalettePicker's own root, which normally lays its swatches out with its own flex-wrap.
 * display:contents removes that box so the 12 swatches become direct children of the Colors group's own
 * .tool-group__grid instead, wrapping at the same 7-per-row the rest of the Toolbox uses. Trade-off: this can drop
 * PalettePicker's own role="group"/aria-label from the accessibility tree in engines that don't preserve ARIA
 * semantics through display:contents — each swatch still names itself individually, and the Colors group itself is
 * still named via ToolGroup's aria-labelledby, so nothing becomes unreachable, just less specifically grouped.
 */
.toolbox :deep(.palette-picker) {
  display: contents;
}

/*
 * Row progress always stays visually together: the toggles, the readout and the steps read as one control cluster,
 * so unlike the rest of the Toolbox this group doesn't shrink into itself on a narrow window — it claims its whole
 * content width, and when the Toolbox runs short of room it moves the whole group to its next line instead
 * (ticket 32's original reasoning, preserved through the ticket 40 reorg).
 */
.tool-group--row-progress {
  flex-basis: max-content;
}

.row-progress__position {
  margin: 0;
  white-space: nowrap;
  /* Same-width digits, so stepping from row 9 to 10 doesn't nudge the steps sideways. */
  font-variant-numeric: tabular-nums;
}

/* Rich Mirror's per-direction axis counters (ticket 44): each takes its own full row (tool-group__full-row), decrease/value/increase laid out the same way ZoomControls does. */
.mirror-axis-counter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.mirror-axis-counter__label {
  min-width: 9em;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
