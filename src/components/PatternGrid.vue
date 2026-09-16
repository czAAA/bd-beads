<script setup lang="ts">
import { computed } from 'vue'
import { CELL_SIZE_PX, positionKey, rowHeightPx, rowOffsetPx, type PreviewCell } from '../domain/grid'
import type { Pattern } from '../domain/pattern'
import { isWithinSelection, type Selection } from '../domain/selection'

const emit = defineEmits<{
  'cell-primary-down': [row: number, column: number]
  'cell-primary-move': [row: number, column: number]
  'cell-secondary-down': [row: number, column: number]
  'cell-secondary-move': [row: number, column: number]
  'cell-hover': [row: number, column: number]
  'hover-end': []
}>()

const props = defineProps<{
  pattern: Pattern
  /** Cells to show a hover preview on (ticket 23): the hovered cell plus its live-mirror counterpart(s), or a whole copied block under the cursor (ticket 31). */
  previewCells?: PreviewCell[]
  /** The color to preview, faintly, on previewCells that don't carry one of their own; null for a neutral outline when no Palette color is selected. */
  previewColor?: string | null
  /** The rectangle the Select tool has marked out, drawn as a marquee over those cells (ticket 31). */
  selection?: Selection
}>()

/** Position key -> that cell's own preview color, if it has one; a block pasted from the clipboard previews in its real colors rather than one flat color. */
const previewColors = computed(
  () => new Map((props.previewCells ?? []).map((cell) => [positionKey(cell), cell.color])),
)

function isPreviewCell(row: number, column: number): boolean {
  return previewColors.value.has(positionKey({ row, column }))
}

/** The color to paint this cell's preview overlay in: the cell's own, falling back to the preview-wide color; none when neither is set, which is what the neutral outline stands in for. */
function previewCellColor(row: number, column: number): string | undefined {
  return previewColors.value.get(positionKey({ row, column })) ?? props.previewColor ?? undefined
}

function isSelectedCell(row: number, column: number): boolean {
  return props.selection !== undefined && isWithinSelection(props.selection, { row, column })
}

/**
 * The marquee's outline, as inset box-shadow segments on whichever of a selected cell's four sides sit on the
 * rectangle's boundary — so the selection reads as one rectangle rather than a grid of separately outlined cells.
 * Drawn on the cells themselves rather than as one positioned rectangle because offset techniques shift alternate
 * rows by half a cell (see rowOffsetPx): a single rect would sit half a bead off on every other row.
 */
function selectionEdgeShadow(row: number, column: number): string | undefined {
  const selection = props.selection
  if (!selection || !isSelectedCell(row, column)) {
    return undefined
  }

  const edges = [
    [row === selection.top, '0px 2px'],
    [row === selection.top + selection.rows - 1, '0px -2px'],
    [column === selection.left, '2px 0px'],
    [column === selection.left + selection.columns - 1, '-2px 0px'],
  ] as const

  const segments = edges
    .filter(([onEdge]) => onEdge)
    .map(([, offset]) => `inset ${offset} 0px 0px var(--color-wedgewood)`)

  return segments.length > 0 ? segments.join(', ') : undefined
}

/**
 * Reports the hover for the preview, plus a drag move when a mouse button is held: primary continues a paint/fill
 * stroke (ticket 24), secondary an erase stroke (ticket 25).
 */
function onCellEnter(event: MouseEvent, row: number, column: number) {
  emit('cell-hover', row, column)
  if (event.buttons & 1) {
    emit('cell-primary-move', row, column)
  }
  if (event.buttons & 2) {
    emit('cell-secondary-move', row, column)
  }
}

/** Rows after the first pull up to sit rowHeightPx apart instead of a full cell apart; 0 for techniques that stack at full height. */
function rowOverlapPx(technique: Pattern['technique'], rowIndex: number): number {
  return rowIndex === 0 ? 0 : rowHeightPx(technique) - CELL_SIZE_PX
}

/** How far through the weaving this row is, while the row-progress overlay is on (ticket 13). */
function rowProgressClass(rowIndex: number): string | null {
  const { enabled, currentRow } = props.pattern.rowProgress
  if (!enabled || rowIndex > currentRow) {
    return null
  }
  return rowIndex === currentRow ? 'pattern-grid__row--current' : 'pattern-grid__row--done'
}
</script>

<template>
  <div
    class="pattern-grid"
    :class="`pattern-grid--${pattern.technique}`"
    @mouseleave="emit('hover-end')"
    @contextmenu.prevent
  >
    <div
      v-for="(row, rowIndex) in pattern.grid"
      :key="rowIndex"
      class="pattern-grid__row"
      :class="rowProgressClass(rowIndex)"
      data-testid="grid-row"
      :style="{
        marginLeft: `${rowOffsetPx(pattern.technique, rowIndex)}px`,
        marginTop: `${rowOverlapPx(pattern.technique, rowIndex)}px`,
      }"
    >
      <div
        v-for="(cell, columnIndex) in row"
        :key="columnIndex"
        class="pattern-grid__cell"
        :class="{
          'pattern-grid__cell--preview-neutral':
            isPreviewCell(rowIndex, columnIndex) && !previewCellColor(rowIndex, columnIndex),
          'pattern-grid__cell--selected': isSelectedCell(rowIndex, columnIndex),
        }"
        data-testid="grid-cell"
        :style="{
          width: `${CELL_SIZE_PX}px`,
          height: `${CELL_SIZE_PX}px`,
          backgroundColor: cell.color ?? undefined,
          boxShadow: selectionEdgeShadow(rowIndex, columnIndex),
        }"
        @mousedown.left="emit('cell-primary-down', rowIndex, columnIndex)"
        @mousedown.right="emit('cell-secondary-down', rowIndex, columnIndex)"
        @mouseenter="onCellEnter($event, rowIndex, columnIndex)"
      >
        <span
          v-if="isPreviewCell(rowIndex, columnIndex) && previewCellColor(rowIndex, columnIndex)"
          class="pattern-grid__cell-preview"
          data-testid="cell-preview"
          :style="{ backgroundColor: previewCellColor(rowIndex, columnIndex) }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pattern-grid {
  display: inline-flex;
  flex-direction: column;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pattern-grid__row {
  display: flex;
}

.pattern-grid__cell {
  position: relative;
  box-sizing: border-box;
  border: 1px solid var(--color-paper);
  /*
   * A dimmed grey rather than plain white/paper (ticket 27), so an untouched cell reads as "nothing painted here
   * yet" instead of looking indistinguishable from a blank canvas. Mixed from --color-ink rather than reusing the
   * Palette's own grey swatch (#9aa0a6, domain/palette.ts) — that's a paint color a user can actually pick, and
   * doubling it as the empty-cell indicator would make an intentionally-grey bead invisible from an unpainted one.
   * At full opacity it also stays clearly apart from a finished row's dimming (.pattern-grid__row--done below,
   * opacity 0.35 + grayscale): a done row's cells — painted or still empty — fade well past this tint, so "not yet
   * touched" and "already woven" never look the same.
   */
  background-color: color-mix(in srgb, var(--color-ink) 25%, var(--color-paper-solid));
  cursor: pointer;
}

/* Faint preview of where paint will land (ticket 23): overlaid on top of whatever the cell already holds, purely visual. */
.pattern-grid__cell-preview {
  position: absolute;
  inset: 0;
  opacity: 0.45;
  pointer-events: none;
}

/*
 * A cell inside the Select tool's marquee (ticket 31): washed in the same wedgewood the marquee outline uses. Laid
 * on as a background-image so it tints whatever color the cell already holds, without a second element per cell.
 */
.pattern-grid__cell--selected {
  background-image: linear-gradient(
    color-mix(in srgb, var(--color-wedgewood) 30%, transparent),
    color-mix(in srgb, var(--color-wedgewood) 30%, transparent)
  );
}

/* No Palette color selected: a neutral outline instead of a color preview. */
.pattern-grid__cell--preview-neutral {
  box-shadow: inset 0 0 0 2px var(--color-ink);
}

/* Rows already woven step back so the eye lands on what's left to do. */
.pattern-grid__row--done {
  opacity: 0.35;
  filter: grayscale(1);
}

/* The row being woven now, lifted above its neighbours so its marker isn't buried under an overlapping row. */
.pattern-grid__row--current {
  position: relative;
  z-index: 1;
}

/*
 * The marker is its own layer over the row rather than an outline or an inset shadow: an outline on the first row
 * would be shaved off by .pattern-grid's overflow clipping, and an inset shadow would be painted over by the cells'
 * own opaque backgrounds. It ignores pointer events so the beads underneath stay paintable.
 */
.pattern-grid__row--current::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 3px var(--color-wedgewood);
  pointer-events: none;
}

/* Peyote's interlocking beads read as diamonds/hexes rather than a flat grid. */
.pattern-grid--peyote .pattern-grid__cell {
  border-radius: 30%;
}

/* Brick stitch keeps square cells but reads as coursed masonry via a bolder seam between rows. */
.pattern-grid--brick .pattern-grid__row {
  border-top: 1px solid var(--color-ink);
}

.pattern-grid--brick .pattern-grid__row:first-child {
  border-top: none;
}
</style>
