<script setup lang="ts">
import { computed } from 'vue'
import { usePalette } from '../../composables/tools/usePalette'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { Tool } from '../../domain/tool'
import type { InputMode } from '../../domain/inputMode'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import { DOCK_TOOLS, TOOL_HOTKEYS } from './toolIcons'
import { MIRROR_ENABLED } from '../../features'
import type { PhoneSheet } from '../../composables/shell/phoneSheet'

/**
 * The design system's Dock (ticket 79, 295, 336, 431; Dock card): the six tool tiles, a divider, the colour button and,
 * where the device needs it, a second divider and the Pen/Mouse toggle (ADR 0055). A tile picks its tool at once; the
 * colour button shows the chosen colour and opens the Colour sheet. Menu and Project live in the Canvas strip. 48px plus
 * the bottom safe-area inset (at most 4px), at most 480px wide and centred, in portrait and landscape alike (ADR 0032). Each is an
 * IconButton showing a registry action, so its name, Tooltip and key come from there; there are no text labels.
 */
const props = defineProps<{
  activeTool: Tool
  selectedColorId?: string
  openSheet: PhoneSheet | null
  /** Pen mode or Mouse mode (ticket 325): its toggle is the Dock's last button; absent, the device has no use for it and there is none. */
  inputMode?: InputMode
}>()

const emit = defineEmits<{ 'select-tool': [tool: Tool]; 'select-sheet': [sheet: PhoneSheet]; 'toggle-input-mode': [] }>()

const { t } = useI18n()

const palette = usePalette()
const colorHex = computed(() => (props.selectedColorId ? palette.value.find((color) => color.id === props.selectedColorId)?.hex : undefined))

/** The input mode toggle's face is the current mode. */
const inputModeAction = computed(() => (props.inputMode ? controlAction(props.inputMode === 'pen' ? 'pen-mode' : 'mouse-mode') : undefined))

/** The tool tiles, in the Dock's fixed order. */
const tiles = DOCK_TOOLS.map((tool) => ({ tool, action: controlAction(`tool-${tool}`), key: TOOL_HOTKEYS[tool] }))
const colorAction = controlAction('dock-colors')
const mirrorAction = MIRROR_ENABLED ? controlAction('dock-mirror') : undefined
</script>

<template>
  <nav class="dock" :aria-label="t.a11y.toolsLandmark" data-testid="dock">
    <IconButton
      v-for="tile in tiles"
      :key="tile.tool"
      variant="dock"
      :action="tile.action"
      :tooltip="{ placement: 'top' }"
      :hotkey="tile.key"
      show-hotkey
      :selected="activeTool === tile.tool"
      :accent="activeTool === tile.tool"
      :marked="activeTool === tile.tool"
      :data-testid="`dock-tool-${tile.tool}`"
      :data-tour="`tool-${tile.tool}`"
      @click="emit('select-tool', tile.tool)"
    />
    <span class="dock__divider" role="presentation" />
    <IconButton
      variant="dock"
      :action="colorAction"
      icon="palette"
      :tooltip="{ placement: 'top' }"
      :selected="openSheet === 'color'"
      data-testid="dock-color"
      data-tour="dock-color"
      @click="emit('select-sheet', 'color')"
    >
      <span class="dock__swatch" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
    </IconButton>
    <IconButton
      v-if="mirrorAction"
      variant="dock"
      :action="mirrorAction"
      icon="mirror-horizontal"
      :tooltip="{ placement: 'top' }"
      :selected="openSheet === 'mirror'"
      data-testid="dock-mirror"
      @click="emit('select-sheet', 'mirror')"
    />
    <template v-if="inputMode && inputModeAction">
      <span class="dock__divider" role="presentation" />
      <IconButton
        variant="dock"
        :action="inputModeAction"
        :tooltip="{ placement: 'top' }"
        accent
        :aria-pressed="inputMode === 'pen'"
        data-testid="dock-input-mode"
        @click="emit('toggle-input-mode')"
      />
    </template>
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
  /* Capped at 4px: the home indicator's full inset (34px on an iPhone) is a wide empty band under 48px tiles. */
  padding-bottom: min(env(safe-area-inset-bottom), var(--space-4));
  background: var(--canvas);
  border-top: 1px solid var(--line-soft);
}

/* A phone under 400px: tiles of at most the touch target (44px) that may shrink a little, with no digit badges, so six tools, the colour button, Pen/Mouse and both dividers fit 360px. */
@media (max-width: 399px) {
  .dock {
    justify-content: center;
  }

  .dock :deep(.icon-btn-wrap--dock) {
    flex: 0 1 var(--touch-target);
  }

  .dock :deep(.icon-btn__key) {
    display: none;
  }
}

.dock__divider {
  flex: none;
  align-self: center;
  width: 1px;
  height: var(--space-24);
  background: var(--line-soft);
}

.dock__swatch {
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}
</style>
