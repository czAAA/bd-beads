<script setup lang="ts">
import AppButton from '../ui/AppButton.vue'
import AppMessage from '../ui/AppMessage.vue'
import AppDialogs from './AppDialogs.vue'
import CanvasPanel from '../canvas/CanvasPanel.vue'
import AppPanels from './AppPanels.vue'
import { useAppShell } from '../../composables/shell/useAppShell'

const {
  t,
  activeProject,
  saveFailed,
  announcement,
  framing,
  focusProject,
  endStroke,
  onExportProjectFile,
} = useAppShell()
</script>

<template>
  <div class="app-shell" @mouseup="endStroke" @pointerup="endStroke" @pointercancel="endStroke">
    <!-- Skip to Project (ticket 159): the first Tab stop, visible only while focused. -->
    <a v-if="activeProject && !framing" class="app-shell__skip" href="#project" data-testid="skip-to-project" @click.prevent="focusProject">
      {{ t.a11y.skipToProject }}
    </a>
    <!-- One polite announcement per action (ticket 159): the bead cursor's place, what the key just did. -->
    <p class="app-shell__announcer" role="status" aria-live="polite" data-testid="announcer">{{ announcement }}</p>

    <!--
      The notice row (ticket 141): library-wide notices sit directly under the header, full width, and the row takes no
      space while there is nothing to say. A failed write to this device's storage (ticket 55, ADR 0012) is one: it's
      about the whole Project library, not the open Project, and has to be visible whether or not one is open.
      It is a danger Message (ticket 76), announced the moment it appears, and it stays up until a save gets through
      (see useProjectLibrary's saveFailed): there's nothing to close, since the edit really isn't saved yet.
    -->
    <div v-if="saveFailed" class="app-shell__notices" data-testid="app-notices">
      <AppMessage tone="danger" placement="notice" :closable="false">
        <span data-testid="save-failed-message">{{ t.storage.saveFailedMessage }}</span>
        <template #actions>
          <AppButton variant="in-box" size="sm" icon="export" data-testid="save-failed-export" @click="onExportProjectFile">
            {{ t.saveBox.exportProjectFile }}
          </AppButton>
        </template>
      </AppMessage>
    </div>

    <div class="app-shell__body">
      <CanvasPanel />
    </div>

    <AppPanels />

    <AppDialogs />

  </div>
</template>

<style scoped>
/* The app shell (ticket 141, ADR 0021): notice row, then the body, filling the screen. The page never scrolls; the
 * Project scrolls inside the canvas box. */
.app-shell {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  /* Pinned to the screen, not sized by 100dvh: iOS's dvh can fall short of the screen and leave a band under the
   * Dock. */
  position: fixed;
  inset: 0;
  /* clip, not hidden: nothing, not even a focus() on a sheet placed off-screen, may scroll the shell and push the
   * Canvas strip out of view (iPad Safari). hidden stays as the fallback where clip is unknown (Safari before 16),
   * with the sheets' preventScroll focus covering it there. */
  overflow: hidden;
  overflow: clip;
  background: var(--canvas);
}

.app-shell__skip {
  position: absolute;
  top: var(--space-8);
  left: var(--space-8);
  z-index: var(--z-tooltip);
  padding: var(--space-8) var(--space-12);
  font: var(--type-control);
  color: var(--ink);
  background: var(--canvas);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  transform: translateY(-200%);
}

.app-shell__skip:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
  transform: none;
}

/* Heard, not seen. */
.app-shell__announcer {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* The notice row above the canvas box, full width; it only exists while there is something to say. */
.app-shell__notices {
  flex: none;
  padding: var(--space-8) var(--space-16) 0;
}

/* Body (tickets 383, 439, 513, ADR 0046): the canvas box is the screen, flush with every edge except where the device's
 * safe-area inset (notch, rounded corners, home indicator) takes room. */
.app-shell__body {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;
  position: relative;
  --body-inset: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  padding: var(--body-inset);
}

/* Ticket 450, 513: a transparent frame over the body's padding (the safe-area band; nothing on a device without an
 * inset) with `touch-action: none`, so a drag there pans nothing. A frame,
 * not touch-action on the body, which would reach the canvas box too. */
.app-shell__body::before {
  content: '';
  position: absolute;
  inset: 0;
  border-style: solid;
  border-color: transparent;
  border-width: var(--body-inset);
  touch-action: none;
}
</style>
