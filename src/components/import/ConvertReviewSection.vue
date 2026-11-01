<script setup lang="ts">
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import NamesSection from '../project/NamesSection.vue'
import BeadQuantities from '../palette/BeadQuantities.vue'

// Convert image's Review section (ConvertImage card, 5 Review): Name and Maker's name, then the app's own Beads needed
// for the Project Create Project would make, closed under its disclosure with its total on the row (ticket 0759).
const wizard = useConvertImageWizardState()
</script>

<template>
  <div class="convert-review" data-testid="convert-review">
    <NamesSection v-model:name="wizard.name.value" v-model:maker-name="wizard.makerName.value" :name-placeholder="wizard.fileStem.value" />
    <div class="convert-review__beads" data-testid="convert-summary">
      <BeadQuantities :project="wizard.draftProject.value" :catalog="wizard.beadCatalog.value" closed-first />
    </div>
  </div>
</template>

<style scoped>
.convert-review {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

/* A narrow sheet puts "optional" under a long field label rather than squeezing the label onto two lines. */
.convert-review :deep(.form-field__label-row) {
  flex-wrap: wrap;
}

.convert-review__beads {
  padding: var(--space-4) 0;
  background: var(--surface);
  border-radius: var(--radius-lg);
}
</style>
