<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { FrameSettings } from '../../domain/frameShape'
import type { FrameEdge } from '../../domain/frame'
import type { FrameId } from '../../domain/grid'
import { beadOfLayer, frameById, lettersOn, soloFrame } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { Technique } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import BeadQuantities from '../palette/BeadQuantities.vue'
import PanelItem from '../shell/PanelItem.vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import FrameSizeSection from './FrameSizeSection.vue'
import MarginBeadCell from './MarginBeadCell.vue'
import MarginFrameIdentity from './MarginFrameIdentity.vue'
import { frameEstimate, frameSizeWords } from './frameEstimate'

// The expanded sheet's left rail (MarginSheet card, Calmer sheet 3; ticket 1260): Back to the Canvas, who the Frame is,
// its facts as editable chips (the size unfolding its fields in place), Beads needed and Letters. It only asks.
const props = defineProps<{
  project: Project
  frame: FrameId
}>()

const emit = defineEmits<{
  back: []
  rename: [name: string]
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'save-maker-name': [name: string]
  'replace-bead': [beadId: string]
  'set-letters': [on: boolean]
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  'set-settings': [change: FrameSettings]
  'reset-progress': []
  /** The size fields are gone: held steppers settle into their one Undo step (ticket 0640). */
  'settle-settings': []
}>()

const { t, locale } = useI18n()
const canvas = useCanvasBackground(() => props.project)
/** Name and size on the margin: off, the rail keeps what weaving counts by, Beads needed and Letters. */
const named = computed(() => canvas.margin.titleBlock.value)
const held = computed(() => frameById(props.project, props.frame))
const bead = computed(() => beadOfLayer(props.project, props.frame).bead)
const size = computed(() => frameSizeWords(t.value, locale.value, props.project, props.frame))
const estimate = computed(() => frameEstimate(t.value, locale.value, props.project, props.frame))
const solo = computed(() => soloFrame(props.project, props.frame))

const sizing = ref(false)
watch(sizing, (open) => open || emit('settle-settings'))
onBeforeUnmount(() => sizing.value && emit('settle-settings'))
</script>

<template>
  <div class="margin-rail-facts" data-testid="margin-rail-facts">
    <div class="margin-rail-facts__group">
      <PanelItem icon="collapse-frame" stays :name="t.frame.backToCanvas" data-testid="margin-expand-frame" :aria-label="t.frame.backToCanvas" @select="emit('back')">{{ t.frame.backToCanvas }}</PanelItem>
      <template v-if="named && held">
        <MarginFrameIdentity :project="project" :frame="frame" :forms="['all']" :room="Infinity" :only="['name']" @rename="emit('rename', $event)" />
        <MarginFrameIdentity :project="project" :frame="frame" :forms="['all']" :room="Infinity" :only="['maker']" @save-maker-name="emit('save-maker-name', $event)" />
      </template>
    </div>
    <div v-if="named && held" class="margin-rail-facts__group">
      <div class="margin-rail-facts__fact">
        <span class="margin-rail-facts__label">{{ t.form.techniqueLabel }}</span>
        <MarginFrameIdentity :project="project" :frame="frame" :forms="['all']" :room="Infinity" :only="['technique']" @set-technique="emit('set-technique', $event)" @set-setting="(id, value) => emit('set-setting', id, value)" />
      </div>
      <div class="margin-rail-facts__fact">
        <span class="margin-rail-facts__label">{{ t.frame.sizeHeading }}</span>
        <div class="margin-rail-facts__size">
          <AppButton variant="text" class="margin-chip" :aria-expanded="sizing" :aria-label="`${t.frame.sizeHeading}: ${size}`" data-testid="margin-rail-size" @click="sizing = !sizing">
            <span class="margin-chip__text">{{ size }}</span>
            <AppIcon name="pencil" :size="12" />
          </AppButton>
          <span v-if="estimate" class="margin-rail-facts__estimate" data-testid="margin-estimate">{{ estimate }}</span>
        </div>
        <FrameSizeSection v-if="sizing" class="margin-rail-facts__sizing" :project="project" :frame="frame" @step="(edge, step) => emit('step', edge, step)" @resize="(columns, rows) => emit('resize', columns, rows)" @set-settings="emit('set-settings', $event)" @reset-progress="emit('reset-progress')" />
      </div>
      <div v-if="bead" class="margin-rail-facts__fact">
        <span class="margin-rail-facts__label">{{ t.panels.project.bead }}</span>
        <MarginBeadCell :bead="bead" @pick="emit('replace-bead', $event)" />
      </div>
    </div>
    <div class="margin-rail-facts__group">
      <BeadQuantities :project="solo" rail />
      <div class="margin-rail-facts__letters">
        <span aria-hidden="true">{{ t.frame.lettersLabel }}</span>
        <AppSwitch :model-value="lettersOn(project, frame)" :label="t.frame.lettersLabel" data-testid="margin-letters" @update:model-value="emit('set-letters', $event)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.margin-rail-facts {
  --panel-item-height: var(--panel-row);
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  min-width: 0;
}

.margin-rail-facts__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.margin-rail-facts__group :deep(.panel-item) {
  padding-inline: var(--space-6);
}

.margin-rail-facts__group :deep(.panel-item__label) {
  flex: 1 1 0;
  min-width: 0;
}

.margin-rail-facts__fact {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
}

.margin-rail-facts__label {
  font: var(--type-small);
  color: var(--muted);
}

.margin-rail-facts__fact > * {
  max-width: 100%;
}

.margin-rail-facts__size {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4) var(--space-8);
}

.margin-rail-facts__estimate {
  font: var(--type-small);
  color: var(--muted);
}

.margin-rail-facts__sizing {
  align-self: stretch;
  padding-block: var(--space-8);
}

/* The rail is narrow: the size's fields wrap and its edge steppers stand one under another. */
.margin-rail-facts__sizing :deep(.frame-size__size) {
  flex-wrap: wrap;
}

.margin-rail-facts__sizing :deep(.frame-size__edges) {
  grid-template-columns: minmax(0, 1fr);
}

.margin-rail-facts__letters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
  padding-inline: var(--space-6);
  font: var(--type-control);
}

@media (pointer: coarse) {
  .margin-rail-facts {
    --panel-item-height: var(--touch-target);
  }
}
</style>
