<script setup lang="ts">
import { computed, useId } from 'vue'
import { beadsDiffer, replaceCandidates, type Bead } from '../../domain/beads'
import type { FrameSheet } from '../../domain/canvas'
import { FRINGE_STYLES, fringeStyleOf, settingValuesOf, type FrameSettings, type FringeStyle } from '../../domain/frameShape'
import type { Layer } from '../../domain/grid'
import type { Background } from '../../domain/project'
import type { BeadShape, Technique, TechniqueSettings } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import AppStepper from '../ui/form/AppStepper.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import BackgroundSection from './BackgroundSection.vue'
import BeadSection from './BeadSection.vue'
import TechniqueSection from './TechniqueSection.vue'

// Layer settings (ADR 0079, ticket 0670; LayerSettings card): the one section that sets a layer, wherever a layer is
// set (the New Project form, the Project panel's Canvas section, the Frame panel). Its Technique and that Technique's
// settings, a Custom frame's shape settings, its Bead and Bead shape, and its Background. It only asks; the caller works.
const props = defineProps<{
  layer: Layer
  technique: Technique
  /** The Technique settings' values by id; a setting with none shows its default. */
  techniqueSettings: TechniqueSettings
  /** The Techniques offered (a Custom frame's shape's); every one when none are given. */
  techniques?: readonly Technique[]
  /** The layer's Bead, or nothing for one that is no longer offered. */
  bead: Bead | undefined
  beadShape: BeadShape
  /** Its Background as it shows: its own, or the device's last pick where it has none. */
  background: Background
  /** The Frame it sets, for a Custom frame's shape settings; none for the Canvas, a draft or a Frame with no shape. */
  frame?: Pick<FrameSheet, 'shape' | 'settings'>
  /** A Row progress pass is done: what moves positions (the Technique, its settings, the shape settings) waits. */
  locked?: boolean
  /** The prefix of the Technique controls' test ids. */
  testid: string
}>()
const emit = defineEmits<{
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'set-shape-settings': [change: FrameSettings]
  'pick-bead': [beadId: string]
  'set-bead-shape': [shape: BeadShape]
  'set-background': [background: Background]
}>()

const { t } = useI18n()
const fringeLabelId = useId()
const beadLabelId = useId()
const backgroundLabelId = useId()

/** A Custom frame's settings (tickets 0592, 0593, 0597), each its value, its range now and its words. */
const shapeSettings = computed(() => (props.frame ? settingValuesOf(props.frame).map((setting) => ({ ...setting, words: t.value.frame.sizeSettings[setting.name] })) : []))
/** A Fringe earring's Fringe style, the setup's names (ticket 0597); none for any other Frame. */
const fringeStyle = computed(() => props.frame && fringeStyleOf(props.frame))
const fringeOptions = computed(() => FRINGE_STYLES.map((value) => ({ value, label: t.value.starters.picks.fringeStyle.options[value] })))
const candidates = computed(() => replaceCandidates(props.bead))
/** The layer's own copy has gone out of date (ticket 534): the catalog's Bead of its id is a candidate, and the copy shows "(as saved)". */
const outdated = computed(() => candidates.value.some((bead) => bead.id === props.bead?.id && beadsDiffer(bead, props.bead)))
</script>

<template>
  <div class="layer-settings" :data-testid="`${testid}-layer-settings`">
    <TechniqueSection
      :technique="technique"
      :settings="techniqueSettings"
      :techniques="techniques"
      :disabled="locked"
      :technique-disabled-body="locked ? t.tooltips.rowProgressLockedTechnique : undefined"
      :testid="testid"
      @update:technique="emit('set-technique', $event)"
      @set-setting="(id, value) => emit('set-setting', id, value)"
    />

    <!-- A Custom frame is sized by its settings (tickets 0592, 0593, 0597): growing adds empty rounds, rows or beads
         outside, shrinking folds what it leaves out (ticket 0640). -->
    <div v-if="shapeSettings.length" class="layer-settings__shape">
      <div v-for="setting in shapeSettings" :key="setting.name" class="layer-settings__row" :data-testid="`frame-setting-${setting.name}`">
        <span class="layer-settings__label">{{ setting.words.label }}</span>
        <AppStepper
          :model-value="setting.value"
          :min="setting.min"
          :max="setting.max"
          :decrease-label="setting.words.less"
          :increase-label="setting.words.more"
          :value-label="setting.words.label"
          :disabled="locked"
          tooltip
          :disabled-body="t.tooltips.frameSizeLocked"
          :decrease-testid="`frame-setting-${setting.name}-less`"
          :increase-testid="`frame-setting-${setting.name}-more`"
          :value-testid="`frame-setting-${setting.name}-value`"
          @update:model-value="emit('set-shape-settings', { [setting.name]: $event })"
        />
      </div>
      <div v-if="fringeStyle" class="layer-settings__style">
        <span :id="fringeLabelId" class="layer-settings__label">{{ t.frame.fringeStyle.label }}</span>
        <SegmentedControl
          :model-value="fringeStyle"
          :options="fringeOptions"
          :labelledby="fringeLabelId"
          :disabled="locked"
          data-testid="frame-fringe-style"
          @update:model-value="emit('set-shape-settings', { fringeStyle: $event as FringeStyle })"
        />
      </div>
      <p v-if="locked" class="layer-settings__line" data-testid="frame-size-locked">{{ t.frame.sizeLockedLine }}</p>
    </div>

    <div class="layer-settings__group" role="group" :aria-labelledby="beadLabelId">
      <span :id="beadLabelId" class="layer-settings__label layer-settings__heading">{{ t.panels.project.bead }}</span>
      <BeadSection
        :bead="bead"
        :bead-shape="beadShape"
        :candidates="candidates"
        :outdated="outdated"
        @update:bead-shape="emit('set-bead-shape', $event)"
        @pick="emit('pick-bead', $event)"
      />
    </div>

    <div class="layer-settings__group" role="group" :aria-labelledby="backgroundLabelId">
      <span :id="backgroundLabelId" class="layer-settings__label layer-settings__heading">{{ t.layerSettings.background }}</span>
      <BackgroundSection :background="background" :layer="layer" @pick="emit('set-background', $event)" />
    </div>
  </div>
</template>

<style scoped>
.layer-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

/* The Technique's steppers line up with its picker. */
.layer-settings :deep(.setting-stepper) {
  padding: 0 var(--space-10);
}

.layer-settings__shape {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: 0 var(--space-10);
}

.layer-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
}

.layer-settings__style {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.layer-settings__label {
  font: var(--type-control);
  color: var(--ink);
}

.layer-settings__heading {
  padding: 0 var(--space-10);
  font: var(--type-label);
  color: var(--muted);
}

.layer-settings__line {
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.layer-settings__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
