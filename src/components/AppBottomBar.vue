<script setup lang="ts">
import AppButton from './AppButton.vue'
import AppDock from './AppDock.vue'
import BottomToolbar from './BottomToolbar.vue'
import PatternImport from './PatternImport.vue'
import { useAppShell } from '../composables/useAppShell'

const {
  t,
  patterns,
  activePattern,
  framing,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  activeTool,
  selectedColorId,
  onSelectTool,
  onSelectColor,
  onImportPatterns,
  decodeImage,
  onImportToast,
  openPhoneSheet,
  onSelectPhoneSheet,
  phoneNewPatternOpen,
} = useAppShell()
</script>

<template>
  <!--
    The iPad mini tier's own toolbar (ticket 168; BottomToolbar card): the four tools, the colour, Undo and Redo,
    under the thumb, so drawing never needs the Drawer. A flex sibling of the body, not nested in the canvas box, so
    it takes its own height off the bottom of the screen rather than sitting inside the canvas box's own padding
    (ADR 0018: the canvas resizes once, when this shows or hides with the tier, not per frame).
  -->
  <BottomToolbar
    v-if="activePattern && !framing"
    class="app-shell__bottom-toolbar"
    :active-tool="activeTool"
    :selected-color-id="selectedColorId"
    :can-undo="canUndo"
    :can-redo="canRedo"
    @select-tool="onSelectTool"
    @select-color="onSelectColor"
    @undo="onUndo"
    @redo="onRedo"
  />

  <!--
    Phone tier bottom: two states. With no Pattern open, a focused pattern-management bar (New Pattern + Import +
    Import QR) replaces the Dock so the first action is immediately obvious. Once a Pattern is open the Dock appears
    with the drawing tools. The BottomToolbar (iPad mini) is always rendered independently.
  -->
  <div v-if="!framing && !activePattern" class="app-shell__phone-pattern-bar" data-testid="phone-pattern-bar">
    <AppButton variant="primary" icon="plus" data-testid="phone-bar-new-pattern" data-tour="phone-new-pattern" @click="phoneNewPatternOpen = true">
      {{ t.patterns.newPatternButton }}
    </AppButton>
    <PatternImport :decode-image="decodeImage" compact toast-results :patterns="patterns" testid-prefix="phone-bar-" @import="onImportPatterns" @import-result="onImportToast" />
  </div>
  <AppDock
    v-else-if="!framing && !!activePattern"
    class="app-shell__dock"
    :active-tool="activeTool"
    :selected-color-id="selectedColorId"
    :open-sheet="openPhoneSheet"
    @select-sheet="onSelectPhoneSheet"
  />
</template>

<style scoped>
/* The iPad mini tier's own toolbar (ticket 168; BottomToolbar card): a flex sibling of the body, shown only there. */
.app-shell__bottom-toolbar {
  display: none;
}

@media (min-width: 744px) and (max-width: 1023px) {
  .app-shell__bottom-toolbar {
    display: flex;
    flex: none;
  }
}

/* The phone tier's Dock (ticket 79): a flex sibling of the body, the same reason BottomToolbar is one. */
.app-shell__dock {
  display: none;
}

/* Phone pattern-management bar: shown instead of the Dock when no Pattern is open. */
.app-shell__phone-pattern-bar {
  display: none;
}

@media (max-width: 743px) {
  .app-shell__dock {
    display: flex;
    flex: none;
  }

  .app-shell__phone-pattern-bar {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-8);
    height: var(--dock-height);
    padding: 0 var(--space-16);
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--canvas);
    border-top: 1px solid var(--line-soft);
  }

  /* New Pattern grows to take the remaining width; the two import icons sit at a fixed square size beside it. */
  .app-shell__phone-pattern-bar :deep(.app-button) {
    flex: 1 1 0;
  }
}
</style>
