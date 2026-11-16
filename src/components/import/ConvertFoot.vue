<script setup lang="ts">
import { computed } from 'vue'
import { useConvertFootLines } from '../../composables/import/useConvertFootLines'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'

// The converter column's foot (ConvertImage card DS-1, ticket 0897): the Project's name, asked once on the New Project
// form, the result in three lines, and Create Project (Add to Canvas from a reference image), on screen from the first
// second and off until a picture is read. Pressing it makes the Project at once: there is nothing more to confirm.
const emit = defineEmits<{ create: [] }>()

const { t } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const { lines, heard, ready, buttonLabel } = useConvertFootLines()
</script>

<template>
  <div class="convert-foot" role="region" :aria-label="words.resultLabel" data-testid="convert-foot">
    <template v-if="lines">
      <p class="convert-foot__project" data-testid="convert-project-line">
        <span class="convert-foot__label">{{ wizard.addsToCanvas ? words.footAddsTo : words.footProject }}</span> <span class="convert-foot__name">{{ wizard.projectName.value }}</span>
      </p>
      <p class="convert-foot__result" aria-hidden="true" data-testid="convert-result">
        <span data-testid="convert-result-size"><b>{{ lines.grid }}</b> · {{ lines.measured }}</span>
        <span data-testid="convert-result-colors">{{ lines.colors }}</span>
        <span class="convert-foot__muted" data-testid="convert-result-beads">{{ lines.beads }}</span>
        <span v-if="lines.goesWhere" class="convert-foot__muted" data-testid="convert-result-goes-where">{{ lines.goesWhere }}</span>
      </p>
    </template>
    <p v-else class="convert-foot__result convert-foot__muted" data-testid="convert-result-none">
      {{ wizard.reading.value ? words.readingLine : words.bandEmpty }}
    </p>
    <p class="convert-foot__heard" role="status" data-testid="convert-result-heard">{{ heard }}</p>
    <AppButton
      variant="primary"
      class="convert-foot__create"
      :disabled="!ready"
      :disabled-body="words.addPictureFirst"
      :label="buttonLabel"
      data-testid="convert-image-create"
      @click="emit('create')"
    >
      {{ buttonLabel }}
    </AppButton>
  </div>
</template>

<style scoped>
/* Pinned to the column's bottom whatever the column holds above, so Create Project is always whole on screen. */
.convert-foot {
  position: sticky;
  bottom: 0;
  z-index: var(--convert-layer-pinned);
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  margin-top: auto;
  padding: var(--space-14) var(--space-20) var(--space-20);
  background: var(--canvas);
  border-top: 1px solid var(--line-soft);
}

.convert-foot__project {
  margin: 0;
  font: var(--type-control);
  overflow-wrap: anywhere;
}

.convert-foot__label {
  font: var(--type-label);
  color: var(--muted);
}

.convert-foot__name {
  font: var(--type-control);
  color: var(--ink);
}

.convert-foot__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  font: var(--type-meta);
  color: var(--body);
}

.convert-foot__result b {
  font-weight: 500;
  color: var(--ink);
}

.convert-foot__muted {
  color: var(--muted);
}

.convert-foot__heard {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.convert-foot :deep(.app-button-wrap) {
  display: flex;
}

.convert-foot :deep(.convert-foot__create.app-button) {
  width: 100%;
  height: var(--field-height);
}

/* Stacked under the preview (under 1024 px or in portrait) the foot ends the column's flow (the phone's is ticket 0911). */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-foot {
    position: relative;
  }
}

@media (pointer: coarse) {
  .convert-foot :deep(.convert-foot__create.app-button) {
    height: var(--touch-target);
  }
}
</style>
