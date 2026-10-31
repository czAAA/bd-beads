<script setup lang="ts" generic="T extends string">
import { computed, ref } from 'vue'
import { useRovingFocus } from '../../../composables/ui/useRovingFocus'
import { useI18n } from '../../../i18n/useI18n'
import AppTooltip from '../AppTooltip.vue'
import type { ControlActionLike } from '../controlAction'

// A choice of short chips in a row that wraps (ChipRadioGroup of ticket 0650, once the ratio chips; now the Feedback sheet): one radiogroup and one Tab stop,
// the chosen chip or else the first; the arrows, Home and End move focus and a press chooses. Each chip's name and
// Tooltip come from its registry action (ADR 0035); its face is the short label.
const props = defineProps<{
  options: readonly { value: T; label: string; action: ControlActionLike; testid?: string }[]
  labelledby?: string
}>()
const value = defineModel<T | undefined>({ required: true })

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
const roving = useRovingFocus(rootEl, { selector: '.chip-group__chip' })

/** The Tab stop: the chosen chip, or the first while none is. */
const stopIndex = computed(() => Math.max(0, props.options.findIndex((option) => option.value === value.value)))
</script>

<template>
  <div ref="rootEl" class="chip-group" role="radiogroup" :aria-labelledby="labelledby" @keydown="roving.onKeydown">
    <AppTooltip v-for="(option, index) in options" :key="option.value" :name="option.action.name(t)" :body="option.action.body?.(t)" :announce="false">
      <button
        type="button"
        role="radio"
        class="ui-control chip-group__chip"
        :class="{ 'chip-group__chip--on': option.value === value }"
        :aria-checked="option.value === value"
        :aria-label="option.action.name(t)"
        :tabindex="roving.tabIndexFor(index === stopIndex)"
        :data-testid="option.testid"
        @click="value = option.value"
      >
        {{ option.label }}
      </button>
    </AppTooltip>
  </div>
</template>

<style scoped>
.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

.chip-group__chip {
  box-sizing: border-box;
  min-width: var(--ratio-chip-min);
  height: var(--item-height);
  padding: 0 var(--space-8);
  font: var(--type-meta);
  font-family: var(--font-mono);
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.chip-group__chip--on {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.chip-group__chip:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
