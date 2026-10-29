<script setup lang="ts">
import { controlAction } from '../../composables/shell/controlRegistry'
import IconButton from '../ui/IconButton.vue'

/** The Move bar: the Frame card's Move handle on the margin sheet (MarginSheet card, tickets 0657, 0682), in the
 * sheet's top band or, where the sheet is bare, alone on the Frame's top edge. Its press goes on to the canvas to drag;
 * arrows move the Frame, Shift+arrows resize. */
defineProps<{
  /** Whether it is being dragged: accent until the canvas press ends. */
  dragging: boolean
}>()

const emit = defineEmits<{
  press: [event: PointerEvent]
  key: [event: KeyboardEvent]
}>()

const move = controlAction('move-frame')
</script>

<template>
  <IconButton
    variant="plain"
    :action="move"
    class="margin-move"
    :class="{ 'margin-move--dragging': dragging }"
    data-testid="frame-move-handle"
    @pointerdown="emit('press', $event)"
    @keydown="emit('key', $event)"
  >
    <span class="margin-move__line" aria-hidden="true" />
  </IconButton>
</template>

<style scoped>
/* A 40 × 6 `ink` pill in a 56 × 28 hit area (24 high outside the full form, which the sheet sets), `grab`. */
:deep(.margin-move) {
  width: var(--frame-handle-hit-width);
  height: var(--margin-move-height);
  background: none;
  border: 0;
  cursor: grab;
  touch-action: none;
}

:deep(.margin-move--dragging) {
  cursor: grabbing;
}

.margin-move__line {
  width: var(--frame-handle-length);
  height: var(--frame-handle-thickness);
  background: var(--ink);
  border-radius: var(--frame-handle-thickness);
}

.margin-move--dragging .margin-move__line {
  background: var(--accent);
}
</style>
