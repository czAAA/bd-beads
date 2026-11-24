<script setup lang="ts">
import { computed, useId } from 'vue'
import { beadChoices, type Bead } from '../../domain/beads'
import type { Layer } from '../../domain/grid'
import type { Background } from '../../domain/project'
import type { Technique, TechniqueSettings } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import BackgroundSection from './BackgroundSection.vue'
import BeadSection from './BeadSection.vue'
import InfoButton from '../ui/InfoButton.vue'
import TechniqueSection from './TechniqueSection.vue'

// Layer settings (ADR 0079, ticket 0670; LayerSettings card): the one section that sets a layer, wherever a layer is
// set (the New Project form, the Project panel's Canvas section, a Starter's setup). Its Technique and that Technique's
// settings, its Bead, and its Background (none in the New Project form, ticket 0881). It only asks.
const props = defineProps<{
  layer: Layer
  technique: Technique
  /** The Technique settings' values by id; a setting with none shows its default. */
  techniqueSettings: TechniqueSettings
  /** The Techniques offered (a Custom frame's shape's); every one when none are given. */
  techniques?: readonly Technique[]
  /** The Technique without its settings: a Starter's shape that no Drop changes (ticket 0872). */
  withoutTechniqueSettings?: boolean
  /** The layer's Bead, or nothing for one that is no longer offered. */
  bead: Bead | undefined
  /** Its Background as it shows: its own, or the device's last pick where it has none. None for the New Project form,
   * which offers no picker: a Project starts on the device's last pick, set later in the Project panel (ticket 0881). */
  background?: Background
  /** A Row progress pass is done: what moves positions (its Technique's settings) waits. */
  locked?: boolean
  /** Its Technique can still change while locked, asking first what to do with the rows woven (ticket 1184). */
  techniqueOpen?: boolean
  /** Technique and Bead each with an Info button saying what they decide: New Project's, for a stranger who has not
   * met the words (ticket 0951). */
  explained?: boolean
  /** The prefix of the Technique controls' test ids. */
  testid: string
}>()
const emit = defineEmits<{
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'pick-bead': [beadId: string]
  'set-background': [background: Background]
}>()

const { t } = useI18n()
const beadLabelId = useId()
const backgroundLabelId = useId()

/** What the Bead could switch to, and whether its own copy has gone out of date (ticket 534). */
const choices = computed(() => beadChoices(props.bead))
</script>

<template>
  <div class="layer-settings" :data-testid="`${testid}-layer-settings`">
    <TechniqueSection
      :technique="technique"
      :settings="techniqueSettings"
      :techniques="techniques"
      :without-settings="withoutTechniqueSettings"
      :explained="explained"
      :disabled="locked"
      :technique-open="techniqueOpen"
      :technique-disabled-body="locked ? t.tooltips.rowProgressLockedTechnique : undefined"
      :testid="testid"
      @update:technique="emit('set-technique', $event)"
      @set-setting="(id, value) => emit('set-setting', id, value)"
    />

    <div class="layer-settings__group" role="group" :aria-labelledby="beadLabelId">
      <span class="layer-settings__label layer-settings__heading">
        <span :id="beadLabelId">{{ t.panels.project.bead }}</span>
        <InfoButton v-if="explained" :label="t.form.beadInfoLabel" :body="t.form.beadPicker.hint" :data-testid="`${testid}-bead-info`" />
      </span>
      <BeadSection :bead="bead" :candidates="choices.candidates" :outdated="choices.outdated" @pick="emit('pick-bead', $event)" />
    </div>

    <div v-if="background !== undefined" class="layer-settings__group" role="group" :aria-labelledby="backgroundLabelId">
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

.layer-settings__label {
  font: var(--type-control);
  color: var(--ink);
}

/* A field's name in `control`, as Technique's and Drop's, so it never reads as the section header (ticket 0992). */
.layer-settings__heading {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  padding: 0 var(--space-10);
}

.layer-settings__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
