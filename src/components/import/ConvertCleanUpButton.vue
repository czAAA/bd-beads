<script setup lang="ts">
import { computed } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { fillBlanks } from '../../domain/fillBlanks'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'

// The Clean up button under Colors (ConvertImage card DS-3, ticket 0906): what the helper did, in a line or two, and
// its popover in one press.
defineEmits<{ toggle: [] }>()
const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard.cleanUp)
const cleanUp = wizard.cleanUp
const open = computed(() => wizard.popover.value === 'clean-up')

/** The button's two lines for each state (DS-3, "The words for each state"); the second is left out when it says nothing. */
const lines = computed(() => {
  if (!cleanUp.on.value && cleanUp.flatArt.value) return { first: words.value.offForPixelArt, second: words.value.everyPixel }
  if (!cleanUp.on.value) return { first: words.value.off, second: plural(locale.value, cleanUp.lone.value, words.value.left) }
  const joined = cleanUp.joined.value.colors
  return {
    first: cleanUp.cleaned.value > 0 ? plural(locale.value, cleanUp.cleaned.value, words.value.cleaned) : words.value.none,
    second: joined > 0 ? plural(locale.value, joined, words.value.smallJoined) : undefined,
  }
})
</script>

<template>
  <button
    type="button"
    class="ui-control convert-clean-up-button"
    :class="{ 'convert-clean-up-button--open': open, 'convert-clean-up-button--off': !cleanUp.on.value }"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :aria-label="fillBlanks(words.buttonName, { line: lines.first })"
    data-wrap-ok
    data-testid="convert-clean-up-button"
    @click="$emit('toggle')"
  >
    <AppIcon name="clean-up" :size="18" class="convert-clean-up-button__icon" />
    <span class="convert-clean-up-button__lines">
      <span class="convert-clean-up-button__first" data-testid="convert-clean-up-first">{{ lines.first }}</span>
      <span v-if="lines.second" class="convert-clean-up-button__second" data-testid="convert-clean-up-second">{{ lines.second }}</span>
    </span>
    <AppIcon name="chevron-down" :size="16" class="convert-clean-up-button__chevron" />
  </button>
</template>

<style scoped>
.convert-clean-up-button {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--convert-result-button-height);
  margin-top: var(--space-4);
  padding: var(--space-6) var(--space-10);
  color: var(--ink);
  text-align: left;
  background: none;
  border: 1px solid var(--button-line);
  border-radius: var(--radius-md);
  cursor: pointer;
}

@media (pointer: coarse) {
  .convert-clean-up-button {
    min-height: var(--convert-result-button-height-touch);
  }
}

@media (hover: hover) {
  .convert-clean-up-button:hover {
    background: var(--hover-fill);
  }
}

.convert-clean-up-button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.convert-clean-up-button--open {
  border-color: var(--ink);
  box-shadow: inset 0 0 0 0.5px var(--ink);
}

.convert-clean-up-button__icon {
  flex: none;
  color: var(--ink);
}

.convert-clean-up-button--off .convert-clean-up-button__icon,
.convert-clean-up-button__chevron {
  flex: none;
  color: var(--muted);
}

.convert-clean-up-button__lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  overflow-wrap: anywhere;
}

.convert-clean-up-button__first {
  font: var(--type-control);
}

.convert-clean-up-button__second {
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
