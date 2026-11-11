<script setup lang="ts">
import { computed } from 'vue'
import { HANDLE_CURSORS, type HandleId } from '../../rendering/frameHandles'

/** One resize handle laid over the page (Handle card, ticket 0867): the hot corner the canvas draws for the Frame, a
 * Selection and the Mirror's Area, here for the converter's crop and the reference image. Its left and top, set by
 * the caller, are the corner or edge middle it stands on; a press within its reach grabs it, where it is drawn. */
const props = withDefaults(
  defineProps<{
    /** Which corner or edge middle it is, as it stands on screen: which way its bracket or bar opens. */
    place: HandleId
    /** Drawn grown on its disc, as the corner under the pointer is: while it is dragged. */
    hot?: boolean
    /** The most its reach may be, in px: a third of the shorter side, so a small rectangle keeps an inside to move. */
    limit?: number
  }>(),
  { hot: false, limit: undefined },
)

/** A quarter turn per corner or edge, clockwise from the top-left bracket and the top bar the CSS draws. */
const TURNS: Record<HandleId, number> = { 'top-left': 0, top: 0, 'top-right': 90, right: 90, 'bottom-right': 180, bottom: 180, 'bottom-left': 270, left: 270 }

const corner = computed(() => props.place.includes('-'))
const style = computed(() => ({
  '--handle-turn': `${TURNS[props.place]}deg`,
  '--handle-limit': props.limit === undefined ? undefined : `${props.limit}px`,
  cursor: HANDLE_CURSORS[props.place],
}))
</script>

<template>
  <button type="button" class="app-handle" :class="[corner ? 'app-handle--corner' : 'app-handle--edge', { 'app-handle--hot': hot }]" :style="style">
    <span class="app-handle__mark" aria-hidden="true" />
  </button>
</template>

<style scoped>
/* The hit area: a circle of the handle's reach round its point (44px on a coarse pointer), the mark drawn in it. */
.app-handle {
  --reach: min(var(--handle-reach), var(--handle-limit, var(--handle-reach)));
  --mark: var(--handle-color, var(--accent));
  position: absolute;
  box-sizing: border-box;
  width: calc(2 * var(--reach));
  height: calc(2 * var(--reach));
  padding: 0;
  background: none;
  border: 0;
  border-radius: var(--radius-full);
  transform: translate(-50%, -50%);
  touch-action: none;
}

@media (pointer: coarse) {
  .app-handle {
    --reach: min(var(--handle-reach-touch), var(--handle-limit, var(--handle-reach-touch)));
  }
}

.app-handle:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* The mark, drawn for the top-left corner or the top edge and turned to its own. */
.app-handle__mark {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transform: rotate(var(--handle-turn));
}

.app-handle__mark::before {
  position: absolute;
  box-sizing: border-box;
  content: '';
}

/* A corner: a bracket of two arms whose outside stands `--handle-offset` off the line, the corner rounded. */
.app-handle--corner .app-handle__mark {
  --arm: var(--handle-arm);
  --line: var(--handle-line);
}

.app-handle--corner .app-handle__mark::before {
  top: calc(50% - var(--handle-offset) - var(--line));
  left: calc(50% - var(--handle-offset) - var(--line));
  width: calc(var(--arm) + var(--line) / 2);
  height: calc(var(--arm) + var(--line) / 2);
  border-top: var(--line) solid var(--mark);
  border-left: var(--line) solid var(--mark);
  border-top-left-radius: calc(var(--handle-radius) + var(--line) / 2);
}

/* An edge: a bar along the line's middle, just outside it. */
.app-handle--edge .app-handle__mark::before {
  top: calc(50% - var(--handle-bar-thickness));
  left: calc(50% - var(--handle-bar-length) / 2);
  width: var(--handle-bar-length);
  height: var(--handle-bar-thickness);
  background: var(--mark);
  border-radius: calc(var(--handle-bar-thickness) / 2);
}

/* The hot corner: under the pointer or being dragged, grown on a faint disc of its colour. */
.app-handle--corner .app-handle__mark::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(2 * var(--handle-hot-disc));
  height: calc(2 * var(--handle-hot-disc));
  content: '';
  background: var(--mark);
  border-radius: var(--radius-full);
  opacity: 0;
  transform: translate(-50%, -50%);
  z-index: -1;
}

.app-handle--hot .app-handle__mark {
  --arm: var(--handle-hot-arm);
  --line: var(--handle-hot-line);
}

.app-handle--corner.app-handle--hot .app-handle__mark::after {
  opacity: var(--handle-hot-disc-alpha);
}

@media (hover: hover) {
  .app-handle--corner:hover .app-handle__mark {
    --arm: var(--handle-hot-arm);
    --line: var(--handle-hot-line);
  }

  .app-handle--corner:hover .app-handle__mark::after {
    opacity: var(--handle-hot-disc-alpha);
  }
}
</style>
