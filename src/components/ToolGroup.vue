<script setup lang="ts">
import { Comment, computed, normalizeClass, ref, useId, useSlots, type VNode } from 'vue'

defineProps<{ title: string }>()

/** Unique per instance so several Tool groups on one page never share an id (ticket 40). */
const titleId = useId()

/** At most this many controls show while collapsed — two rows of seven (CONTEXT.md's Tool group entry, ticket 40). */
const MAX_VISIBLE_CONTROLS = 14

const slots = useSlots()

/**
 * Splits the slot's own vnodes into what always shows (base, at most 14 normal controls) and what only shows while
 * expanded (overflow) — ticket 41. Splitting the slot itself, rather than hiding the extra controls in place, keeps
 * the base grid's own box completely unaffected by expand state: its width and row count never change, so it can
 * anchor a plain position:absolute overlay for the overflow (see .tool-group__overflow below) without the usual
 * "an absolutely positioned box stops contributing to its ancestor's size" fight — the overlay just reads the
 * base's own stable width straight back via left/right:0.
 *
 * A control marked .tool-group__full-row (a text/numeric readout, e.g. Row progress's position readout) doesn't
 * count toward the 14-slot cap, matching .tool-group__grid's own contract below — it stays in the base group
 * wherever it falls in slot order. No current group combines that with more than 14 normal controls, so there's
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
      <component :is="() => split.base" />
    </div>
    <span v-if="overflows" class="tool-group__chevron" aria-hidden="true" data-testid="tool-group-chevron">
      <!-- A simple downward chevron: "there's more below," not a "+N" count (2026-09-16 decision). -->
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M5 9l7 7 7-7" />
      </svg>
    </span>
    <div v-if="expanded" class="tool-group__overflow" data-testid="tool-group-overflow">
      <component :is="() => split.overflow" />
    </div>
  </section>
</template>

<style scoped>
/*
 * One titled box in the Toolbox (CONTEXT.md's Tool group). Sizes to its own content rather than stretching to fill
 * the row — a three-control group like Edit stays narrow, while Colors, with a dozen swatches, is wide — so this
 * neither grows nor shrinks in the Toolbox's flex row (see Toolbox.vue's .toolbox).
 *
 * position:relative anchors .tool-group__overflow (ticket 41), which overlays downward from this box's own bottom
 * edge without this box itself ever changing size — see the `split` computed above for why that matters.
 */
.tool-group {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 12px 10px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-md);
}

.tool-group__title {
  margin: 0;
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-ink);
  opacity: 0.55;
}

/*
 * Controls flow left to right, at most 7 per row (ticket 40): a fixed 7-column template, sized to each column's own
 * content, so an under-full group (e.g. 3 controls) collapses the unused columns to nothing rather than stretching.
 * A control marked .tool-group__full-row (a text/numeric readout) spans every column, forcing its own row without
 * counting toward the two-row/14-slot cap — grid auto-placement resumes normal controls on a fresh row after it.
 *
 * This only ever holds the first 14 (the `split` computed's "base") — a group with more shows the rest in
 * .tool-group__overflow below instead, expanding in place on hover (ticket 41).
 */
.tool-group__grid {
  display: grid;
  grid-template-columns: repeat(7, min-content);
  gap: 8px;
  align-items: center;
}

/*
 * The expand indicator (ticket 41's chevron/hover-expand affordance): a small downward chevron centered on the
 * group's own bottom border, in a paper-colored disc so it reads clearly against the canvas's dot-grid texture
 * behind it. Purely a signal, not a control of its own — hovering anywhere in the group expands it, not just this
 * icon — so it takes no pointer events and isn't in the tab order.
 */
.tool-group__chevron {
  position: absolute;
  bottom: 0;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  translate: -50% 50%;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-pill);
  pointer-events: none;
}

.tool-group__chevron svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: var(--color-ink);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Nothing left to hint at once the group is already open. */
.tool-group--expanded .tool-group__chevron {
  visibility: hidden;
}

/*
 * The overflow controls (ticket 41's 15th-and-later controls): the group's own box extending downward in place,
 * per the 2026-09-16 decision — not a separate dropdown/popup, so it repeats .tool-group's own background/border/
 * radius/grid and sits flush against its bottom edge (the negative margin overlaps rather than doubles the shared
 * border) rather than floating apart from it. position:absolute keeps it from contributing to .tool-group's own
 * flow height, so expanding overlays whatever is below (the canvas) instead of pushing it down — see the `split`
 * computed above for why .tool-group's width stays correct regardless.
 */
.tool-group__overflow {
  position: absolute;
  z-index: 1;
  top: 100%;
  left: -1px;
  right: -1px;
  margin-top: calc(-1 * var(--border-width));
  display: grid;
  grid-template-columns: repeat(7, min-content);
  gap: 8px;
  align-items: center;
  padding: 8px 12px 10px;
  background: var(--color-paper-solid);
  border: var(--border-width) solid var(--color-ink);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
}
</style>
