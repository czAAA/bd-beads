<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import { useHelpDevice } from '../../composables/ui/useKeyHints'

// What an empty Project says (FirstRunHints card, tickets 0920, 1200): a tool's name is a word set off as `**Name**`,
// `{key}` the save key; no chips or icons. Decoration only: hidden from screen readers and pointers, so the first
// press on the canvas paints the first bead.
const { t } = useI18n()
const { device, modKey } = useHelpDevice()

type Part = { text: string } | { name: string } | { key: true }

/** A line cut at its `**name**` words and its `{key}`. */
function parts(line: string): Part[] {
  return line.split(/(\*\*[^*]+\*\*|\{key\})/).flatMap((piece): Part[] => {
    if (!piece) return []
    if (piece === '{key}') return [{ key: true }]
    if (piece.startsWith('**')) return [{ name: piece.slice(2, -2) }]
    return [{ text: piece }]
  })
}

const lines = computed(() => {
  const { firstRun } = t.value.canvas
  const touch = device.value === 'touch'
  return [
    { id: 'first-run-next-step', cls: 'first-run-hints__lead', parts: touch ? [{ text: t.value.tooltips.paint }] : parts(firstRun.paintMouse) },
    { id: 'first-run-set-frame', cls: 'first-run-hints__line', parts: parts(firstRun.setFrame) },
    { id: 'first-run-storage', cls: 'first-run-hints__storage', parts: parts(firstRun.storage) },
    { id: 'first-run-save', cls: 'first-run-hints__line', parts: parts(touch ? firstRun.saveTouch : firstRun.saveKeys) },
  ]
})
</script>

<template>
  <div class="first-run-hints" aria-hidden="true" data-testid="first-run-hints">
    <div class="first-run-hints__welcome" data-testid="first-run-welcome">
      <template v-for="line in lines" :key="line.id">
        <p :class="line.cls" :data-testid="line.id">
          <template v-for="(part, i) in line.parts" :key="i">
            <template v-if="'text' in part">{{ part.text }}</template>
            <span v-else-if="'key' in part" class="first-run-hints__name first-run-hints__key">{{ modKey('S') }}</span>
            <span v-else class="first-run-hints__name">{{ part.name }}</span>
          </template>
        </p>
      </template>
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

/* Centred on the drawing area, under the CanvasHint line: the next step and the storage line 6px under it, nothing
 * else (tickets 0795, 0920). */
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

/* What to do first, a size up and in `body`, over the calmer `muted` line. */
.first-run-hints__lead {
  max-width: 36rem;
  margin: 0;
  font: var(--hint-storage-lead);
  color: var(--body);
}

/* The Frame and save lines, in the muted size of the storage line. */
.first-run-hints__line {
  max-width: 36rem;
  margin: var(--space-6) 0 0;
  font: var(--hint-storage);
  text-wrap: balance;
}

/* A tool's name is a word in the line: one step up in weight and color, no box and no icon (ticket 1200). The save key
 * is the same, in the mono face. */
.first-run-hints__name {
  font-weight: 500;
  color: var(--ink);
}

.first-run-hints__key {
  font-family: var(--font-mono);
}

/* A narrow screen balances it. */
.first-run-hints__storage {
  max-width: 36rem;
  margin: var(--space-6) 0 0;
  font: var(--hint-storage);
  text-wrap: balance;
}
</style>
