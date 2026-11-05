<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'

// What an empty Project says (FirstRunHints card, tickets 0738 and 0798): only where Projects are kept and how to keep
// a file of one, centred on the drawing area. Decoration only: hidden from screen readers and pointers, so the first
// press on the canvas paints the first bead.
const { t } = useI18n()
/** The welcome's last line: where in the Project panel a Project file is made. */
const path = computed(() => [t.value.header.projectPanelLabel, t.value.panels.project.exportHeading, t.value.panels.project.saveFile])
</script>

<template>
  <div class="first-run-hints" aria-hidden="true" data-testid="first-run-hints">
    <div class="first-run-hints__welcome" data-testid="first-run-welcome">
      <p class="first-run-hints__lead" data-testid="first-run-storage-lead">{{ t.canvas.firstRun.storageLead }}</p>
      <p class="first-run-hints__storage" data-testid="first-run-storage">{{ t.canvas.firstRun.storage }}</p>
      <p class="first-run-hints__path" data-testid="first-run-path">
        <template v-for="(step, index) in path" :key="step">
          <span v-if="index">›</span>
          <span class="hint-chip first-run-hints__chip">{{ step }}</span>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.first-run-hints {
  position: absolute;
  inset: 0;
  z-index: var(--z-canvas-overlay);
  overflow: hidden;
  pointer-events: none;
  color: var(--muted);
}

/* They go with the first bead over the fast duration, at once under reduced motion (FirstRunHints card). */
@media (prefers-reduced-motion: no-preference) {
  .first-run-hints-leave-active {
    transition: opacity var(--duration-fast) var(--ease-out);
  }
}

.first-run-hints-leave-to {
  opacity: 0;
}

/* Centred on the drawing area, under the CanvasHint line: the lead line, the storage line 6px under it and the
 * Project file's path, nothing else (ticket 0795). */
.first-run-hints__welcome {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: max-content;
  max-width: calc(100% - 2 * var(--space-16));
  text-align: center;
  transform: translate(-50%, -50%);
}

/* What a newcomer must not miss, a size up and in `body`, over the calmer `muted` line. */
.first-run-hints__lead {
  max-width: 36rem;
  margin: 0;
  font: var(--hint-storage-lead);
  color: var(--body);
}

.first-run-hints__storage {
  max-width: 36rem;
  margin: var(--space-6) 0 0;
  font: var(--hint-storage);
}

.first-run-hints__path {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-6);
  margin: var(--space-10) 0 0;
  font: var(--hint-storage);
}

/* The CanvasHint's chip (controls.css), holding a label instead of a key. */
.first-run-hints__chip {
  font: var(--type-meta-small);
}
</style>
