<script setup lang="ts">
import { computed, useId } from 'vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import BrickBlockField from './BrickBlockField.vue'
import { describeWeave, TECHNIQUES, type Technique } from '../../domain/weave'
import type { Project } from '../../domain/project'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import { controlAction } from '../../composables/shell/controlRegistry'

// The Canvas's Technique in the Project panel, beside the Bead (ProjectPanel card, ticket 492): enabled at any time,
// since Row progress belongs to the Frame. Right-angle weave and Netting are fixed when the Project is made, so a
// Canvas woven in one offers no choice.
const props = defineProps<{ project: Project }>()
const emit = defineEmits<{ 'set-technique': [technique: Technique]; 'set-brick-block': [brickBlock: number] }>()

const { t } = useI18n()
const labelId = useId()
const action = controlAction('change-canvas-technique')

const technique = computed({
  get: () => props.project.technique,
  set: (value: Technique) => emit('set-technique', value),
})
const options = computed(() => {
  const body = action.body?.(t.value)
  return TECHNIQUES.filter((value) => describeWeave({ technique: value }).switchable).map((value) => {
    const name = techniqueName(t.value, value)
    return { value, label: name, tooltip: { name, body } }
  })
})
</script>

<template>
  <div v-if="describeWeave(project).switchable" class="canvas-technique" data-testid="canvas-technique-row">
    <span :id="labelId">{{ t.panels.project.canvasTechnique }}</span>
    <SegmentedControl v-model="technique" :options="options" small :labelledby="labelId" data-testid="canvas-technique" />
    <BrickBlockField
      v-if="describeWeave(project).hasBrickBlock"
      :model-value="project.brickBlock ?? 1"
      testid="canvas-brick-block"
      @update:model-value="emit('set-brick-block', $event)"
    />
  </div>
</template>

<style scoped>
.canvas-technique {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  font: var(--type-control);
  min-width: 0;
}
</style>
