<script setup lang="ts">
import { useConvertSheet } from '../../composables/import/convertSheet'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'

// A sheet's head on the docked converter (ConvertImage card DS-4, tickets 0911, 0919): a back arrow where the sheet
// stands in another's place, the name with its (i) (the slot), the value, Close. It stays while the sheet scrolls.
defineProps<{
  title: string
  /** The back arrow's name and Tooltip; no arrow without it. */
  back?: string
  backTestid?: string
  /** What the setting holds now ("12 colors"), at the right. */
  value?: string
  valueTestid?: string
}>()
const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
const sheet = useConvertSheet()
</script>

<template>
  <div class="convert-sheet-head" :class="{ 'convert-sheet-head--back': back }">
    <IconButton v-if="back" icon="chevron-left" variant="plain" class="convert-sheet-head__back" :label="back" :tooltip="true" :data-testid="backTestid" @click="emit('back')" />
    <span class="convert-sheet-head__title">
      {{ title }}
      <slot />
    </span>
    <span v-if="value" class="convert-sheet-head__value" role="status" :data-testid="valueTestid">{{ value }}</span>
    <IconButton icon="close" :label="t.convertImage.wizard.sheetClose" data-testid="convert-sheet-close" @click="sheet?.close()" />
  </div>
</template>

<style scoped>
.convert-sheet-head {
  position: sticky;
  top: 0;
  z-index: var(--convert-layer-pinned);
  display: flex;
  flex: none;
  gap: var(--space-8);
  align-items: center;
  min-height: var(--convert-sheet-head);
  background: var(--elevated);
}

.convert-sheet-head__title {
  display: inline-flex;
  flex: 1 1 auto;
  gap: var(--space-4);
  align-items: center;
  min-width: 0;
  font: var(--type-control);
  font-weight: 600;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.convert-sheet-head__value {
  flex: 0 1 auto;
  font: var(--type-meta);
  color: var(--muted);
  text-align: right;
}

/* The back arrow, `touch-target` square, its chevron where the sheet's text starts. */
.convert-sheet-head--back {
  gap: var(--space-4);
  margin-inline-start: calc(-1 * var(--space-12));
}

.convert-sheet-head :deep(.convert-sheet-head__back) {
  width: var(--touch-target);
  height: var(--touch-target);
}
</style>
