<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import IconButton from '../ui/IconButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { frameCornerControls, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import type { Project } from '../../domain/project'

// What a Frame always carries (tickets 452, 455, 471, ADR 0062): Move handle, Rotate Frame, Edit Frame and Remove Frame
// buttons inside the margin outline's top-right, clamped in the canvas box. The Move handle hands a press to the canvas
// to drag; arrows move the Frame with its beads, Shift+arrows resize. `anchor` is the Frame's rectangle in canvas pixels.
const props = defineProps<{
  project: Project
  anchor: FrameAnchor
  /** Whether the handles and steppers are on. */
  editing: boolean
}>()

const emit = defineEmits<{
  toggle: []
  rotate: []
  remove: []
  'move-press': [event: PointerEvent]
  key: [event: KeyboardEvent]
}>()

const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const toggleAction = controlAction('edit-frame')
const removeAction = controlAction('remove-frame')
const moveAction = controlAction('move-frame')
const rotateAction = controlAction('rotate-frame')

const touch = useMediaQuery('(pointer: coarse)')
const controls = computed(() => frameCornerControls(props.anchor, touch.value))
const place = (at: { x: number; y: number }) => ({ left: `${at.x}px`, top: `${at.y}px` })
const scaled = computed(() => ({ '--corner-scale': String(controls.value.scale) }))
// Each button keeps its full size and the wrapper shrinks it with the zoom, so the icon shrinks with the box.
const sized = computed(() => ({ width: `${controls.value.fullSize}px`, height: `${controls.value.fullSize}px` }))

const editEnabled = computed(() => toggleAction.enabled?.(deps.value) ?? true)
</script>

<template>
  <div class="frame-chrome" data-testid="frame-chrome" :style="scaled">
    <div class="frame-chrome__control" :style="place(controls.move)">
      <IconButton
        variant="box"
        :icon-size="15"
        :action="moveAction"
        class="frame-chrome__move"
        :style="sized"
        data-testid="frame-move-handle"
        @pointerdown="emit('move-press', $event)"
        @keydown="emit('key', $event)"
      />
    </div>
    <div class="frame-chrome__control" :style="place(controls.rotate)">
      <IconButton
        variant="box"
        :icon-size="15"
        :action="rotateAction"
        :deps="deps"
        :style="sized"
        data-testid="frame-rotate"
        @click="emit('rotate')"
      />
    </div>
    <div class="frame-chrome__control" :style="place(controls.edit)">
      <IconButton
        variant="box"
        :icon-size="15"
        :action="toggleAction"
        :deps="deps"
        :pressed="editing && editEnabled"
        :style="sized"
        data-testid="frame-edit-toggle"
        @click="emit('toggle')"
      />
    </div>
    <div class="frame-chrome__control" :style="place(controls.remove)">
      <IconButton
        variant="box"
        :icon-size="15"
        :action="removeAction"
        :deps="deps"
        :style="sized"
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
  transform: translate(-50%, -50%) scale(var(--corner-scale, 1));
  pointer-events: auto;
}

/* The Move handle's press goes on to the canvas to drag. */
.frame-chrome__control :deep(.frame-chrome__move) {
  cursor: grab;
  touch-action: none;
}
</style>
