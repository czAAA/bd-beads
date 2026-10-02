<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import type { ThemePick } from '../../theme/theme'
import { useThemePick } from '../../theme/useThemePick'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'

/**
 * The header's four-way theme control (ticket 139; ThemeToggle card): Match device, Light, Dark, High contrast. A radio
 * group with one Tab stop: the arrow keys move the pick, which takes effect at once, and Home and End jump to the ends.
 * Match device is the default and follows the device live; any other pick sticks and is remembered on this device.
 */
const { t } = useI18n()
const { pick, setPick } = useThemePick()

const options = computed<{ value: ThemePick; icon: IconName; label: string }[]>(() => [
  { value: 'device', icon: 'device', label: t.value.theme.matchDevice },
  { value: 'light', icon: 'sun', label: t.value.theme.light },
  { value: 'dark', icon: 'moon', label: t.value.theme.dark },
  { value: 'contrast', icon: 'contrast', label: t.value.theme.contrast },
])

const buttons = ref<HTMLButtonElement[]>([])

async function choose(index: number) {
  const option = options.value[index]
  if (!option) return
  setPick(option.value)
  await nextTick()
  buttons.value[index]?.focus()
}

function onKeydown(event: KeyboardEvent) {
  const current = options.value.findIndex((option) => option.value === pick.value)
  const last = options.value.length - 1
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (current + 1) % options.value.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (current - 1 + options.value.length) % options.value.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined
  if (next === undefined) return
  event.preventDefault()
  void choose(next)
}
</script>

<template>
  <div class="theme-toggle" role="radiogroup" :aria-label="t.theme.groupLabel" data-testid="theme-toggle" @keydown="onKeydown">
    <AppTooltip v-for="(option, index) in options" :key="option.value" :text="option.label" :announce="false">
      <button
        ref="buttons"
        class="ui-control theme-toggle__option"
        type="button"
        role="radio"
        :aria-checked="pick === option.value"
        :aria-label="option.label"
        :tabindex="pick === option.value ? 0 : -1"
        :data-testid="`theme-${option.value}`"
        @click="choose(index)"
      >
        <AppIcon :name="option.icon" :size="15" />
      </button>
    </AppTooltip>
  </div>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  flex: none;
  gap: var(--space-2);
  box-sizing: border-box;
  height: var(--control-height);
  padding: var(--space-2);
  background: var(--button);
  border: 1px solid var(--button-line);
  border-radius: var(--radius-md);
}

.theme-toggle__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--expand-size);
  height: 100%;
  padding: 0;
  color: var(--subtle);
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.theme-toggle__option[aria-checked='true'] {
  color: var(--canvas);
  background: var(--ink);
}

@media (hover: hover) {
  .theme-toggle__option[aria-checked='false']:hover {
    color: var(--ink);
    background: var(--hover-fill);
  }
}

.theme-toggle__option:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
