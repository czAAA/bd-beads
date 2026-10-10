<script setup lang="ts">
import { computed } from 'vue'
import { usePalette } from '../../composables/tools/usePalette'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { Tool } from '../../domain/tool'
import type { InputMode } from '../../domain/inputMode'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import { FRAME_HOTKEY, TOOL_HOTKEYS } from './toolIcons'
import { MIRROR_ENABLED } from '../../features'
import type { PhoneSheet } from '../../composables/shell/phoneSheet'

/**
 * The design system's Dock (ticket 79, 295, 336; Dock card): the phone layout's five icon-only buttons, one per sheet:
 * Tool, Colour, Frame, Project and Menu. 48px plus the bottom safe-area inset, at most 480px wide and centred, in portrait
 * and landscape alike (ADR 0032). Each is an IconButton showing a registry action, so its name, Tooltip and key come
 * from there; there are no text labels.
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

const palette = usePalette()
const colorHex = computed(() => (props.selectedColorId ? palette.value.find((color) => color.id === props.selectedColorId)?.hex : undefined))

/** The input mode toggle's face is the current mode. */
const inputModeAction = computed(() => (props.inputMode ? controlAction(props.inputMode === 'pen' ? 'pen-mode' : 'mouse-mode') : undefined))

const activeToolAction = computed(() => controlAction(`tool-${props.activeTool}`))

/** The first button shows the active tool's own icon, name and key, and its Tooltip lists the tools; Frame carries its own key (Dock card, ticket 275). */
const slots = computed<{ id: PhoneSheet; action: ReturnType<typeof controlAction>; label?: string; icon?: ReturnType<typeof controlAction>['icon']; key?: string; testid: string }[]>(() => [
  { id: 'tool', action: controlAction('dock-tool'), label: activeToolAction.value.name(t.value), icon: activeToolAction.value.icon, key: TOOL_HOTKEYS[props.activeTool], testid: 'dock-tool' },
  { id: 'color', action: controlAction('dock-colors'), icon: 'palette', testid: 'dock-color' },
  ...(MIRROR_ENABLED ? [{ id: 'mirror' as const, action: controlAction('dock-mirror'), icon: 'mirror-horizontal' as const, testid: 'dock-mirror' }] : []),
  { id: 'frame', action: controlAction('dock-frame'), icon: 'frame', key: FRAME_HOTKEY, testid: 'dock-frame' },
  { id: 'project', action: controlAction('dock-project'), icon: 'pattern', testid: 'dock-project' },
  { id: 'menu', action: controlAction('dock-menu'), icon: 'menu', testid: 'dock-menu' },
])

/** Set Frame is a mode, so the Frame button lights up while it is on (ticket 258). */
function frameOn(id: string): boolean {
  return id === 'frame' && !!props.settingFrame
}
</script>

<template>
  <nav class="dock" :aria-label="t.a11y.toolsLandmark" data-testid="dock">
    <IconButton
      v-if="inputMode && inputModeAction"
      variant="dock"
      :action="inputModeAction"
      :tooltip="{ placement: 'top' }"
      accent
      :aria-pressed="inputMode === 'pen'"
      data-testid="dock-input-mode"
      @click="emit('toggle-input-mode')"
    />
    <IconButton
      v-for="slot in slots"
      :key="slot.id"
      variant="dock"
      :action="slot.action"
      :label="slot.label"
      :icon="slot.icon"
      :tooltip="{ placement: 'top' }"
      :hotkey="slot.key"
      show-hotkey
      :selected="openSheet === slot.id || frameOn(slot.id)"
      :accent="slot.id === 'tool'"
      :marked="slot.id === 'tool' || frameOn(slot.id)"
      :data-testid="slot.testid"
      :data-tour="`dock-${slot.id}`"
      @click="emit('select-sheet', slot.id)"
    >
      <span v-if="slot.id === 'color'" class="dock__swatch" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
    </IconButton>
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

.dock__swatch {
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}
</style>
