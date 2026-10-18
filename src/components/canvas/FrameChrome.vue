<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconButton from '../ui/IconButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { editPencilCentre, marginHandleCentre, type BarBox, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import type { Project } from '../../domain/project'

// What a Frame always carries on the canvas (tickets 452, 473, ADR 0062): the Margin handle and the edit pencil. They
// never scale with the zoom; only their centres follow the Frame, kept in the canvas box. The handle hands its press to
// the canvas to drag; arrows move the Frame with its beads, Shift+arrows resize.
const props = defineProps<{
  project: Project
  anchor: FrameAnchor
  /** Whether the Frame bar is open. */
  editing: boolean
  /** Whether a pointer is down on the canvas, so the handle knows when its drag has ended. */
  pressing: boolean
  /** Where the Frame bar is, so the handle slides clear of it. */
  bar?: BarBox
}>()

const emit = defineEmits<{
  toggle: []
  'move-press': [event: PointerEvent]
  key: [event: KeyboardEvent]
}>()

const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const toggleAction = controlAction('edit-frame')
const moveAction = controlAction('move-frame')

const place = (at: { x: number; y: number }) => ({ left: `${at.x}px`, top: `${at.y}px` })
const handleAt = computed(() => place(marginHandleCentre(props.anchor, props.bar)))
const pencilAt = computed(() => place(editPencilCentre(props.anchor)))

const editEnabled = computed(() => toggleAction.enabled?.(deps.value) ?? true)

/** Whether the handle is being dragged: it turns accent until the canvas press ends. */
const dragging = ref(false)
watch(
  () => props.pressing,
  (pressing) => {
    if (!pressing) dragging.value = false
  },
)

function onHandlePress(event: PointerEvent): void {
  dragging.value = true
  emit('move-press', event)
}
</script>

<template>
  <div class="frame-chrome" data-testid="frame-chrome">
    <div class="frame-chrome__control" :style="handleAt">
      <IconButton
        variant="plain"
        :action="moveAction"
        class="frame-chrome__handle"
        :class="{ 'frame-chrome__handle--dragging': dragging }"
        data-testid="frame-move-handle"
        @pointerdown="onHandlePress"
        @keydown="emit('key', $event)"
      >
        <span class="frame-chrome__line" aria-hidden="true" />
      </IconButton>
    </div>
    <div class="frame-chrome__control" :style="pencilAt">
      <IconButton
        variant="box"
        :icon-size="14"
        :action="toggleAction"
        :deps="deps"
        :selected="editing && editEnabled"
        class="frame-chrome__pencil"
        data-testid="frame-edit-toggle"
        @click="emit('toggle')"
      />
    </div>
  </div>
</template>

<style scoped>
/* Over the whole canvas box, whose pixels the controls are placed in, letting everything but the controls through to
 * the canvas. */
.frame-chrome {
  position: absolute;
  inset: 0;
  z-index: var(--z-context-bar);
  pointer-events: none;
}

.frame-chrome__control {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
}

/* The Margin handle's press goes on to the canvas to drag. */
.frame-chrome__control :deep(.frame-chrome__handle) {
  width: var(--frame-handle-hit-width);
  height: var(--frame-handle-hit-height);
  background: none;
  border: 0;
  cursor: grab;
  touch-action: none;
}

.frame-chrome__control :deep(.frame-chrome__handle--dragging) {
  cursor: grabbing;
}

.frame-chrome__line {
  width: var(--frame-handle-length);
  height: var(--frame-handle-thickness);
  background: var(--ink);
  border-radius: var(--frame-handle-thickness);
  box-shadow: 0 0 0 2px var(--canvas);
}

.frame-chrome__control :deep(.frame-chrome__handle--dragging) .frame-chrome__line {
  background: var(--accent);
}

/* A 32px chip with a 44px hit area round it. */
.frame-chrome__control :deep(.frame-chrome__pencil) {
  position: relative;
  width: var(--frame-edit-chip);
  height: var(--frame-edit-chip);
}

.frame-chrome__control :deep(.frame-chrome__pencil)::after {
  content: '';
  position: absolute;
  inset: calc((var(--frame-edit-chip) - var(--frame-edit-hit)) / 2);
}
</style>
