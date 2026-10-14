<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../ui/AppButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { STEPPER_GAP_PX, TOUCH_STEPPER_GAP_PX, type SelectionAnchor } from '../../composables/tools/selectionBarPlacement'
import { FRAME_EDGES, type FrameEdge } from '../../domain/frame'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'

/**
 * Edit Frame's margin steppers (ticket 417, ADR 0054): a mini −/+ on each of the Frame's four edges, in the margin just
 * outside its line. Each press moves that edge one bead out (+) or in (−) and is one Undo step, so an edge changes by
 * itself and the Frame never has a pending size. The pairs follow the Frame's rectangle (`anchor`, in the canvas box's own
 * pixels), so they track pan and zoom. Rendered only while the Frame is being edited, never for a Selection.
 */
const props = defineProps<{
  project: Project
  /** The Frame's rectangle and the canvas box it is in. */
  anchor: SelectionAnchor
}>()

const emit = defineEmits<{ step: [edge: FrameEdge, step: 1 | -1] }>()

const { t } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

const pairs = FRAME_EDGES.map((edge) => ({ edge, out: controlAction(`frame-edge-${edge}-out`), in: controlAction(`frame-edge-${edge}-in`) }))

const boxStyle = computed(() => {
  const { left, top, width, height } = props.anchor.box
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    '--stepper-gap': `${STEPPER_GAP_PX}px`,
    '--stepper-gap-touch': `${TOUCH_STEPPER_GAP_PX}px`,
  }
})
</script>

<template>
  <div class="edit-frame-steppers" :style="boxStyle" data-testid="edit-frame-steppers">
    <div v-for="pair in pairs" :key="pair.edge" class="edit-frame-steppers__pair" :class="`edit-frame-steppers__pair--${pair.edge}`">
      <AppButton
        class="edit-frame-steppers__button"
        variant="box"
        :action="pair.in"
        :deps="deps"
        :aria-label="pair.in.name(t)"
        :data-testid="`frame-edge-${pair.edge}-in`"
        @click="emit('step', pair.edge, -1)"
      >−</AppButton>
      <AppButton
        class="edit-frame-steppers__button"
        variant="box"
        :action="pair.out"
        :deps="deps"
        :aria-label="pair.out.name(t)"
        :data-testid="`frame-edge-${pair.edge}-out`"
        @click="emit('step', pair.edge, 1)"
      >+</AppButton>
    </div>
  </div>
</template>

<style scoped>
/* Over the Frame's rectangle, letting everything but the buttons through to the canvas (z-context-bar, like the bar it sits with). */
.edit-frame-steppers {
  position: absolute;
  z-index: var(--z-context-bar);
  pointer-events: none;
}

/* A pair is centred on its edge, just outside the line: past the handle squares and, on touch, their larger ones. */
.edit-frame-steppers__pair {
  position: absolute;
  display: flex;
  gap: var(--space-2);
  pointer-events: auto;
}

.edit-frame-steppers__pair--top {
  top: 0;
  left: 50%;
  transform: translate(-50%, calc(-100% - var(--stepper-gap)));
}

.edit-frame-steppers__pair--bottom {
  bottom: 0;
  left: 50%;
  transform: translate(-50%, calc(100% + var(--stepper-gap)));
}

.edit-frame-steppers__pair--left {
  top: 50%;
  left: 0;
  flex-direction: column;
  transform: translate(calc(-100% - var(--stepper-gap)), -50%);
}

.edit-frame-steppers__pair--right {
  top: 50%;
  right: 0;
  flex-direction: column;
  transform: translate(calc(100% + var(--stepper-gap)), -50%);
}

.edit-frame-steppers :deep(.edit-frame-steppers__button) {
  width: var(--selbar-height);
  min-width: 0;
  height: var(--selbar-height);
  padding: 0;
  font: var(--type-control);
  border-radius: var(--radius-sm);
}

@media (pointer: coarse) {
  .edit-frame-steppers :deep(.edit-frame-steppers__button) {
    width: var(--selbar-height-touch);
    height: var(--selbar-height-touch);
  }

  .edit-frame-steppers__pair--top {
    transform: translate(-50%, calc(-100% - var(--stepper-gap-touch)));
  }

  .edit-frame-steppers__pair--bottom {
    transform: translate(-50%, calc(100% + var(--stepper-gap-touch)));
  }

  .edit-frame-steppers__pair--left {
    transform: translate(calc(-100% - var(--stepper-gap-touch)), -50%);
  }

  .edit-frame-steppers__pair--right {
    transform: translate(calc(100% + var(--stepper-gap-touch)), -50%);
  }
}
</style>
