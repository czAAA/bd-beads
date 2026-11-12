<script setup lang="ts">
import AppButton from '../components/ui/AppButton.vue'
import { COFFEE_URL } from '../data/coffeeLink'
import { useI18n } from '../i18n/useI18n'

// The coffee screen's band (tickets 219, 0823, 0880; Homepage card): a decorative beaded cup, who made the app, a few
// lines and Buy me a coffee (a new tab, ticket 560; inert while empty), then past a hairline the slot's chips. Only the
// cup and the button take a click (ticket 0813). No donation-service name, logo or colours.
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
  <div class="coffee" data-testid="homepage-coffee-band">
    <div class="coffee__story">
      <div class="coffee__lead">
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
        <h3 class="coffee__title">{{ t.homepage.coffee.title }}</h3>
      </div>
      <div class="coffee__ask">
        <p class="coffee__text">{{ t.homepage.coffee.text }}</p>
        <AppButton variant="primary" :href="COFFEE_URL || undefined" data-testid="homepage-coffee-button">{{ t.homepage.coffee.button }}</AppButton>
      </div>
    </div>
    <div v-if="$slots.default" class="coffee__under">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* The band (ticket 0823): from 1000px the cup and title on the left, the text and its button on the right; one column,
 * centred, below. The chips run under a hairline across both. */
.coffee {
  /* The cup, 64px (ticket 0819). */
  --coffee-cup-width: 4rem;

  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 1.75rem 2rem 1.25rem;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
}

.coffee__story {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-16);
  text-align: center;
}

.coffee__lead {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-16);
  min-width: 0;
}

.coffee__ask {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-16);
  min-width: 0;
}

/* On a phone the cup stands over the title, and Buy me a coffee takes the band's width, 44px tall. */
@container homepage (max-width: 480px) {
  .coffee {
    --coffee-cup-width: 4.5rem;

    padding: 1.25rem 1.125rem;
  }

  .coffee__lead {
    flex-direction: column;
    gap: var(--space-8);
  }

  .coffee__ask,
  .coffee__ask > .app-button {
    align-self: stretch;
  }

  .coffee__ask > .app-button {
    height: var(--touch-target);
  }
}

@container homepage (min-width: 1000px) {
  .coffee__story {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
    column-gap: var(--space-32);
    align-items: center;
    text-align: start;
  }

  .coffee__lead {
    justify-content: flex-start;
  }

  .coffee__text {
    align-self: stretch;
  }
}

/* The cup's link (ticket 0813): on hover a soft accent halo behind the cup, and the cup grows a little. */
.coffee__cup {
  flex: none;
  display: block;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
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
  min-width: 0;
  margin: 0;
  font: var(--type-serif-heading);
  /* 40px, easing down on the narrowest phones so the title keeps to its lines (ticket 246). */
  font-size: clamp(1.625rem, 8cqw, 2.5rem);
  line-height: 1.05;
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
  text-wrap: balance;
}

.coffee__text {
  max-width: 32rem;
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

/* What stands under the story, past a 1px `panel-rule` hairline. */
.coffee__under {
  margin: var(--space-20) 0 0;
  padding: var(--space-14) 0 0;
  border-top: 1px solid var(--panel-rule);
}
</style>
