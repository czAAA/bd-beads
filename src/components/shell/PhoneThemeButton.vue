<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import { useI18n } from '../../i18n/useI18n'
import type { ThemePick } from '../../theme/theme'
import { useThemePick } from '../../theme/useThemePick'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'
import ThemeToggle from './ThemeToggle.vue'

/**
 * The phone header's own Theme control (redesign-feedback.md): a single icon button showing the current pick, so
 * the header's second row never needs the full four-way ThemeToggle's own 34px-wide bar. Opens the real ThemeToggle
 * (ThemeToggle card: a radio group, one Tab stop, arrow keys move) in a small popover under it, closing on a choice,
 * Escape or a press outside -- the same shape as AppMenu's own popup, without forcing a visible label onto the
 * trigger the way AppMenu's button always does.
 *
 * The ThemeToggle card's own written spec has "Phone and iPad mini: More -> Theme opens a sheet with the four
 * options as rows" -- this popover is this pass's own replacement for that sheet on phone specifically (the More
 * menu's Theme row is now iPad-mini-only, see App.vue), asked for directly by redesign-feedback.md's "singular icon
 * with current and some sort of selector on click." The card doc still wants updating to match, through the design
 * system on claude.ai (DESIGN.md §6) rather than by hand here.
 */
const { t } = useI18n()
const { pick } = useThemePick()

const ICONS: Record<ThemePick, IconName> = { device: 'device', light: 'sun', dark: 'moon', contrast: 'contrast' }
const LABELS = computed<Record<ThemePick, string>>(() => ({
  device: t.value.theme.matchDevice,
  light: t.value.theme.light,
  dark: t.value.theme.dark,
  contrast: t.value.theme.contrast,
}))

const triggerLabel = computed(() => `${t.value.theme.groupLabel}: ${LABELS.value[pick.value]}`)

const open = ref(false)
const buttonEl = ref<HTMLElement>()
const panelEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(buttonEl, panelEl, () => 'end')

function onPointerDownOutside(event: PointerEvent) {
  const target = event.target as Node
  if (buttonEl.value?.contains(target)) return
  if (panelEl.value && !panelEl.value.contains(target)) close()
}

function close() {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onPointerDownOutside)
  anchored.stop()
}

async function toggle() {
  if (open.value) {
    close()
    return
  }
  open.value = true
  document.addEventListener('pointerdown', onPointerDownOutside)
  await nextTick()
  anchored.follow()
}

// A choice closes the popover, the same as AppMenu's own items do -- ThemeToggle itself has no "chosen" emit (it
// writes straight to the shared pick), so this is the one clean point to watch instead.
watch(pick, () => close())

useEscapeLayer(() => open.value, close)
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDownOutside))
</script>

<template>
  <span class="phone-theme">
    <AppTooltip :text="triggerLabel" :announce="false">
      <button
        ref="buttonEl"
        type="button"
        class="ui-control icon-btn icon-btn--round"
        :aria-label="triggerLabel"
        aria-haspopup="true"
        :aria-expanded="open"
        data-testid="phone-theme-button"
        @click="toggle"
      >
        <AppIcon :name="ICONS[pick]" :size="16" />
      </button>
    </AppTooltip>
    <Transition name="phone-theme">
      <div v-if="open" ref="panelEl" class="phone-theme__panel" :style="anchored.style.value">
        <ThemeToggle />
      </div>
    </Transition>
  </span>
</template>

<style scoped>
.phone-theme {
  position: relative;
  display: inline-flex;
}

.phone-theme__panel {
  position: fixed;
  z-index: var(--z-popover);
  box-sizing: border-box;
  padding: var(--space-4);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

:root[data-theme='contrast'] .phone-theme__panel {
  border-width: 2px;
  box-shadow: none;
}

/* Fades and drops in, the same shape as the Menu card's own popup (AppMenu.vue). */
.phone-theme-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.phone-theme-leave-active {
  transition:
    opacity calc(var(--duration-base) * 0.75) var(--ease-in),
    transform calc(var(--duration-base) * 0.75) var(--ease-in);
}

.phone-theme-enter-from,
.phone-theme-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--space-4)));
}

@media (prefers-reduced-motion: reduce) {
  .phone-theme-enter-from,
  .phone-theme-leave-to {
    transform: none;
  }
}
</style>
