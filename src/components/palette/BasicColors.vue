<script setup lang="ts">
import { computed, useId } from 'vue'
import { useAddAllColors, usePalette } from '../../composables/tools/usePalette'
import { fillBlanks } from '../../domain/fillBlanks'
import { BUILT_IN_COLORS } from '../../domain/palette'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppSwatch from '../ui/AppSwatch.vue'

// The twelve basic colors under the Custom color picker (PaletteSwatches card): one by one, or all at once. A press does
// what the picker's + does; one the Palette holds wears a check, and the press takes it as the paint color.
const emit = defineEmits<{
  add: [hex: string]
}>()

const { t } = useI18n()
const palette = usePalette()
const addAll = useAddAllColors()
const labelId = useId()

const colors = computed(() =>
  BUILT_IN_COLORS.map(({ id, hex }) => {
    const name = t.value.colorNames[id] ?? hex
    const held = !!palette.value.byHex(hex)
    const words = t.value.palette.beadColors
    return { hex, name, held, label: fillBlanks(held ? words.heldLabel : words.add, { name }) }
  }),
)
const allHeld = computed(() => colors.value.every((color) => color.held))
</script>

<template>
  <div class="basic-colors" role="group" :aria-labelledby="labelId" data-testid="basic-colors">
    <div class="basic-colors__head">
      <span :id="labelId" class="basic-colors__label">{{ t.palette.basicColors }}</span>
      <AppButton v-if="addAll" variant="in-box" size="sm" :disabled="allHeld" data-testid="basic-colors-add-all" @click="addAll(colors.map((color) => color.hex))">
        {{ t.palette.addAllColors }}
      </AppButton>
    </div>
    <div class="basic-colors__grid">
      <AppSwatch v-for="color in colors" :key="color.hex" role="action" :color="color.hex" :label="color.label" :tooltip-name="color.name" :held="color.held" data-testid="basic-color" @select="emit('add', color.hex)" />
    </div>
  </div>
</template>

<style scoped>
/* As wide as the grid, which is wider than the wheel above it where touch makes the swatches bigger. */
.basic-colors {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.basic-colors__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.basic-colors__label {
  font: var(--type-meta-small);
  color: var(--muted);
}

.basic-colors__grid {
  display: grid;
  grid-template-columns: repeat(6, var(--field-height));
  gap: var(--space-6);
}
</style>
