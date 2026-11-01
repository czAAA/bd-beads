<script setup lang="ts">
import { computed } from 'vue'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { colorLabel, type LabelledColor } from '../../i18n/colorLabel'
import { useI18n } from '../../i18n/useI18n'
import AppTooltip from '../ui/AppTooltip.vue'

// A color's name wherever the app lists one (ticket 0760; PaletteSwatches, BeadsNeeded and FoundColorRow cards): "49
// Opaque Black" for a catalog color, a Custom color's hex. The hex of a named color is its Tooltip, on hover and
// long-press. Never formatted by the place that shows it.
const props = defineProps<{
  color: LabelledColor
  /** The Bead's Color catalog, once loaded: it supplies the name of a color that knows only its code. */
  catalog?: ColorCatalog
}>()

const { t } = useI18n()
const label = computed(() => colorLabel(t.value, props.color, props.catalog))
</script>

<template>
  <AppTooltip v-if="label.hex" class="color-label" :name="label.hex" :announce="false">
    <span class="color-label__text" data-testid="color-label">{{ label.text }}</span>
  </AppTooltip>
  <span v-else class="color-label color-label__text color-label__text--hex" data-testid="color-label">{{ label.text }}</span>
</template>

<style scoped>
.color-label {
  min-width: 0;
}

.color-label__text {
  min-width: 0;
  overflow-wrap: anywhere;
}

.color-label__text--hex {
  font-family: var(--font-mono);
}
</style>
