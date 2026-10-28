<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconButton from '../ui/IconButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { editPencilCentre, moveHandleCentre, overlapsSelectionHandles, removeFrameCentre, type BarBox, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import type { Project } from '../../domain/project'
import { frameAllows } from '../../domain/frameKind'

// What a Frame always carries on the canvas (tickets 452, 473, ADR 0054): the Move handle and the edit pencil, in the
// gutter just outside its edge. They never scale with the zoom; only their centres follow the Frame, kept in the canvas
// box. The handle hands its press to the canvas to drag; arrows move the Frame, Shift+arrows resize.
const props = defineProps<{
  project: Project
  anchor: FrameAnchor
  /** Whether the Frame panel is open. */
  editing: boolean
  /** Whether a pointer is down on the canvas, so the handle knows when its drag has ended. */
  pressing: boolean
  /** Where the Frame panel is, so the handle slides clear of it. */
  bar?: BarBox
  /** Where the Selection is, if there is one: its handles win a press where a control lies over them. */
  selection?: BarBox
  /** Where the Tool pill is, so the controls keep clear of it. */
  pill?: BarBox
}>()

const emit = defineEmits<{
  toggle: []
  remove: []
  'move-press': [event: PointerEvent]
  key: [event: KeyboardEvent]
}>()

const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const toggleAction = controlAction('edit-frame')
const moveAction = controlAction('move-frame')
const removeAction = controlAction('remove-frame')

const place = (at: { x: number; y: number }) => ({ left: `${at.x}px`, top: `${at.y}px` })
const handleAt = computed(() => place(moveHandleCentre(props.anchor, props.bar, props.pill)))
const pencilAt = computed(() => place(editPencilCentre(props.anchor)))
const removeAt = computed(() => place(removeFrameCentre(props.anchor, props.pill)))

const HIT_PX = 44 // the pencil's and Remove Frame's hit area; the Move handle's is a little wider
const CHIP_PX = 32 // the chip itself, which the Tool pill's press wins over (the hit area round it may overlap)
const overlapsPill = (centre: { x: number; y: number }) =>
  !!props.pill && centre.x + CHIP_PX / 2 > props.pill.left && centre.x - CHIP_PX / 2 < props.pill.left + props.pill.width && centre.y + CHIP_PX / 2 > props.pill.top && centre.y - CHIP_PX / 2 < props.pill.top + props.pill.height
const yields = (centre: { x: number; y: number }, size = HIT_PX) => (!!props.selection && overlapsSelectionHandles(centre, size, props.selection)) || overlapsPill(centre)
const handleYields = computed(() => yields(moveHandleCentre(props.anchor, props.bar, props.pill), 56))
const pencilYields = computed(() => yields(editPencilCentre(props.anchor)))
const removeYields = computed(() => yields(removeFrameCentre(props.anchor, props.pill)))

const editEnabled = computed(() => toggleAction.enabled?.(deps.value) ?? true)
const resizable = computed(() => frameAllows(props.project.frame, 'resize'))

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
    <div class="frame-chrome__control" :class="{ 'frame-chrome__control--yielding': handleYields }" :style="handleAt">
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
    <!-- A Custom frame's shape comes from its settings, so it has no resize handles to show (ticket 0592). -->
    <div v-if="resizable" class="frame-chrome__control" :class="{ 'frame-chrome__control--yielding': pencilYields }" :style="pencilAt">
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
    <div class="frame-chrome__control" :class="{ 'frame-chrome__control--yielding': removeYields }" :style="removeAt">
      <IconButton
        variant="box"
        :icon-size="14"
        :action="removeAction"
        :deps="deps"
        class="frame-chrome__pencil"
        data-testid="frame-chrome-remove"
        @click="emit('remove')"
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

/* Over a Selection's handles the handle wins the press (ticket 498). */
.frame-chrome__control--yielding {
  pointer-events: none;
}

/* The Move handle's press goes on to the canvas to drag. */
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
