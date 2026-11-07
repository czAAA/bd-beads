<script setup lang="ts">
import AppButton from '../components/ui/AppButton.vue'
import { COFFEE_URL } from '../data/coffeeLink'
import { SOURCE_URL } from '../data/sourceLink'
import { useI18n } from '../i18n/useI18n'

// The coffee tile (ticket 219; Homepage card): a decorative beaded cup, who made the app, a few lines and a button opening the
// Coffee link in a new tab (ticket 560), inert while empty. Only the cup, the button and the source link take a click (ticket
// 0813). No donation-service name, logo or colours.
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
    <!-- A pointer shortcut to the Coffee link (ticket 0813): keyboards and screen readers meet the button only. -->
    <component
      :is="COFFEE_URL ? 'a' : 'div'"
      class="coffee__cup"
      :href="COFFEE_URL || undefined"
      :target="COFFEE_URL ? '_blank' : undefined"
      :rel="COFFEE_URL ? 'noopener' : undefined"
      tabindex="-1"
      aria-hidden="true"
      data-testid="homepage-coffee-cup-link"
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
    <div>
      <h3 class="coffee__title">{{ t.homepage.coffee.title }}</h3>
      <p class="coffee__text">{{ t.homepage.coffee.text }}</p>
    </div>
    <AppButton :href="COFFEE_URL || undefined" data-testid="homepage-coffee-button">{{ t.homepage.coffee.button }}</AppButton>
    <p class="coffee__star">
      {{ t.homepage.coffee.star }}
      <a class="coffee__source" :href="SOURCE_URL" target="_blank" rel="noopener" data-testid="homepage-coffee-source">{{ t.homepage.coffee.source }}</a>
    </p>
  </section>
</template>

<style scoped>
.coffee {
  --coffee-radius: 1.25rem;
  /* The big cup (ticket 0811). */
  --coffee-cup-width: 10rem;

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

/* The cup's link (ticket 0813): on hover a soft accent halo behind the cup, and the cup grows a little. */
.coffee__cup {
  display: block;
  padding: var(--space-14);
  border-radius: var(--coffee-radius);
  transition: background-color var(--duration-fast) var(--ease-standard);
}

a.coffee__cup:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

a.coffee__cup:hover .coffee-cup {
  transform: scale(1.05);
}

.coffee-cup {
  flex: none;
  overflow: visible;
  /* The drawing scales, its beads stay square. */
  display: block;
  width: var(--coffee-cup-width);
  height: auto;
  transition: transform var(--duration-fast) var(--ease-standard);
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

  a.coffee__cup:hover .coffee-cup {
    transform: none;
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

.coffee__star {
  margin: calc(-1 * var(--space-6)) 0 0;
  font: var(--type-small);
  color: var(--muted);
}

.coffee__source {
  color: inherit;
  text-decoration: underline;
}

.coffee__text {
  margin: var(--space-6) 0 0;
  font: var(--type-body);
  color: var(--body);
}
</style>
