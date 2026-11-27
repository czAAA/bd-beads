<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { beadChoices, beadLabel } from '../../domain/beads'
import type { FrameId } from '../../domain/grid'
import { beadOfLayer } from '../../domain/layerRecord'
import { frameWeave } from '../../domain/layerWeave'
import type { Project } from '../../domain/project'
import { rowProgressStarted } from '../../domain/rowProgress'
import { describeWeave, TECHNIQUES, weaveSettings, type Technique } from '../../domain/weave'
import { weaveSettingWords } from '../../i18n/settingWords'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import BeadSection from '../project/BeadSection.vue'
import MarkedDoneLine from '../project/MarkedDoneLine.vue'
import SettingStepper from '../project/SettingStepper.vue'
import { settingTestid } from '../project/settingTestid'
import PanelSection from '../shell/PanelSection.vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'

// The Frame popover's Bead and Technique (MarginSheet card, Calmer sheet; ticket 1257): the legend's Bead pickers, then
// the Technique and its settings as its description names them; those two wait while a row is marked done. It only asks.
const props = defineProps<{ project: Project; frame: FrameId }>()
const emit = defineEmits<{
  'replace-bead': [beadId: string]
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'reset-progress': []
}>()

const { t } = useI18n()
const labelId = useId()
const bead = computed(() => beadOfLayer(props.project, props.frame).bead)
const choices = computed(() => (bead.value ? beadChoices(bead.value) : undefined))
const weave = computed(() => frameWeave(props.project, props.frame))
const technique = computed(() => weave.value.technique)
const summary = computed(() => [bead.value && beadLabel(bead.value), techniqueName(t.value, technique.value)].filter(Boolean).join(' · '))
const locked = computed(() => rowProgressStarted(props.project, props.frame))
const settings = computed(() => {
  const values = weaveSettings(weave.value)
  return describeWeave(weave.value).settings.map((setting) => ({
    setting,
    value: values[setting.id]!,
    disabledBody: locked.value ? weaveSettingWords(t.value, setting).locked : undefined,
  }))
})

const listEl = ref<HTMLElement>()
const roving = useRovingFocus(listEl, { selector: '[role="radio"]', axis: () => 'vertical' })
function choose(next: Technique): void {
  if (!locked.value && next !== technique.value) emit('set-technique', next)
}
</script>

<template>
  <PanelSection id="frame-popover:bead" :label="t.frame.margin.beadAndTechnique" :summary="summary" folded data-testid="frame-popover-bead">
    <div class="frame-popover__body">
      <BeadSection v-if="bead && choices" class="frame-bead__pickers" :bead="bead" :candidates="choices.candidates" :outdated="choices.outdated" labelled @pick="emit('replace-bead', $event)" />
      <div class="frame-bead__technique">
        <span :id="labelId" class="frame-bead__label">{{ t.form.techniqueLabel }}</span>
        <div ref="listEl" class="frame-bead__list" role="radiogroup" :aria-labelledby="labelId" @keydown="roving.onKeydown">
          <AppButton
            v-for="each in TECHNIQUES"
            :key="each"
            variant="text"
            class="frame-bead__radio"
            role="radio"
            :aria-checked="each === technique"
            :tabindex="each === technique ? 0 : -1"
            :label="techniqueName(t, each)"
            :disabled="locked"
            :disabled-body="locked ? t.tooltips.rowProgressLockedTechnique : undefined"
            :data-testid="`frame-popover-technique-${each}`"
            @click="choose(each)"
          >
            <span>{{ techniqueName(t, each) }}</span>
            <AppIcon name="check" :size="16" class="frame-bead__check" />
          </AppButton>
        </div>
      </div>
      <SettingStepper
        v-for="{ setting, value, disabledBody } in settings"
        :key="setting.id"
        class="frame-bead__setting"
        :setting="setting"
        :model-value="value"
        :disabled="locked"
        :disabled-body="disabledBody"
        :testid="settingTestid('frame-popover', setting)"
        @update:model-value="emit('set-setting', setting.id, $event)"
      />
      <MarkedDoneLine v-if="locked" testid="frame-popover-technique-locked" :line="t.tooltips.rowProgressLockedTechnique" @reset-progress="emit('reset-progress')" />
    </div>
  </PanelSection>
</template>

<style scoped>
.frame-bead__pickers {
  padding: 0;
}

.frame-bead__technique,
.frame-bead__list {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.frame-bead__label {
  font: var(--type-small);
  color: var(--muted);
}

/* A radio row: the Technique, the check at its end showing on the current one only. */
.frame-bead__list :deep(.app-button-wrap) {
  display: flex;
}

.frame-bead__list :deep(.frame-bead__radio) {
  justify-content: space-between;
  width: 100%;
  height: var(--panel-item-height);
}

.frame-bead__check {
  visibility: hidden;
  color: var(--accent-strong);
}

.frame-bead__list :deep([aria-checked='true'] .frame-bead__check) {
  visibility: visible;
}

.frame-bead__list :deep([aria-disabled='true'] .frame-bead__check) {
  color: var(--faint);
}

/* A locked setting's buttons, still focusable to say why, read as off. */
.frame-bead__setting :deep(.stepper__button[aria-disabled='true']) {
  color: var(--faint);
}

/* A setting on one line: its name, the stepper at the end. */
.frame-bead__setting {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}
</style>
