<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AppIcon from '../../components/ui/AppIcon.vue'
import AppLogo from '../../components/ui/AppLogo.vue'
import type { IconName } from '../../components/ui/icons'
import { useI18n } from '../../i18n/useI18n'
import { PRINT_COLORS } from '../../rendering/printColors'
import BeadPicture from './BeadPicture.vue'
import ExampleFrame from './ExampleFrame.vue'
import { ART_COLORS, POPPY } from './exampleArt'

/**
 * Exports (ticket 218): an A4 page as the PDF draws it, with the technique word filling the page's width and the four
 * ways out beside it. The page is always light, whatever the theme (DESIGN.md §4.3), so it takes the export's own
 * colors; its word is scaled uniformly to the width, never stretched.
 */
const { t } = useI18n()

const FORMATS: { icon: IconName; label: () => string }[] = [
  { icon: 'pdf', label: () => 'PDF' },
  { icon: 'image', label: () => 'PNG' },
  { icon: 'scan', label: () => 'QR' },
  { icon: 'save', label: () => t.value.overview.examples.projectFile },
]

const count = (hex: string | undefined) => POPPY.flat().filter((cell) => cell.color === hex).length
const red = count(ART_COLORS.R)
const ivory = count(ART_COLORS.I)
const columns = POPPY[0]!.length
const rows = POPPY.length

const paperStyle = {
  '--paper': PRINT_COLORS.paper,
  '--paper-ink': PRINT_COLORS.ink,
  '--paper-muted': PRINT_COLORS.muted,
  '--paper-accent': PRINT_COLORS.accent,
  '--paper-board': PRINT_COLORS.board,
}

/** The word's box measured once its font is in, so the viewBox hugs the letters and the word fills the width at their own proportions. */
const wordEl = ref<SVGTextElement>()
const wordBox = ref<{ x: number; y: number; width: number; height: number }>()
const word = computed(() => t.value.form.techniqueLoom)

async function measure() {
  await nextTick()
  await document.fonts?.ready
  try {
    const box = wordEl.value?.getBBox()
    if (box && box.width > 0) wordBox.value = { x: box.x, y: box.y, width: box.width, height: box.height }
  } catch {
    // No layout to measure (a test environment): the word keeps its default box.
  }
}
onMounted(measure)
watch(word, measure)
const wordView = computed(() => (wordBox.value ? `${wordBox.value.x} ${wordBox.value.y} ${wordBox.value.width} ${wordBox.value.height}` : '0 0 164 60'))
/** Page units (the page is 180 wide): as tall as the word is at the page's width, up to 74, centred on the same line whatever its height. */
const wordHeight = computed(() => (wordBox.value ? Math.min(74, (164 * wordBox.value.height) / wordBox.value.width) : 60))
const wordStyle = computed(() => ({ height: `calc(${wordHeight.value} * var(--p))`, top: `calc(${150 - wordHeight.value / 2} * var(--p))` }))
</script>

<template>
  <ExampleFrame>
    <div class="paper" :style="paperStyle" data-testid="example-paper">
      <span class="paper__brand"><AppLogo :size="16" />bd-beads</span>
      <span class="paper__mark paper__mark--top"><AppLogo :size="96" /></span>
      <span class="paper__mark paper__mark--left"><AppLogo :size="45" /></span>
      <span class="paper__mark paper__mark--right"><AppLogo :size="24" /></span>
      <svg class="paper__word" :viewBox="wordView" :style="wordStyle" preserveAspectRatio="xMidYMid meet" data-testid="example-word">
        <text ref="wordEl" x="0" y="50">{{ word }}</text>
      </svg>
      <span class="paper__chart"><BeadPicture :grid="POPPY" :zoom="0.3" print /></span>
      <span class="paper__facts">
        <b>{{ t.overview.examples.names[1] }}</b>
        <span>{{ t.overview.examples.by }}</span>
        <span>{{ columns }}×{{ rows }}</span>
        <span>{{ t.overview.examples.brickRed }} {{ red }}</span>
        <span>{{ t.overview.examples.ivory }} {{ ivory }}</span>
      </span>
      <svg class="paper__line" viewBox="0 0 180 40" preserveAspectRatio="none"><path d="M-4 30 C 50 42, 110 4, 184 16" /></svg>
      <span class="paper__maker">{{ t.overview.examples.maker }}</span>
      <span class="paper__page">{{ t.overview.examples.page }}</span>
    </div>
    <div class="formats">
      <span v-for="format in FORMATS" :key="format.icon" class="formats__item"><AppIcon :name="format.icon" :size="14" />{{ format.label() }}</span>
    </div>
  </ExampleFrame>
</template>

<style scoped>
/* One design px of the page (drawn at 180px wide) is 1.5px here. */
.paper {
  --p: 1.5px;

  position: relative;
  flex: none;
  width: calc(180 * var(--p));
  aspect-ratio: 210 / 297;
  overflow: hidden;
  color: var(--paper-ink);
  background: var(--paper);
  border-radius: calc(3 * var(--p));
  box-shadow: var(--elevation-2);
}

.paper > * {
  position: absolute;
}

.paper__brand {
  top: calc(9 * var(--p));
  left: calc(10 * var(--p));
  display: flex;
  align-items: center;
  gap: calc(4 * var(--p));
  font: 700 calc(7 * var(--p)) / 1 var(--font-sans);
  color: var(--paper-ink);
}

.paper__brand :deep(.app-logo) {
  color: var(--paper-ink);
}

.paper__mark {
  color: var(--paper-accent);
}

.paper__mark--top {
  top: calc(-10 * var(--p));
  right: calc(-14 * var(--p));
  opacity: 0.08;
}

.paper__mark--left {
  bottom: calc(30 * var(--p));
  left: calc(14 * var(--p));
  opacity: 0.07;
}

.paper__mark--right {
  right: calc(26 * var(--p));
  bottom: calc(70 * var(--p));
  opacity: 0.1;
}

.paper__word {
  left: calc(8 * var(--p));
  width: calc(164 * var(--p));
  overflow: visible;
}

.paper__word text {
  font: italic 400 60px / 1 var(--font-serif);
  fill: var(--paper-accent);
}

.paper__chart {
  top: calc(24 * var(--p));
  left: calc(12 * var(--p));
}

.paper__facts {
  top: calc(28 * var(--p));
  left: calc(112 * var(--p));
  display: flex;
  flex-direction: column;
  gap: calc(3 * var(--p));
  font: 400 calc(5.5 * var(--p)) / 1.3 var(--font-mono);
  color: var(--paper-muted);
}

.paper__facts b {
  font: 600 calc(6.5 * var(--p)) / 1.2 var(--font-sans);
  color: var(--paper-ink);
}

.paper__line {
  bottom: calc(24 * var(--p));
  left: 0;
  width: 100%;
  height: calc(40 * var(--p));
  overflow: visible;
  fill: none;
  stroke: var(--paper-accent);
  stroke-opacity: 0.5;
  stroke-width: 1;
}

.paper__maker {
  bottom: calc(14 * var(--p));
  left: calc(12 * var(--p));
  font: italic 400 calc(22 * var(--p)) / 1 var(--font-serif);
  color: var(--paper-ink);
  opacity: 0.13;
}

.paper__page {
  right: calc(10 * var(--p));
  bottom: calc(7 * var(--p));
  font: 400 calc(5 * var(--p)) / 1 var(--font-mono);
  color: var(--paper-muted);
}

.formats {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.formats__item {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-8);
  font: var(--type-meta-small);
  color: var(--ink);
  white-space: nowrap;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
</style>
