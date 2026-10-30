<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, reactive, ref, watch } from 'vue'
import { cardPlacement, tagOrigin, tagPlacement, threadPath, type SchemaAnchor, type SchemaAnchors } from '../../composables/canvas/schemaTagPlacement'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { Rect } from '../../domain/canvas'
import { fillBlanks } from '../../domain/fillBlanks'
import { frameAllows } from '../../domain/frameShape'
import type { GridPosition } from '../../domain/grid'
import { frameOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { formatSizeInMm } from '../../domain/projectSize'
import { nameFitsTag, schemaDetails } from '../../domain/schemaTags'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'

// Each unframed Schema's name as a hang tag from its Piece's corner (SchemaTag card, ticket 0721): page markup over the
// canvas, in screen px at every zoom, placed from the boxes the surface reports. A tag opens into a paper tag with the
// Schema's details, Rename and Frame; one at a time. The tags are one Tab stop, stepped by the arrows in reading order.
const props = defineProps<{
  project: Project
  /** The unframed Schemas' boxes on the canvas box, as the surface reports them. */
  anchors: SchemaAnchors
}>()

const emit = defineEmits<{
  /** Rename: Name Piece's editor, for the Schema holding this bead. */
  rename: [at: GridPosition]
  /** Frame: the Frame set to this Schema's rectangle, as the Selection bar's Frame does. */
  frame: [piece: Rect]
}>()

const { t, locale } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const actions = { rename: controlAction('rename-schema'), frame: controlAction('frame-schema'), close: controlAction('close') }
/** The most beads a paper tag shows a swatch for. */
const SWATCHES_SHOWN = 5

const keyOf = ({ anchor }: Pick<SchemaAnchor, 'anchor'>) => `${anchor.row}:${anchor.column}`

/** Each tag's width as laid out, measured after it renders: whether it has room to hang right follows from it. */
const widths = reactive<Record<string, number>>({})
const groupEl = ref<HTMLElement>()
const cardEl = ref<HTMLElement>()
const cardHeight = ref(0)
function measure() {
  for (const tag of groupEl.value?.querySelectorAll<HTMLElement>('.schema-tag') ?? []) {
    const key = tag.dataset.key!
    if (widths[key] !== tag.offsetWidth) widths[key] = tag.offsetWidth
  }
  const height = cardEl.value?.offsetHeight ?? 0
  if (height !== cardHeight.value) cardHeight.value = height
}
onMounted(measure)
onUpdated(measure)

/** The tags in view, in reading order: top to bottom, then left to right, by the Piece's corner. */
const tags = computed(() =>
  props.anchors.schemas
    .flatMap((schema) => {
      const key = keyOf(schema)
      const placed = tagPlacement(schema.box, props.anchors.viewport, widths[key] ?? 0)
      return placed ? [{ ...schema, key, placed, fits: nameFitsTag(schema.name) }] : []
    })
    .sort((a, b) => a.placed.corner.y - b.placed.corner.y || a.placed.corner.x - b.placed.corner.x),
)

/** The Schema whose paper tag is open, followed by the bead its name is kept on or, should that bead go, its name. */
const opened = ref<{ anchor: GridPosition; name: string }>()
const openSchema = computed(() => props.anchors.schemas.find((schema) => opened.value && keyOf(schema) === keyOf(opened.value)))
// It follows a rename, and its name to a bead no Schema stood on before (an erased name bead moves the name within the
// Piece); it closes once its Schema is framed, erased or unnamed.
watch(
  () => props.anchors.schemas,
  (schemas, before) => {
    const open = opened.value
    if (!open) return
    const same = schemas.find((schema) => keyOf(schema) === keyOf(open))
    const moved = schemas.filter((schema) => schema.name === open.name && !before.some((was) => keyOf(was) === keyOf(schema)))
    const followed = same ?? (moved.length === 1 ? moved[0] : undefined)
    opened.value = followed && { anchor: followed.anchor, name: followed.name }
  },
)

const openTag = computed(() => tags.value.find((tag) => tag.key === (openSchema.value && keyOf(openSchema.value))))
const card = computed(() => {
  const tag = openTag.value
  const details = tag && schemaDetails(props.project, tag.anchor)
  if (!tag || !details) return undefined
  const at = cardPlacement(tag.placed, tag.box, props.anchors.viewport, cardHeight.value)
  const size = fillBlanks(t.value.schemaTag.sizeBeads, { columns: details.columns, rows: details.rows })
  const estimate = details.sizeMm && formatSizeInMm(details.sizeMm, t.value.form.unitMm, locale.value)
  return {
    ...tag,
    at,
    size: estimate ? `${size} · ≈ ${estimate}` : size,
    counts: `${plural(locale.value, details.beads, t.value.schemaTag.beads)} · ${plural(locale.value, details.colors.length, t.value.schemaTag.colors)}`,
    swatches: details.colors.slice(0, SWATCHES_SHOWN),
  }
})
/** Frame is the Selection bar's: not offered for a Custom frame, whose Frame shape sets its outline (ticket 0592). */
const framable = computed(() => frameAllows(frameOf(props.project), 'from-selection'))

function open(tag: SchemaAnchor) {
  opened.value = { anchor: tag.anchor, name: tag.name }
  void nextTick(() => cardEl.value?.focus())
}

/** Closes the paper tag; focus goes back to its tag unless a press elsewhere closed it. */
function close(refocus: boolean) {
  const key = openTag.value?.key
  opened.value = undefined
  if (refocus && key) void nextTick(() => groupEl.value?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus())
}

// A non-modal layer: Escape closes it, and a press outside closes it and still does what it does there (on the canvas,
// the tool's work).
useOverlayLayer({ isOpen: () => !!card.value, root: () => cardEl.value, close: () => close(true), onOutsidePress: () => close(false), outside: 'through' })

const roving = useRovingFocus(groupEl, { selector: '.schema-tag', managesTabIndex: true })

function tagStyle({ key, placed }: (typeof tags.value)[number]) {
  const { left, top } = tagOrigin(placed, widths[key] ?? 0)
  return { left: `${left}px`, top: `${top}px` }
}
const threads = computed(() =>
  tags.value
    .filter((tag) => tag.key !== card.value?.key)
    .map((tag) => ({ key: tag.key, corner: tag.placed.corner, d: threadPath(tag.placed.corner, tag.placed.hole, tag.placed.side) }))
    .concat(card.value ? [{ key: card.value.key, corner: card.value.placed.corner, d: threadPath(card.value.placed.corner, card.value.at.hole, card.value.placed.side) }] : []),
)
</script>

<template>
  <div class="schema-tags" data-testid="schema-tags">
    <svg class="schema-tags__threads" :width="anchors.viewport.width" :height="anchors.viewport.height" aria-hidden="true">
      <g v-for="thread in threads" :key="thread.key">
        <path :d="thread.d" />
        <circle :cx="thread.corner.x" :cy="thread.corner.y" r="1.6" />
      </g>
    </svg>
    <div ref="groupEl" class="schema-tags__group" role="group" :aria-label="t.schemaTag.group" @keydown="roving.onKeydown" @focusin="roving.onFocusin">
      <component
        :is="tag.fits ? 'span' : AppTooltip"
        v-for="tag in tags"
        v-show="tag.key !== card?.key"
        :key="tag.key"
        class="schema-tags__hang"
        :style="tagStyle(tag)"
        v-bind="tag.fits ? {} : { name: tag.name, body: t.schemaTag.tooltipBody, announce: false }"
      >
        <button
          type="button"
          class="schema-tag"
          :class="{ 'schema-tag--left': tag.placed.side === 'left' }"
          :data-key="tag.key"
          :aria-label="fillBlanks(t.schemaTag.label, { name: tag.name })"
          :aria-expanded="tag.key === card?.key"
          data-testid="schema-tag"
          @click="open(tag)"
        >
          <span class="schema-tag__shape" :class="{ 'schema-tag__shape--dots': !tag.fits, 'schema-tag__shape--left': tag.placed.side === 'left' }">
            <template v-if="tag.fits">{{ tag.name }}</template>
            <template v-else><i /><i /><i /></template>
          </span>
        </button>
      </component>
    </div>
    <div
      v-if="card"
      ref="cardEl"
      class="schema-card"
      :style="{ left: `${card.at.left}px`, top: `${card.at.top}px` }"
      role="dialog"
      :aria-label="card.name"
      tabindex="-1"
      data-testid="schema-card"
    >
      <div class="schema-card__paper">
        <span class="schema-card__label">{{ t.schemaTag.heading }}</span>
        <p class="schema-card__name">{{ card.name }}</p>
        <div class="schema-card__meta">
          <span data-testid="schema-card-size">{{ card.size }}</span>
          <span data-testid="schema-card-counts">
            <span class="schema-card__swatches" aria-hidden="true"><i v-for="hex in card.swatches" :key="hex" :style="{ background: hex }" /></span>{{ card.counts }}
          </span>
        </div>
        <div class="schema-card__actions">
          <AppButton size="sm" :action="actions.rename" data-testid="schema-card-rename" @click="emit('rename', card.anchor)" />
          <AppButton v-if="framable" variant="primary" size="sm" :action="actions.frame" :deps="deps" data-testid="schema-card-frame" @click="emit('frame', card.piece)" />
          <span class="schema-card__close"><IconButton variant="plain" :action="actions.close" data-testid="schema-card-close" @click="close(true)" /></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The canvas box's own px, taking no pointer itself: only a tag and the paper tag do. Over the beads, under the Tool
 * pill (later in the page at the same level) and the Selection bar (StackingOrder card). */
.schema-tags {
  position: absolute;
  inset: 0;
  z-index: var(--z-canvas-overlay);
  overflow: hidden;
  pointer-events: none;
}

.schema-tags__threads {
  position: absolute;
  inset: 0;
  overflow: visible;
  fill: none;
  stroke: var(--muted);
  stroke-width: 1px;
}

.schema-tags__threads circle {
  fill: var(--ink);
  stroke: none;
}

:root[data-theme='contrast'] .schema-tags__threads {
  stroke: var(--ink);
}

.schema-tags__hang {
  position: absolute;
  display: block;
}

/* The press target: the tag's own box, turned about its hole; the shape inside is cut and holed, so the focus ring
 * and a finger's larger hit area belong to the button round it. */
.schema-tag {
  position: relative;
  display: block;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  pointer-events: auto;
  transform: rotate(var(--schema-tag-tilt));
  transform-origin: calc(var(--schema-tag-end) / 2 + 0.5px) 50%;
  transition: transform var(--duration-fast) var(--ease-out);
}

/* Hanging left, the tag is mirrored, turned about its hole at the right end: it reaches out from the Piece and droops
 * as one hanging right does. */
.schema-tag--left {
  transform: rotate(calc(var(--schema-tag-tilt) * -1));
  transform-origin: calc(100% - var(--schema-tag-end) / 2 - 0.5px) 50%;
}

.schema-tag:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}

.schema-tag__shape {
  display: inline-flex;
  align-items: center;
  height: var(--schema-tag-height);
  box-sizing: border-box;
  padding: 0 var(--space-8) 0 calc(var(--schema-tag-end) + 3px);
  border-radius: 0 var(--radius-xs) var(--radius-xs) 0;
  background: var(--ink);
  color: var(--canvas);
  font: var(--schema-tag-name);
  white-space: nowrap;
  transition: background-color var(--duration-fast) var(--ease-out);
  clip-path: polygon(6px 0, 100% 0, 100% 100%, 6px 100%, 0 16px, 0 6px);
  -webkit-mask: radial-gradient(circle calc(var(--schema-tag-hole) / 2) at calc(var(--schema-tag-end) / 2 + 0.5px) 50%, transparent 98%, #000 100%);
  mask: radial-gradient(circle calc(var(--schema-tag-hole) / 2) at calc(var(--schema-tag-end) / 2 + 0.5px) 50%, transparent 98%, #000 100%);
}

.schema-tag__shape--left {
  padding: 0 calc(var(--schema-tag-end) + 3px) 0 var(--space-8);
  border-radius: var(--radius-xs) 0 0 var(--radius-xs);
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 16px, calc(100% - 6px) 100%, 0 100%);
  -webkit-mask: radial-gradient(circle calc(var(--schema-tag-hole) / 2) at calc(100% - var(--schema-tag-end) / 2 - 0.5px) 50%, transparent 98%, #000 100%);
  mask: radial-gradient(circle calc(var(--schema-tag-hole) / 2) at calc(100% - var(--schema-tag-end) / 2 - 0.5px) 50%, transparent 98%, #000 100%);
}

.schema-tag__shape--dots {
  gap: var(--space-2);
  padding-right: 7px;
}

.schema-tag__shape--dots.schema-tag__shape--left {
  padding: 0 calc(var(--schema-tag-end) + 3px) 0 7px;
}

.schema-tag__shape--dots > i {
  width: 3px;
  height: 3px;
  border-radius: var(--radius-full);
  background: currentColor;
}

@media (hover: hover) {
  .schema-tag:hover {
    transform: none;
  }

  .schema-tag:hover .schema-tag__shape {
    background: var(--body);
  }
}

/* A finger's hit area: at least a touch target, centred on the tag. */
@media (pointer: coarse) {
  .schema-tag::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: max(100%, var(--touch-target));
    height: var(--touch-target);
    transform: translate(-50%, -50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .schema-tag,
  .schema-tag__shape {
    transition: none;
  }
}

/* The paper tag: the outer layer is its edge, the inner one the paper, both cut at the top-right and holed. */
.schema-card {
  position: absolute;
  width: var(--schema-card-width);
  box-sizing: border-box;
  padding: 1px;
  background: var(--line-strong);
  border-radius: var(--radius-lg);
  pointer-events: auto;
  outline: none;
  clip-path: polygon(0 0, calc(100% - var(--schema-card-cut)) 0, 100% var(--schema-card-cut), 100% 100%, 0 100%);
  -webkit-mask: radial-gradient(circle calc(var(--schema-card-hole) / 2) at calc(100% - 18px) 18px, transparent 98%, #000 100%);
  mask: radial-gradient(circle calc(var(--schema-card-hole) / 2) at calc(100% - 18px) 18px, transparent 98%, #000 100%);
}

:root[data-theme='contrast'] .schema-card {
  padding: var(--border-emphasis);
}

.schema-card__paper {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-height: var(--schema-card-min-height);
  box-sizing: border-box;
  /* The card's 12 14 14, less the 1px edge round it. */
  padding: calc(var(--space-12) - 1px) calc(var(--space-14) - 1px) calc(var(--space-14) - 1px);
  background: var(--elevated);
  border-radius: calc(var(--radius-lg) - 1px);
  clip-path: polygon(0 0, calc(100% - var(--schema-card-cut) + 0.4px) 0, 100% calc(var(--schema-card-cut) - 0.4px), 100% 100%, 0 100%);
  -webkit-mask: radial-gradient(circle calc(var(--schema-card-hole) / 2 + 1px) at calc(100% - 17px) 17px, transparent 98%, #000 100%);
  mask: radial-gradient(circle calc(var(--schema-card-hole) / 2 + 1px) at calc(100% - 17px) 17px, transparent 98%, #000 100%);
}

.schema-card__label {
  font: var(--type-meta-tiny);
  color: var(--muted);
  text-transform: lowercase;
}

.schema-card__name {
  display: -webkit-box;
  margin: 0;
  padding-right: var(--schema-card-name-inset);
  overflow: hidden;
  font: var(--schema-card-name);
  color: var(--ink);
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.schema-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font: var(--type-meta-small);
  color: var(--muted);
}

.schema-card__swatches {
  display: inline-flex;
  margin-right: var(--space-6);
  vertical-align: -1px;
}

.schema-card__swatches > i {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-xs);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.schema-card__swatches > i + i {
  margin-left: -4px;
}

.schema-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-8);
  margin-top: auto;
}

/* The Buttons at 28px, tight enough for Rename, Frame and Close on one row; a longer language wraps Close. */
.schema-card__actions :deep(.app-button) {
  gap: var(--space-4);
  height: var(--control-height-small);
  padding: 0 var(--space-8);
}

.schema-card__actions :deep(.icon-btn) {
  width: var(--control-height-small);
  height: var(--control-height-small);
  color: var(--muted);
}

.schema-card__close {
  margin-left: auto;
}
</style>
