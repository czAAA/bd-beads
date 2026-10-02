<script setup lang="ts">
import { Comment, computed, normalizeClass, ref, useId, useSlots, type VNode } from 'vue'

defineProps<{ title: string }>()

/** Unique per instance so several Tool groups on one page never share an id (ticket 40). */
const titleId = useId()

/**
 * At most this many controls show while collapsed — four rows of four, the rail's own column count (CONTEXT.md's Tool
 * group entry, ticket 114; it was two rows of seven above the canvas, ticket 40). No group reaches it today (the
 * largest, Colors, has thirteen), which is deliberate: the rail is a vertical column with room to grow downward, and
 * hover-expansion is no way to reach the Palette on a touch screen, so the cap is a safety net for a future group rather
 * than a squeeze on the current ones.
 */
const MAX_VISIBLE_CONTROLS = 16

const slots = useSlots()

/**
 * Splits the slot's own vnodes into what always shows (base, at most 16 normal controls) and what only shows while
 * expanded (overflow) — ticket 41. Splitting the slot itself, rather than hiding the extra controls in place, keeps
 * the base grid's own box completely unaffected by expand state: its width and row count never change, so it can
 * anchor a plain position:absolute overlay for the overflow (see .tool-group__overflow below) without the usual
 * "an absolutely positioned box stops contributing to its ancestor's size" fight — the overlay just reads the
 * base's own stable width straight back via left/right:0.
 *
 * A control marked .tool-group__full-row (a text/numeric readout, e.g. Row progress's position readout) doesn't
 * count toward the 16-slot cap, matching .tool-group__grid's own contract below — it stays in the base group
 * wherever it falls in slot order. No current group combines that with more than 16 normal controls, so there's
 * nothing to verify about the two together yet.
 */
const split = computed(() => {
  const base: VNode[] = []
  const overflow: VNode[] = []
  let normalSeen = 0

  for (const node of slots.default?.() ?? []) {
    if (node.type === Comment) continue // v-if="false" branches etc. render as comments — nothing to show or count

    const isFullRow = normalizeClass(node.props?.class).split(/\s+/).includes('tool-group__full-row')
    if (!isFullRow) {
      normalSeen++
    }
    ;(isFullRow || normalSeen <= MAX_VISIBLE_CONTROLS ? base : overflow).push(node)
  }

  return { base, overflow }
})

/**
 * The two halves as components of their own, made once: an arrow written inline in the template would be a new
 * component on every render, and remount every control in the group each time the group re-renders.
 */
const Base = () => split.value.base
const Overflow = () => split.value.overflow

const overflows = computed(() => split.value.overflow.length > 0)
const expanded = ref(false)

/** Hovering only ever expands a group that actually has more to show (ticket 41's first acceptance line). */
function onMouseEnter() {
  if (overflows.value) {
    expanded.value = true
  }
}

function onMouseLeave() {
  expanded.value = false
}

/**
 * Force-collapses regardless of hover, for Escape: App.vue's onKeyDown asks every Tool group to collapse (via
 * Toolbox's collapseExpandedGroup) before it runs its own Paste-cancel/Selection-clear precedence, so an expanded
 * group swallows the first Escape and only a second one reaches Select, as ticket 41 requires. Returns whether this
 * group actually was expanded, so the caller knows whether it "used up" that Escape press.
 */
function collapse(): boolean {
  const was = expanded.value
  expanded.value = false
  return was
}

defineExpose({ expanded, collapse })
</script>

<template>
  <section
    class="tool-group"
    :class="{ 'tool-group--expanded': expanded }"
    :aria-labelledby="titleId"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <p :id="titleId" class="tool-group__title">{{ title }}</p>
    <div class="tool-group__grid">
      <component :is="Base" />
    </div>
    <span v-if="overflows" class="tool-group__chevron" aria-hidden="true" data-testid="tool-group-chevron">
      <!-- A simple downward chevron: "there's more below," not a "+N" count (2026-09-16 decision). -->
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M5 9l7 7 7-7" />
      </svg>
    </span>
    <div v-if="expanded" class="tool-group__overflow" data-testid="tool-group-overflow">
      <component :is="Overflow" />
    </div>
  </section>
</template>

<style scoped>
/* A Tool group (Toolbox card): a label, 8px above its controls, and no box of its own; the Toolbox is the box. */
.tool-group {
  position: relative;
  display: flex;
  flex-direction: column;
}

.tool-group__title {
  margin: 0 0 var(--space-8);
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.tool-group__grid {
  display: flex;
  flex-direction: column;
}

.tool-group__chevron {
  position: absolute;
  top: 0;
  right: 0;
  color: var(--muted);
}

.tool-group__chevron svg {
  width: var(--space-16);
  height: var(--space-16);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tool-group__overflow {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin-top: var(--space-6);
}
</style>
