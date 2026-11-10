<script setup lang="ts">
import CanvasPanel from '../../components/canvas/CanvasPanel.vue'
import AppPanels from '../../components/shell/AppPanels.vue'
import AppDialogs from '../../components/shell/AppDialogs.vue'
import { provideAppShell } from '../../composables/shell/useAppShell'
import type { Project } from '../../domain/project'
import { memoryServices } from '../../services/memoryServices'
import { MARGIN_PX } from '../../rendering/marginSizes'
import { provideMarginLeastScale } from '../../theme/useCanvasBackground'

// The editor in What's inside (Homepage card, ticket 0797): the editor's own wiring (ADR 0020) on services of its own in
// memory, and the shell's own parts drawing on it, so every press in it is real editing of the demo Project. It is
// AppShell less what belongs to the page: the notice row (nothing here is saved) and the picture drop over the screen.
const props = defineProps<{
  /** The demo's library to start on. */
  projects: Project[]
  /** Which word its Canvas strip's Expand button reads (ticket 0830); none where the demo has the width already. */
  expand?: 'expand' | 'collapse'
}>()
const emit = defineEmits<{
  /** New Project in its Menu: the demo starts afresh. */
  startAfresh: []
  /** Expand or Collapse pressed in its Canvas strip. */
  toggleExpand: []
}>()

const wired = provideAppShell(memoryServices(props.projects), {
  demo: { startAfresh: () => emit('startAfresh'), expand: () => props.expand, toggleExpand: () => emit('toggleExpand') },
})
// Its Frame's sheet shrinks rather than go bare: the demo's view is set for its box and the tour presses the band.
provideMarginLeastScale(MARGIN_PX.scale.demo)
const { announcement, endStroke } = wired.shell

/** The wiring, for the tour to work the demo through the same flows a press reaches. */
defineExpose({ wired })
</script>

<template>
  <div class="inside-shell" @mouseup="endStroke" @pointerup="endStroke" @pointercancel="endStroke">
    <p class="inside-shell__announcer" role="status" aria-live="polite">{{ announcement }}</p>
    <div class="inside-shell__body">
      <CanvasPanel />
    </div>
    <AppPanels />
    <AppDialogs />
  </div>
</template>

<style scoped>
/* The demo's shell fills its box, as AppShell fills the screen. */
.inside-shell {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--canvas);
}

.inside-shell__announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.inside-shell__body {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;
}
</style>
