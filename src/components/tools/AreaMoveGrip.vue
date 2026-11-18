<script setup lang="ts">
import { computed } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { SheetArea } from '../../composables/tools/selectionBarPlacement'
import IconButton from '../ui/IconButton.vue'

/** The move grip, an area's bar's first item (ContextBar card, Area sheet, ticket 0808): an 18 × 4 `canvas` pill whose
 * press goes on to the canvas to drag the area, and whose arrows move it a bead. Its own Tab stop, before the bar's. On
 * a Piece's shape it moves the Piece, beads and all (ticket 1013). */
const props = defineProps<{
  /** Which area it moves: the Selection, or the Mirror's Canvas Area. */
  area: SheetArea
  /** Whether the Selection is a Piece's shape, which moves with its beads. */
  piece?: boolean
}>()

const emit = defineEmits<{
  press: [event: PointerEvent]
  key: [event: KeyboardEvent]
}>()

const action = computed(() => controlAction(props.area === 'mirror' ? 'move-mirror-area' : props.piece ? 'move-piece' : 'move-selection'))

/** Arrows are the grip's own, not the bar's roving focus: the area moves instead. */
function onKeydown(event: KeyboardEvent): void {
  if (!event.key.startsWith('Arrow')) return
  event.stopPropagation()
  emit('key', event)
}
</script>

<template>
  <IconButton
    variant="plain"
    :action="action"
    class="area-move-grip"
    :data-testid="`${area === 'selection' ? 'context-bar' : 'mirror-bar'}-move`"
    @pointerdown="emit('press', $event)"
    @keydown="onKeydown"
  >
    <span class="area-move-grip__pill" aria-hidden="true" />
  </IconButton>
</template>

<style scoped>
/* A 28px cell (the touch bar's 36), `grab`; the pill is `--area-move-grip` wide and 4px thick, in `canvas`. */
:deep(.area-move-grip) {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--selbar-height);
  height: var(--selbar-height);
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: grab;
  touch-action: none;
}

@media (pointer: coarse) {
  :deep(.area-move-grip) {
    width: var(--selbar-height-touch);
    height: var(--selbar-height-touch);
  }
}

:deep(.area-move-grip:active) {
  cursor: grabbing;
}

.area-move-grip__pill {
  width: var(--area-move-grip);
  height: var(--space-4);
  background: var(--canvas);
  border-radius: var(--radius-full);
}
</style>
