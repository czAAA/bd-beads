<script setup lang="ts">
import { computed } from 'vue'
import { findPaletteColor } from '../domain/palette'
import type { Tool } from '../domain/tool'
import { useI18n } from '../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'
import { TOOL_ICONS } from './toolIcons'

/** Which of the Dock's five ToolSheets is open, or none (App.vue's own routing state -- not a domain concept). */
export type PhoneSheet = 'tool' | 'color' | 'edit' | 'size' | 'pattern'

/**
 * The design system's Dock (ticket 79; Dock card): the phone's five buttons, one per kind of tool, each opening its
 * own ToolSheet (ticket 174 dropped Mirror's, pending its own redesign). 64px plus the bottom safe-area inset in
 * portrait; a 64px left rail, safe-area by the side insets, once the screen is short (landscape, `bp-phone-landscape`
 * 499px -- BottomToolbar's own media query, since the two share this exact breakpoint and anatomy).
 */
const props = defineProps<{
  activeTool: Tool
  selectedColorId?: string
  openSheet: PhoneSheet | null
}>()

const emit = defineEmits<{ 'select-sheet': [sheet: PhoneSheet] }>()

const { t } = useI18n()

function toolLabel(tool: Tool): string {
  return { paint: t.value.tools.paintLabel, fill: t.value.tools.fillLabel, select: t.value.tools.selectLabel, erase: t.value.tools.eraseLabel }[tool]
}

const activeToolInfo = computed(() => ({ icon: TOOL_ICONS[props.activeTool], label: toolLabel(props.activeTool) }))
const colorHex = computed(() => (props.selectedColorId ? findPaletteColor(props.selectedColorId)?.hex : undefined))

const items = computed<{ id: PhoneSheet; icon: IconName; label: string; testid: string }[]>(() => [
  { id: 'tool', icon: activeToolInfo.value.icon, label: activeToolInfo.value.label, testid: 'dock-tool' },
  { id: 'color', icon: 'paint', label: t.value.toolbox.groups.colors, testid: 'dock-color' },
  { id: 'edit', icon: 'undo', label: t.value.toolbox.groups.edit, testid: 'dock-edit' },
  { id: 'size', icon: 'size', label: t.value.toolbox.groups.size, testid: 'dock-size' },
  { id: 'pattern', icon: 'save', label: t.value.header.patternSheetLabel, testid: 'dock-pattern' },
])
</script>

<template>
  <nav class="dock" :aria-label="t.a11y.toolsLandmark" data-testid="dock">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="ui-control dock__item"
      :class="{ 'dock__item--open': openSheet === item.id, 'dock__item--accent': item.id === 'tool' }"
      :aria-pressed="openSheet === item.id"
      :data-testid="item.testid"
      @click="emit('select-sheet', item.id)"
    >
      <span v-if="item.id === 'color'" class="dock__swatch" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
      <AppIcon v-else :name="item.icon" :size="22" />
      <span class="dock__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.dock {
  display: flex;
  align-items: stretch;
  height: var(--dock-height);
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--canvas);
  border-top: 1px solid var(--line-soft);
}

.dock__item {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 3.75rem;
  padding: 0;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}

.dock__item--accent {
  color: var(--accent-strong);
}

.dock__item--open {
  color: var(--ink);
  background: var(--panel);
}

.dock__label {
  font: var(--type-meta-tiny);
  white-space: nowrap;
}

.dock__swatch {
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.dock__item:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: -2px;
}

/*
 * Landscape (responsive.md, height up to bp-phone-landscape): a 64px rail on the left edge, below the header (its
 * own media query drops to 44px there) rather than under the Pattern -- position: fixed takes it out of the
 * app shell's flex column entirely, since App.vue only knows how to stack it below the body, not beside it.
 * App.vue's own .app-shell__body padding leaves it room (its own matching media query).
 */
@media (max-width: 743px) and (max-height: 499px) {
  .dock {
    position: fixed;
    top: var(--header-height-phone-landscape);
    right: auto;
    bottom: 0;
    left: 0;
    z-index: var(--z-chrome);
    flex-direction: column;
    height: auto;
    padding-bottom: 0;
    padding-left: env(safe-area-inset-left);
    border-top: 0;
    border-right: 1px solid var(--line-soft);
  }

  .dock__item {
    width: auto;
  }
}
</style>
