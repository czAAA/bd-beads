<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import IconButton from '../ui/IconButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { frameCornerControls, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import type { Project } from '../../domain/project'

/**
 * What a Frame carries all the time (tickets 452, 455, ADR 0062): three small buttons in a row just inside the top-right
 * corner of the margin outline, like a window's, clamped inside the canvas box: Move handle, Edit Frame and Remove Frame.
 * The Move handle is drawn on the canvas (ProjectSurface); its button here sits over it for the Tooltip and the keyboard,
 * and hands a press on to the canvas to drag, and the arrows move the Frame with its beads while Shift + arrows resize
 * it. `anchor` is the Frame's rectangle in the canvas box's own pixels.
 */
const props = defineProps<{
  project: Project
  anchor: FrameAnchor
  /** Whether the handles and steppers are on. */
  editing: boolean
}>()

const emit = defineEmits<{
  toggle: []
  remove: []
  'move-press': [event: PointerEvent]
  key: [event: KeyboardEvent]
}>()

const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const toggleAction = controlAction('edit-frame')
const removeAction = controlAction('remove-frame')
const moveAction = controlAction('move-frame')

const touch = useMediaQuery('(pointer: coarse)')
const controls = computed(() => frameCornerControls(props.anchor, touch.value))
const place = (at: { x: number; y: number }) => ({ left: `${at.x}px`, top: `${at.y}px` })
const sized = computed(() => ({ width: `${controls.value.size}px`, height: `${controls.value.size}px` }))

const editEnabled = computed(() => toggleAction.enabled?.(deps.value) ?? true)
</script>

<template>
  <div class="frame-chrome" data-testid="frame-chrome">
    <div class="frame-chrome__control" :style="place(controls.move)">
      <IconButton
        variant="plain"
        :action="moveAction"
        class="frame-chrome__move"
        :style="sized"
        data-testid="frame-move-handle"
        @pointerdown="emit('move-press', $event)"
        @keydown="emit('key', $event)"
      />
    </div>
    <div class="frame-chrome__control" :style="place(controls.edit)">
      <IconButton
        variant="box"
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
/* Over the whole canvas box, whose pixels the controls are placed in, letting everything but the controls through to the canvas. */
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

/* The Move handle is drawn on the canvas: its button only carries the Tooltip, the focus ring and the press. */
.frame-chrome__control :deep(.frame-chrome__move) {
  background: transparent;
  border: 0;
  cursor: grab;
  touch-action: none;
}
</style>
