<script setup lang="ts">
import AppButton from './AppButton.vue'
import AppMessage from './AppMessage.vue'
import AppBottomBar from './AppBottomBar.vue'
import AppDialogs from './AppDialogs.vue'
import AppHeader from './AppHeader.vue'
import AppSidebar from './AppSidebar.vue'
import CanvasPanel from './CanvasPanel.vue'
import PhoneSheets from './PhoneSheets.vue'
import { useAppShell } from '../composables/useAppShell'

const {
  t,
  activePattern,
  saveFailed,
  announcement,
  framing,
  focusPattern,
  endStroke,
  onExportPatternFile,
} = useAppShell()
</script>

<template>
  <div class="app-shell" @mouseup="endStroke" @pointerup="endStroke" @pointercancel="endStroke">
    <!-- Skip to Pattern (ticket 159): the first Tab stop, visible only while focused. -->
    <a v-if="activePattern && !framing" class="app-shell__skip" href="#pattern" data-testid="skip-to-pattern" @click.prevent="focusPattern">
      {{ t.a11y.skipToPattern }}
    </a>
    <!-- One polite announcement per action (ticket 159): the bead cursor's place, what the key just did. -->
    <p class="app-shell__announcer" role="status" aria-live="polite" data-testid="announcer">{{ announcement }}</p>
    <AppHeader />

    <!--
      The notice row (ticket 141): library-wide notices sit directly under the header, full width, and the row takes no
      space while there is nothing to say. A failed write to this device's storage (ticket 55, ADR 0012) is one: it's
      about the whole Pattern library, not the open Pattern, and has to be visible whether or not one is open.
      It is a danger Message (ticket 76), announced the moment it appears, and it stays up until a save gets through
      (see usePatternLibrary's saveFailed): there's nothing to close, since the edit really isn't saved yet.
    -->
    <div v-if="saveFailed" class="app-shell__notices" data-testid="app-notices">
      <AppMessage tone="danger" placement="notice" :closable="false">
        <span data-testid="save-failed-message">{{ t.storage.saveFailedMessage }}</span>
        <template #actions>
          <AppButton variant="in-box" size="sm" icon="export" data-testid="save-failed-export" @click="onExportPatternFile">
            {{ t.saveBox.exportPatternFile }}
          </AppButton>
        </template>
      </AppMessage>
    </div>

    <div class="app-shell__body">
      <AppSidebar />
      <CanvasPanel />
    </div>

    <AppBottomBar />

    <PhoneSheets />

    <AppDialogs />
  </div>
</template>

<style scoped>
/*
 * The app shell (ticket 141, ADR 0021): header, notice row, then the body, filling the screen exactly. The page itself
 * never scrolls: the left column scrolls on its own, and the Pattern scrolls inside the canvas box, so the header, the
 * Toolbox's top and the canvas box's own top and bottom stay in view on a Pattern of any size.
 */
.app-shell {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100dvh;
  position: relative;
  overflow: hidden;
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

/* The notice row under the header, full width; it only exists while there is something to say. */
.app-shell__notices {
  flex: none;
  padding: var(--space-16) var(--space-32) 0;
}

/*
 * The body: the 326px left column (312px boxes plus a 14px gutter for its thin scrollbar) and the canvas box, which
 * takes all the remaining width and the full height (ticket 141; `responsive.md`, MacBook Air tier). minmax(0, 1fr)
 * lets the canvas box shrink below its content instead of pushing the page wider.
 */
.app-shell__body {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: var(--column-width) minmax(0, 1fr);
  gap: var(--space-14);
  min-height: 0;
  padding: var(--space-24) var(--space-32);
}

/*
 * iPad 13" tier (ticket 167; responsive.md, `bp-tablet-lg` 1024px to just under `bp-laptop`): the column docks again
 * at 300px (286px boxes, the same 14px scrollbar gutter as the reference tier), page padding drops to 16px all
 * round, and the boxes sit 12px apart instead of 16px. Every other tier below this is built from here down, as a
 * further override at its own literal breakpoint (responsive.md can't be read from a custom property).
 */
@media (min-width: 1024px) and (max-width: 1279px) {
  .app-shell__body {
    grid-template-columns: var(--column-width-tablet-lg) minmax(0, 1fr);
    padding: var(--space-16);
  }
}

/*
 * 24" and larger tier (ticket 83; responsive.md, `bp-desktop` 1920px and up): the column grows to 360px (344px boxes,
 * the same 14px scrollbar gutter) and the page padding to 32 / 40 (there is no 40px spacing token: 2.5rem). Type and
 * controls keep their size -- the extra width goes to the canvas box, never to bigger chrome.
 */
@media (min-width: 1920px) {
  .app-shell__body {
    grid-template-columns: var(--column-width-desktop) minmax(0, 1fr);
    padding: var(--space-32) 2.5rem;
  }

  .app-shell__notices {
    padding-right: 2.5rem;
    padding-left: 2.5rem;
  }
}

/*
 * iPad mini and phone tiers (ticket 168, 79; responsive.md, under `bp-tablet-lg` 1024px): the column leaves the grid
 * track entirely. 744-1023px, the Drawer wrapping it switches to `position: fixed` (AppDrawer.vue's own media query)
 * and floats over the canvas box instead; under 744px AppDrawer hides it altogether -- the phone tier's Dock and
 * ToolSheets reach the same controls through their own, separate markup instead (Toolbox/SaveBox/Beads
 * needed/Saved Patterns stay mounted inside the hidden Drawer, just not visibly). Either way the canvas box takes
 * the whole row on its own.
 */
@media (max-width: 1023px) {
  .app-shell__body {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* The phone tier (ticket 79): tighter page padding; a phone on its side leaves room for the Dock's own left rail (AppDock.vue's matching media query -- position: fixed, so it needs this padding rather than a flex/grid track). */
@media (max-width: 743px) {
  .app-shell__body {
    padding: var(--space-16);
  }
}

@media (max-width: 743px) and (max-height: 499px) {
  .app-shell__body {
    padding-left: calc(4rem + env(safe-area-inset-left));
  }
}
</style>
