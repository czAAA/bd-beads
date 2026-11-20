<script setup lang="ts">
import type { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import AppMenuItem from '../ui/AppMenuItem.vue'
import MenuButton from '../ui/MenuButton.vue'

/** One tool of the Frame tools menu: its action, what pressing it runs, and Mirror the whole Frame's check. */
export interface FrameToolItem {
  id: string
  action: ReturnType<typeof controlAction>
  run: () => void
  checked?: boolean
}

/** The margin sheet's **···** Frame tools button (MarginSheet card, Zoom forms): the tools the band shows no button
 * for, in the band's row or, where the sheet is bare, beside the Move bar (ticket 1164). One menu, wherever it stands. */
const props = defineProps<{
  items: readonly FrameToolItem[]
  deps: ReturnType<typeof controlDeps>
}>()

const { t } = useI18n()
const disabled = (item: FrameToolItem) => (item.action.enabled ? !item.action.enabled(props.deps) : false)
</script>

<template>
  <MenuButton variant="plain" class="margin-sheet__tool" icon="more" icon-only :label="t.frame.margin.frameTools" align="end" data-testid="margin-frame-tools">
    <AppMenuItem
      v-for="item in items"
      :key="item.id"
      :icon="item.action.icon"
      :disabled="disabled(item)"
      :name="item.action.name(t)"
      :disabled-body="disabled(item) ? item.action.disabledBody?.(t, deps) : undefined"
      :checked="item.checked"
      :data-testid="`margin-frame-tools-${item.id}`"
      :data-rotate-from="item.id === 'rotate' ? 'menu' : undefined"
      @select="item.run()"
    >
      {{ item.action.name(t) }}
    </AppMenuItem>
  </MenuButton>
</template>
