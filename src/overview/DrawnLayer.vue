<script setup lang="ts">
import { computed } from 'vue'
import AppLogo from '../components/ui/AppLogo.vue'
import { findPaletteColor } from '../domain/palette'
import { beadsOf, DRAWINGS, LAYERS, LETTER_COLORS, TIERS, type Doodle, type Placement, type SectionName } from './drawnLayer'

/**
 * The drawn layer behind one Overview section (ticket 221; Overview card): bead drawings at the page edges and X1 marks
 * at 8% `accent`. It is decoration only: hidden from screen readers, behind the content (the section isolates it with
 * `z-index: -1`), and out of reach of the pointer and the keyboard. It is as wide as the page, so the edges are the
 * page's; each placement belongs to one screen-size band and only that band's are shown (see `drawnLayer.ts`).
 */
const props = defineProps<{ section: SectionName }>()

function fillOf(letter: string): string {
  const name = LETTER_COLORS[letter]!
  return name === 'accent' || name === 'muted' ? `var(--${name})` : findPaletteColor(name)!.hex
}

function shape(d: Doodle) {
  const step = d.bead + 1
  const rows = DRAWINGS[d.drawing]
  return {
    width: rows[0]!.length * step,
    height: rows.length * step,
    radius: d.bead * 0.22,
    beads: beadsOf(d.drawing).map((b) => ({ x: b.x * step, y: b.y * step, fill: fillOf(b.letter) })),
  }
}

function position(p: Placement): string {
  return `${p.side}:${p.edge}px;top:${p.top}px`
}

const layer = computed(() => LAYERS[props.section])
const marks = computed(() =>
  TIERS.flatMap((tier) => layer.value.marks[tier].map((m) => ({ ...m, tier, style: position(m) }))),
)
const doodles = computed(() =>
  TIERS.flatMap((tier) => layer.value.doodles[tier].map((d) => ({ ...d, ...shape(d), tier, style: position(d) }))),
)
</script>

<template>
  <div class="drawn" aria-hidden="true" data-testid="overview-drawn-layer">
    <span
      v-for="(m, i) in marks"
      :key="`m${i}`"
      class="drawn__mark"
      :class="`drawn__tier--${m.tier}`"
      :style="`${m.style};--mark-size:${m.size}px`"
      data-testid="overview-drawn-mark"
    >
      <AppLogo :size="m.size" />
    </span>
    <svg
      v-for="(d, i) in doodles"
      :key="`d${i}`"
      class="drawn__doodle"
      :class="[`drawn__tier--${d.tier}`, { 'drawn__doodle--big': d.big }]"
      :style="d.style"
      :width="d.width"
      :height="d.height"
      :viewBox="`0 0 ${d.width} ${d.height}`"
      focusable="false"
      data-testid="overview-drawn-doodle"
    >
      <rect
        v-for="(b, k) in d.beads"
        :key="k"
        :x="b.x"
        :y="b.y"
        :width="d.bead"
        :height="d.bead"
        :rx="d.radius"
        :fill="b.fill"
      />
    </svg>
  </div>
</template>

<style scoped>
.drawn {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 100vw;
  margin-left: -50vw;
  z-index: -1;
  overflow: clip;
  pointer-events: none;
  user-select: none;
}

.drawn__mark {
  position: absolute;
  color: var(--accent);
  opacity: 0.08;
}

/* A thin line at any size, as on the PDF exports. */
.drawn__mark :deep(.app-logo) {
  display: block;
  /* Placed in px, not the logo's rem, so the fitted placements hold at any text size. */
  width: var(--mark-size) !important; /* beats the logo's own inline size */
  height: var(--mark-size) !important;
  stroke-width: 1.4;
}

.drawn__doodle {
  position: absolute;
}

.drawn__doodle--big {
  opacity: 0.16;
}

/* Each placement belongs to one screen-size band: under 744, 744, 1024, 1440, 1920. */
.drawn__tier--md,
.drawn__tier--lg,
.drawn__tier--xl,
.drawn__tier--xxl {
  display: none;
}

@media (min-width: 744px) {
  .drawn__tier--sm {
    display: none;
  }
  .drawn__tier--md {
    display: block;
  }
}

@media (min-width: 1024px) {
  .drawn__tier--md {
    display: none;
  }
  .drawn__tier--lg {
    display: block;
  }
}

@media (min-width: 1440px) {
  .drawn__tier--lg {
    display: none;
  }
  .drawn__tier--xl {
    display: block;
  }
}

@media (min-width: 1920px) {
  .drawn__tier--xl {
    display: none;
  }
  .drawn__tier--xxl {
    display: block;
  }
}
</style>
