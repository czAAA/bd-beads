<script setup lang="ts">
import { COFFEE_URL } from '../data/coffeeLink'
import { useI18n } from '../i18n/useI18n'

// The coffee tile (ticket 219; Homepage card): only the beaded cup (ticket 0811), itself the link to the Coffee link in a new
// tab (ticket 560), named "Buy me a coffee" and inert while empty. No donation-service name, logo or colours.
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
    <component
      :is="COFFEE_URL ? 'a' : 'div'"
      class="coffee__cup"
      :href="COFFEE_URL || undefined"
      :target="COFFEE_URL ? '_blank' : undefined"
      :rel="COFFEE_URL ? 'noopener' : undefined"
      :aria-label="COFFEE_URL ? t.homepage.coffee.button : undefined"
      data-testid="homepage-coffee-button"
    >
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
    </component>
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

.coffee__cup {
  display: block;
  border-radius: var(--coffee-radius);
  color: inherit;
  cursor: pointer;
}

a.coffee__cup:focus-visible {
  outline: 2px solid var(--accent-strong);
  outline-offset: 8px;
}

div.coffee__cup {
  cursor: default;
}

.coffee-cup {
  display: block;
  flex: none;
  overflow: visible;
  /* Big enough to be the tile (ticket 0811); the drawing scales, its beads stay square. */
  width: 10rem;
  height: auto;
  transition: transform var(--duration-fast) var(--ease-standard);
}

a.coffee__cup:hover .coffee-cup {
  transform: scale(1.04);
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
</style>
