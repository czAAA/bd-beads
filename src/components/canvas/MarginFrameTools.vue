<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { controlDeps } from '../../composables/shell/controlRegistry'
import type { FrameEdge } from '../../domain/frame'
import type { FrameSettings } from '../../domain/frameShape'
import type { FrameId } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import MenuButton from '../ui/MenuButton.vue'
import FramePopover from './FramePopover.vue'
import type { FrameToolItem } from './framePopoverTools'

/** The margin sheet's **···** Frame settings button (MarginSheet card, Several Frames; ticket 1222): always on the sheet, in
 * the band's row or, where the sheet is bare, beside the Move bar (ticket 1164). It opens one popover with everything
 * about the Frame, wherever it stands. `asked` opens it from elsewhere (the Frame stays toast's Open Frame). */
const props = defineProps<{
  project: Project
  items: readonly FrameToolItem[]
  deps: ReturnType<typeof controlDeps>
  /** The Frame whose sheet this is (ticket 1220): the Export panel hangs from this button when it asked. */
  frame: FrameId
  asked?: boolean
}>()
const emit = defineEmits<{
  step: [edge: FrameEdge, step: 1 | -1]
  resize: [columns: number, rows: number]
  'set-settings': [change: FrameSettings]
  'reset-progress': []
  settle: []
  /** `asked` was heard: the popover is open. */
  opened: []
}>()

const { t } = useI18n()
const menu = ref<InstanceType<typeof MenuButton>>()
watch(
  () => props.asked,
  async (asked) => {
    if (!asked) return
    await nextTick()
    menu.value?.show()
    emit('opened')
  },
  { immediate: true },
)
</script>

<template>
  <MenuButton
    ref="menu"
    variant="plain"
    class="margin-sheet__tool"
    icon="more"
    icon-only
    popover
    popover-width="var(--frame-popover-width)"
    :label="t.frame.margin.frameTools"
    align="end"
    :data-frame="frame"
    data-testid="margin-frame-tools"
  >
    <FramePopover
      :project="project"
      :frame="frame"
      :items="items"
      :deps="deps"
      @step="(edge, step) => emit('step', edge, step)"
      @resize="(columns, rows) => emit('resize', columns, rows)"
      @set-settings="emit('set-settings', $event)"
      @reset-progress="emit('reset-progress')"
      @settle="emit('settle')"
    />
  </MenuButton>
</template>
