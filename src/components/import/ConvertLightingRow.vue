<script setup lang="ts">
import { computed, useId } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { fillBlanks } from '../../domain/fillBlanks'
import { signedValue } from '../../domain/formatNumber'
import { LIGHTING_SLIDERS } from '../../domain/lightingFix'
import { useI18n } from '../../i18n/useI18n'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'

// Auto-fix lighting's row (ConvertImage card DS-3, ticket 0907): under the picture row, as it changes the picture before
// it becomes beads. Its name in `control` takes the room and wraps; the switch beside it, then the sun button that opens
// the Lighting popover (ticket 0908), and under the row a line naming the sliders off 0.
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const lighting = wizard.lighting
const words = computed(() => t.value.convertImage.wizard.lighting)
const nameId = useId()
const on = computed({ get: () => lighting.on.value, set: (next: boolean) => lighting.setOn(next) })
const open = computed(() => wizard.popover.value === 'lighting')

/** "brightness +10 · contrast +18": the moved sliders only; none at 0. */
const moved = computed(() =>
  LIGHTING_SLIDERS.filter((name) => lighting.sliders.value[name] !== 0)
    .map((name) =>
      fillBlanks(words.value.moved, { slider: words.value[name].toLocaleLowerCase(locale.value), value: signedValue(lighting.sliders.value[name]) }),
    )
    .join(' · '),
)
</script>

<template>
  <div class="convert-lighting" data-testid="convert-lighting">
    <div class="convert-lighting__row">
      <span :id="nameId" class="convert-lighting__name">{{ t.convertImage.wizard.autoFixLighting }}</span>
      <AppSwitch v-model="on" :label="t.convertImage.wizard.autoFixLighting" :aria-labelledby="nameId" data-testid="convert-lighting-switch" />
      <IconButton
        icon="sun"
        :icon-size="18"
        :label="words.more"
        :tooltip="true"
        :class="{ 'convert-column__more--open': open }"
        aria-haspopup="dialog"
        :aria-expanded="open"
        data-testid="convert-lighting-more"
        @click="wizard.togglePopover('lighting')"
      />
    </div>
    <p v-if="moved" class="convert-lighting__moved" data-testid="convert-lighting-moved">{{ moved }}</p>
  </div>
</template>

<style scoped>
/* 10 under the picture row: the section's 8 and 2 (DS-3). */
.convert-lighting {
  margin-top: var(--space-2);
}

.convert-lighting__row {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  min-height: var(--control-height);
}

.convert-lighting__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
  font: var(--type-control);
  color: var(--ink);
}

/* 2 under the row, wrapping (DS-3). */
.convert-lighting__moved {
  margin: var(--space-2) 0 0;
  overflow-wrap: anywhere;
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
