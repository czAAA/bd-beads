<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import AppButton from '../ui/AppButton.vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { frameStepperCentres, type FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { FRAME_EDGES, type FrameEdge } from '../../domain/frame'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'

/**
 * Edit Frame's margin steppers (ticket 417, ADR 0054, ticket 427): a mini −/+ on each of the Frame's four edges, in the
 * margin between the ruler numbers and its outer edge, clamped inside the canvas box,
 * shrinking with the zoom and gone once the rulers drop below every 5th number. Each press moves that edge one bead out (+) or in (−) and is one Undo step, so an edge
 * changes by itself and the Frame never has a pending size. The pairs follow the Frame's rectangle (`anchor`, in the canvas box's own
 * pixels), so they track pan and zoom. Rendered only while the Frame is being edited, never for a Selection.
 */
const props = defineProps<{
  project: Project
  /** The Frame's rectangle, the margin round it and the canvas box they are in. */
  anchor: FrameAnchor
}>()

const emit = defineEmits<{ step: [edge: FrameEdge, step: 1 | -1] }>()

const { t } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

const pairs = FRAME_EDGES.map((edge) => ({ edge, out: controlAction(`frame-edge-${edge}-out`), in: controlAction(`frame-edge-${edge}-in`) }))

const touch = useMediaQuery('(pointer: coarse)')
const centres = computed(() => frameStepperCentres(props.anchor, touch.value))

function pairStyle(edge: FrameEdge) {
  const { x, y } = centres.value[edge]
  return { left: `${x}px`, top: `${y}px`, '--stepper-scale': String(props.anchor.scale) }
}
</script>

<template>
  <div class="edit-frame-steppers" data-testid="edit-frame-steppers">
    <div v-for="pair in pairs" :key="pair.edge" class="edit-frame-steppers__pair" :class="`edit-frame-steppers__pair--${pair.edge}`" :style="pairStyle(pair.edge)">
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
/* Over the whole canvas box, whose pixels the pairs are placed in, letting everything but the buttons through to the canvas. */
.edit-frame-steppers {
  position: absolute;
  inset: 0;
  z-index: var(--z-context-bar);
  pointer-events: none;
}

/* A pair is centred on the point the script gives it, in the margin. */
.edit-frame-steppers__pair {
  position: absolute;
  display: flex;
  gap: var(--space-2);
  transform: translate(-50%, -50%);
  pointer-events: auto;
}

.edit-frame-steppers__pair--left,
.edit-frame-steppers__pair--right {
  flex-direction: column;
}

.edit-frame-steppers :deep(.edit-frame-steppers__button) {
  width: calc(var(--selbar-height) * var(--stepper-scale, 1));
  min-width: 0;
  height: calc(var(--selbar-height) * var(--stepper-scale, 1));
  padding: 0;
  font: var(--type-control);
  border-radius: var(--radius-sm);
}

@media (pointer: coarse) {
  .edit-frame-steppers :deep(.edit-frame-steppers__button) {
    width: calc(var(--selbar-height-touch) * var(--stepper-scale, 1));
    height: calc(var(--selbar-height-touch) * var(--stepper-scale, 1));
  }
}
</style>
