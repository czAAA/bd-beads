<script setup lang="ts">
import { computed } from 'vue'
import { usePalette } from '../../composables/tools/usePalette'
import type { Tool } from '../../domain/tool'
import type { InputMode } from '../../domain/inputMode'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'
import { FRAME_HOTKEY, TOOL_HOTKEYS, TOOL_ICONS } from './toolIcons'
import type { PhoneSheet } from '../../composables/shell/phoneSheet'

/**
 * The design system's Dock (ticket 79, 295; Dock card): the phone layout's five icon-only buttons, one per sheet: Tool,
 * Colour, Frame, Project and Menu. 48px plus the bottom safe-area inset, at most 480px wide and centred, in portrait
 * and landscape alike (ADR 0032). Each button's name is its accessible name and its Tooltip; there are no text labels.
 */
const props = defineProps<{
  activeTool: Tool
  selectedColorId?: string
  openSheet: PhoneSheet | null
  /** Whether the Frame is being set: its button sits on `panel` like an open sheet's (Dock card). */
  settingFrame?: boolean
  /** Pen mode or Mouse mode (ticket 325): its toggle is the Dock's first button; absent, the device has no use for it and there is none. */
  inputMode?: InputMode
}>()

const emit = defineEmits<{ 'select-sheet': [sheet: PhoneSheet]; 'toggle-input-mode': [] }>()

const { t } = useI18n()

function toolLabel(tool: Tool): string {
  return { paint: t.value.tools.paintLabel, fill: t.value.tools.fillLabel, select: t.value.tools.selectLabel, erase: t.value.tools.eraseLabel, hand: t.value.tools.handLabel }[tool]
}

const activeToolInfo = computed(() => ({ icon: TOOL_ICONS[props.activeTool], label: toolLabel(props.activeTool) }))
const palette = usePalette()
const colorHex = computed(() => (props.selectedColorId ? palette.value.find((color) => color.id === props.selectedColorId)?.hex : undefined))

/** The first button's and Frame's hotkey corner (Dock card, ticket 275): the Toolbox's own keys, `aria-hidden`. Colour, Project and Menu are not tools, so they have none. */
const items = computed<{ id: PhoneSheet; icon: IconName; label: string; testid: string; key?: string }[]>(() => [
  { id: 'tool', icon: activeToolInfo.value.icon, label: activeToolInfo.value.label, testid: 'dock-tool', key: TOOL_HOTKEYS[props.activeTool] },
  { id: 'color', icon: 'palette', label: t.value.toolbox.groups.colors, testid: 'dock-color' },
  { id: 'frame', icon: 'frame', label: t.value.frame.title, testid: 'dock-frame', key: FRAME_HOTKEY },
  { id: 'project', icon: 'pattern', label: t.value.header.projectSheetLabel, testid: 'dock-project' },
  { id: 'menu', icon: 'menu', label: t.value.header.menuButton, testid: 'dock-menu' },
])

/** Set Frame is a mode, so the Frame button lights up while it is on (ticket 258). */
function frameOn(id: string): boolean {
  return id === 'frame' && !!props.settingFrame
}
</script>

<template>
  <nav class="dock" :aria-label="t.a11y.toolsLandmark" data-testid="dock">
    <AppTooltip v-if="inputMode" class="dock__slot" :name="inputMode === 'pen' ? t.inputMode.penLabel : t.inputMode.mouseLabel" :body="inputMode === 'pen' ? t.inputMode.penHint : t.inputMode.mouseHint" placement="top" :announce="false">
      <button
        type="button"
        class="ui-control dock__item dock__item--accent dock__item--toggle"
        :aria-label="inputMode === 'pen' ? t.inputMode.penLabel : t.inputMode.mouseLabel"
        :aria-pressed="inputMode === 'pen'"
        data-testid="dock-input-mode"
        @click="emit('toggle-input-mode')"
      >
        <AppIcon :name="inputMode === 'pen' ? 'pen-mode' : 'pen-mode-off'" :size="22" />
      </button>
    </AppTooltip>
    <AppTooltip v-for="item in items" :key="item.id" class="dock__slot" :name="item.label" placement="top" :announce="false">
      <button
        type="button"
        class="ui-control dock__item"
        :class="{ 'dock__item--open': openSheet === item.id || frameOn(item.id), 'dock__item--accent': item.id === 'tool', 'dock__item--frame-on': frameOn(item.id) }"
        :aria-label="item.label"
        :aria-pressed="openSheet === item.id"
        :aria-keyshortcuts="item.key"
        :data-testid="item.testid"
        :data-tour="`dock-${item.id}`"
        @click="emit('select-sheet', item.id)"
      >
        <span v-if="item.id === 'color'" class="dock__swatch" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
        <AppIcon v-else :name="item.icon" :size="22" />
        <span v-if="item.key" class="dock__key" :class="{ 'dock__key--accent': item.id === 'tool' || frameOn(item.id) }" aria-hidden="true">{{ item.key }}</span>
      </button>
    </AppTooltip>
  </nav>
</template>

<style scoped>
.dock {
  display: flex;
  align-items: stretch;
  box-sizing: content-box;
  width: 100%;
  max-width: var(--dock-max-width);
  height: var(--dock-height);
  margin: 0 auto;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--canvas);
  border-top: 1px solid var(--line-soft);
}

/* The Tooltip's wrapper is the slot; the button fills it. */
.dock__slot {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
}

.dock__item {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}

/* The first button's and Frame's hotkey corner (Dock card): DM Mono 12px, 3px from the top, 6px from the right. */
.dock__key {
  position: absolute;
  top: 3px;
  right: var(--space-6);
  font: var(--type-meta-small);
  line-height: 1;
  color: var(--muted);
}

.dock__key--accent {
  color: var(--accent-strong);
}

.dock__item--accent {
  color: var(--accent-strong);
}

/* The selected tool is marked by the same 2px accent underline as the Toolbox tabs (ticket 292). */
.dock__item--accent:not(.dock__item--toggle)::after,
.dock__item--frame-on::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--accent-strong);
}

.dock__item--open {
  color: var(--ink);
  background: var(--panel);
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
</style>
