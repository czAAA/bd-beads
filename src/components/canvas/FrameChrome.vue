<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import IconButton from '../ui/IconButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { frameEditToggleCentre, frameMoveHandle, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'

/**
 * What a Frame carries all the time (ticket 452, ADR 0062): the edit toggle at the top-right corner of the margin outline,
 * clamped inside the canvas box, and the keyboard's stop on the Move handle. The handle itself is drawn and dragged on
 * the canvas (ProjectSurface); the button here sits over it, takes no pointer, and lets the arrows move the Frame with
 * its beads and Shift + arrows resize it. `anchor` is the Frame's rectangle in the canvas box's own pixels.
 */
const props = defineProps<{
  project: Project
  anchor: FrameAnchor
  /** Whether the handles and steppers are on. */
  editing: boolean
}>()

const emit = defineEmits<{ toggle: []; key: [event: KeyboardEvent] }>()

const { t } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const toggleAction = controlAction('edit-frame')

const touch = useMediaQuery('(pointer: coarse)')
const TOUCH_TARGET_PX = 44
const TOGGLE_PX = 34
const toggleSize = computed(() => (touch.value ? TOUCH_TARGET_PX : TOGGLE_PX))
const toggleStyle = computed(() => {
  const { x, y } = frameEditToggleCentre(props.anchor, toggleSize.value)
  return { left: `${x}px`, top: `${y}px`, width: `${toggleSize.value}px`, height: `${toggleSize.value}px` }
})
const moveStyle = computed(() => {
  const { x, y, size } = frameMoveHandle(props.anchor, touch.value)
  return { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` }
})
const enabled = computed(() => toggleAction.enabled?.(deps.value) ?? true)
</script>

<template>
  <div class="frame-chrome" data-testid="frame-chrome">
    <IconButton
      class="frame-chrome__toggle"
      variant="box"
      :action="toggleAction"
      :deps="deps"
      :pressed="editing && enabled"
      :style="toggleStyle"
      data-testid="frame-edit-toggle"
      @click="emit('toggle')"
    />
    <button
      type="button"
      class="frame-chrome__move"
      :style="moveStyle"
      :aria-label="t.frame.moveHandle"
      data-testid="frame-move-handle"
      @keydown="emit('key', $event)"
    />
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

.frame-chrome__toggle {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
}

/* The Move handle is drawn on the canvas, which also takes its drag: this button is only its place in the Tab order and its focus ring. */
.frame-chrome__move {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 0;
  border: 0;
  background: transparent;
  pointer-events: none;
  border-radius: var(--radius-sm);
}
</style>
