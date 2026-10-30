<script setup lang="ts">
import AppButton from '../components/ui/AppButton.vue'
import { COFFEE_URL } from '../data/coffeeLink'
import { useI18n } from '../i18n/useI18n'

// The coffee tile (ticket 219; Homepage card): a decorative beaded cup, who made the app, one line and a button opening the
// Coffee link in a new tab (ticket 560), inert while it is empty. The whole tile is the link (ticket 0718): the button's
// `::after` covers it, so keyboards and screen readers still meet one link. No donation-service name, logo or colours.
const { t } = useI18n()

/** The cup, one letter a bead: `A` a body bead in the accent, `S` a saucer bead in the ink. */
const CUP = ['.AAAAA..', '.AAAAAAA', '.AAAAA.A', '.AAAAAA.', '..AAA...', 'SSSSSSS.']
const BEAD = 7
const STEP = BEAD + 1
const CUP_TOP = 3 * STEP
const cupBeads = CUP.flatMap((row, r) =>
  [...row].flatMap((letter, c) => (letter === '.' ? [] : [{ x: c * STEP, y: CUP_TOP + r * STEP, saucer: letter === 'S' }])),
)
/** The steam beads' places, in beads from the cup's top-left. */
const steam = [
  { x: 2 * STEP, y: 1.5 * STEP },
  { x: 3 * STEP, y: 0.3 * STEP },
  { x: 4 * STEP, y: 1.5 * STEP },
]
</script>

<template>
  <section class="coffee" data-testid="homepage-coffee">
    <svg
      class="coffee-cup"
      :width="8 * STEP"
      :height="9 * STEP"
      :viewBox="`0 0 ${8 * STEP} ${9 * STEP}`"
      aria-hidden="true"
      data-testid="coffee-cup"
    >
      <rect v-for="(bead, i) in steam" :key="`s${i}`" class="coffee-cup__steam" :x="bead.x" :y="bead.y" :width="BEAD" :height="BEAD" rx="1" />
      <rect
        v-for="(bead, i) in cupBeads"
        :key="i"
        :class="bead.saucer ? 'coffee-cup__saucer' : 'coffee-cup__body'"
        :x="bead.x"
        :y="bead.y"
        :width="BEAD"
        :height="BEAD"
        rx="1.5"
      />
    </svg>
    <div>
      <h3 class="coffee__title">{{ t.homepage.coffee.title }}</h3>
      <p class="coffee__text">{{ t.homepage.coffee.text }}</p>
    </div>
    <AppButton :href="COFFEE_URL || undefined" :class="{ coffee__link: COFFEE_URL }" data-testid="homepage-coffee-button">{{ t.homepage.coffee.button }}</AppButton>
  </section>
</template>

<style scoped>
.coffee {
  --coffee-radius: 1.25rem;

  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-14);
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 1.625rem 1.375rem;
  text-align: center;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--coffee-radius);
}

/* The link's box is the tile, not its own (a coarse pointer makes every control `relative`, and a press scales it, which
   would shrink the cover mid-click), so its `::after` reaches the tile's edges. */
.coffee :deep(.coffee__link.app-button),
.coffee :deep(.coffee__link.app-button:active) {
  position: static;
  transform: none;
}

.coffee :deep(.coffee__link)::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--coffee-radius);
}

.coffee-cup {
  flex: none;
  overflow: visible;
}

.coffee-cup__body {
  fill: var(--accent);
}

.coffee-cup__saucer {
  fill: var(--ink);
}

.coffee-cup__steam {
  fill: var(--muted);
  opacity: 0;
  animation: coffee-steam 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}

.coffee-cup__steam:nth-child(2) {
  animation-delay: 0.8s;
}

.coffee-cup__steam:nth-child(3) {
  animation-delay: 1.6s;
}

@keyframes coffee-steam {
  0% {
    opacity: 0;
    transform: translateY(4px);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .coffee-cup__steam {
    opacity: 0.8;
    animation: none;
  }
}

.coffee__title {
  margin: 0;
  font: var(--type-serif-heading);
  /* Eases down on the narrowest phones so the title keeps to one line (ticket 246). */
  font-size: clamp(1.625rem, 8cqw, 1.875rem);
  line-height: 2.125rem;
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

.coffee__text {
  margin: var(--space-6) 0 0;
  font: var(--type-body);
  color: var(--body);
}
</style>
