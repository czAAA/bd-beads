<script setup lang="ts">
import { inTourCard } from '../../composables/ui/tourDom'
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import { findPaletteColor } from '../../domain/palette'
import type { Tool } from '../../domain/tool'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import PalettePicker from '../palette/PalettePicker.vue'
import { TOOL_ICONS, TOOL_ORDER } from '../tools/toolIcons'

/**
 * The design system's BottomToolbar (ticket 168; BottomToolbar card): the iPad mini tier's own toolbar, under the
 * thumb, so drawing never needs the Drawer -- the four tools, the current colour (a popover onto the Palette, since
 * the Drawer's own Colors group is otherwise the only place to change it), Undo and Redo. Same anatomy as the
 * phone Dock (ticket 79): 22px icons over 11px labels, the active tool in accent, `dock-height` (64px) plus the
 * bottom safe-area inset. Custom and Image colors stay Drawer-only -- the popover is the Palette alone.
 */
const props = defineProps<{
  activeTool: Tool
  selectedColorId?: string
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  'select-tool': [tool: Tool]
  'select-color': [colorId: string]
  undo: []
  redo: []
}>()

const { t } = useI18n()

function toolLabel(tool: Tool): string {
  return { paint: t.value.tools.paintLabel, fill: t.value.tools.fillLabel, select: t.value.tools.selectLabel, erase: t.value.tools.eraseLabel }[tool]
}

/** The same four tools Toolbox's own tabs list, in the same order (ToolTabs card). */
const tools = computed(() => TOOL_ORDER.map((id) => ({ id, icon: TOOL_ICONS[id], label: toolLabel(id) })))

const colorHex = computed(() => (props.selectedColorId ? findPaletteColor(props.selectedColorId)?.hex : undefined))

const open = ref(false)
const rootEl = ref<HTMLElement>()
const buttonEl = ref<HTMLElement>()
const popoverEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(buttonEl, popoverEl, () => 'start')

function onPointerDownOutside(event: PointerEvent) {
  if (rootEl.value && !rootEl.value.contains(event.target as Node) && !inTourCard(event.target)) close(false)
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onPointerDownOutside)
  anchored.stop()
  if (returnFocus) rootEl.value?.querySelector<HTMLElement>('[data-testid="bottom-toolbar-color"]')?.focus()
}

async function toggle() {
  if (open.value) {
    close(false)
    return
  }
  open.value = true
  document.addEventListener('pointerdown', onPointerDownOutside)
  await nextTick()
  buttonEl.value = rootEl.value?.querySelector<HTMLElement>('[data-testid="bottom-toolbar-color"]') ?? undefined
  anchored.follow()
}

function onSelectColor(colorId: string) {
  emit('select-color', colorId)
  close()
}

useEscapeLayer(() => open.value, () => close())
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDownOutside))
</script>

<template>
  <div ref="rootEl" class="bottom-toolbar" data-testid="bottom-toolbar">
    <button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      class="ui-control bottom-toolbar__item"
      :class="{ 'bottom-toolbar__item--active': activeTool === tool.id }"
      :data-testid="`bottom-toolbar-${tool.id}`"
      :data-tour="`tool-${tool.id}`"
      :aria-pressed="activeTool === tool.id"
      @click="emit('select-tool', tool.id)"
    >
      <AppIcon :name="tool.icon" :size="22" />
      <span class="bottom-toolbar__label">{{ tool.label }}</span>
    </button>

    <button
      ref="buttonEl"
      type="button"
      class="ui-control bottom-toolbar__item"
      data-testid="bottom-toolbar-color"
      data-tour="bottom-color"
      aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="t.toolbox.groups.colors"
      @click="toggle"
    >
      <span class="bottom-toolbar__swatch" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
      <span class="bottom-toolbar__label">{{ t.toolbox.groups.colors }}</span>
    </button>

    <button
      type="button"
      class="ui-control bottom-toolbar__item"
      data-testid="bottom-toolbar-undo"
      data-tour="undo"
      :disabled="!canUndo"
      @click="emit('undo')"
    >
      <AppIcon name="undo" :size="22" />
      <span class="bottom-toolbar__label">{{ t.palette.undoButton }}</span>
    </button>

    <button
      type="button"
      class="ui-control bottom-toolbar__item"
      data-testid="bottom-toolbar-redo"
      :disabled="!canRedo"
      @click="emit('redo')"
    >
      <AppIcon name="redo" :size="22" />
      <span class="bottom-toolbar__label">{{ t.palette.redoButton }}</span>
    </button>

    <div
      v-if="open"
      ref="popoverEl"
      class="bottom-toolbar__popover"
      role="dialog"
      :aria-label="t.toolbox.groups.colors"
      :style="anchored.style.value"
    >
      <PalettePicker :selected-color-id="selectedColorId" @select="onSelectColor" />
    </div>
  </div>
</template>

<style scoped>
/* Same anatomy as the phone Dock (ticket 79): 64px plus the bottom safe-area inset, 6 equal items. */
.bottom-toolbar {
  display: flex;
  align-items: stretch;
  height: var(--dock-height);
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--canvas);
  border-top: 1px solid var(--line-soft);
}

.bottom-toolbar__item {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-standard);
}

.bottom-toolbar__item--active {
  color: var(--accent-strong);
}

.bottom-toolbar__item:disabled {
  color: var(--faint);
  cursor: not-allowed;
}

.bottom-toolbar__label {
  font: var(--type-meta-tiny);
}

.bottom-toolbar__swatch {
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.bottom-toolbar__item:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: -2px;
}

.bottom-toolbar__popover {
  z-index: var(--z-popover);
  box-sizing: border-box;
  width: 14rem;
  padding: var(--space-12);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

:root[data-theme='contrast'] .bottom-toolbar__popover {
  border-width: 2px;
  box-shadow: none;
}
</style>
