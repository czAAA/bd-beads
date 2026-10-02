<script setup lang="ts">
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { useI18n } from '../i18n/useI18n'

/**
 * The plan tiles (ticket 220; Overview card): "Three ways to use it". No account is the one that works now: it opens the
 * editor, like the hero's button. Free account and Pro are switched off, and the reason is written once for both. The
 * contents are placeholders: there is no account, pricing or payment behaviour here.
 */
const emit = defineEmits<{ openEditor: [] }>()
const { t } = useI18n()

/** The tiles' ids, in the design system's order; the first is the one that works now. */
const IDS = ['no-account', 'free-account', 'pro'] as const
</script>

<template>
  <section class="plans" aria-labelledby="overview-plans" data-testid="overview-plans">
    <header class="plans__head">
      <p class="plans__label">{{ t.overview.plans.label }}</p>
      <h2 id="overview-plans" class="plans__heading">{{ t.overview.plans.heading }}</h2>
      <p class="plans__why"><AppIcon name="info" :size="16" />{{ t.overview.plans.why }}</p>
    </header>
    <div class="plans__grid">
      <article
        v-for="(tile, i) in t.overview.plans.tiles"
        :key="IDS[i]"
        class="plan"
        :class="{ 'plan--current': i === 0 }"
        :aria-current="i === 0 ? 'true' : undefined"
        :data-testid="`plan-${IDS[i]}`"
      >
        <span v-if="i === 0" class="plan__here" aria-hidden="true" data-testid="plan-you-are-here">
          <span class="plan__note">{{ t.overview.plans.youAreHere }}</span>
          <svg class="plan__arrow" width="36" height="30" viewBox="0 0 36 30"><path d="M4 4 C 10 14, 18 20, 30 22 M20 24 L31 22 L24 13" /></svg>
        </span>
        <span class="plan__strand" aria-hidden="true">
          <template v-for="bead in 3" :key="bead">
            <span v-if="bead > 1" class="plan__thread" />
            <span class="plan__bead" :class="{ 'plan__bead--on': bead <= i + 1 }" />
          </template>
        </span>
        <h3 class="plan__name">{{ tile.name }}</h3>
        <p class="plan__price">
          <b>{{ tile.price }}</b
          ><span>{{ tile.meta }}</span>
        </p>
        <p class="plan__text">{{ tile.text }}</p>
        <AppButton
          class="plan__button"
          :variant="i === 0 ? 'primary' : 'secondary'"
          :disabled="i !== 0"
          @click="i === 0 && emit('openEditor')"
        >
          {{ tile.button }}
        </AppButton>
        <ul class="plan__list">
          <li class="plan__includes">{{ tile.includes }}</li>
          <li v-for="item in tile.items" :key="item" class="plan__item">
            <AppIcon name="check" :size="15" class="plan__check" /><span>{{ item }}</span>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.plans {
  padding: var(--space-32) 0;
}

.plans__head {
  text-align: center;
}

.plans__label {
  margin: 0;
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.plans__heading {
  margin: var(--space-4) 0 0;
  font: var(--type-serif-heading);
  font-size: 2.125rem;
  line-height: 2.375rem;
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

@media (min-width: 744px) {
  .plans__heading {
    font-size: 2.625rem;
    line-height: 2.875rem;
  }
}

.plans__why {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-8);
  margin: var(--space-10) 0 0;
  font: var(--type-body);
  font-size: 0.8125rem;
  line-height: 1.125rem;
  color: var(--muted);
}

.plans__grid {
  display: grid;
  gap: var(--space-14);
  margin-top: var(--space-24);
}

@media (min-width: 744px) {
  .plans__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-12);
    margin-top: var(--space-32);
  }
}

.plan {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-14);
  box-sizing: border-box;
  min-width: 0;
  padding: 1.375rem var(--space-20);
  text-align: left;
  background: var(--canvas);
  border: 1px solid var(--line);
  border-radius: 1rem;
}

@media (min-width: 744px) {
  .plan {
    padding: var(--space-20) 1.125rem;
  }
}

@media (min-width: 1024px) {
  .plan {
    padding: 1.625rem var(--space-24);
  }
}

.plan--current {
  border: 2px solid var(--ink);
  padding: calc(1.375rem - 1px) calc(var(--space-20) - 1px);
}

@media (min-width: 744px) {
  .plan--current {
    padding: calc(var(--space-20) - 1px) calc(1.125rem - 1px);
  }
}

@media (min-width: 1024px) {
  .plan--current {
    padding: calc(1.625rem - 1px) calc(var(--space-24) - 1px);
  }
}

/* The hand-written note: decorative, only from 744 where there is room above the tile. */
.plan__here {
  display: none;
  pointer-events: none;
}

@media (min-width: 744px) {
  .plan__here {
    display: block;
  }
}

.plan__note {
  position: absolute;
  top: -2.125rem;
  left: 1.125rem;
  font: var(--type-note);
  color: var(--accent-strong);
  white-space: nowrap;
  transform: rotate(-4deg);
}

.plan__arrow {
  position: absolute;
  top: -1.5rem;
  left: -1.625rem;
  overflow: visible;
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.plan__strand {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.plan__bead {
  width: 0.625rem;
  height: 0.625rem;
  background: var(--bead-empty);
  border-radius: 2.5px;
}

.plan__bead--on {
  background: var(--ink);
}

.plan__thread {
  width: 0.5rem;
  height: 1px;
  background: var(--line-strong);
}

.plan__name {
  margin: 0;
  font: var(--type-serif-heading);
  font-size: 1.875rem;
  line-height: 2rem;
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

.plan__price {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
  margin: 0;
}

.plan__price b {
  font: var(--type-body);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.5rem;
  color: var(--ink);
}

.plan__price span {
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
}

.plan__text {
  min-height: 2.5rem;
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

.plan__button {
  width: 100%;
  height: 2.75rem;
  white-space: normal;
}

.plan__list {
  display: grid;
  flex: 1;
  gap: var(--space-8);
  align-content: start;
  margin: 0;
  padding: var(--space-14) 0 0;
  list-style: none;
  border-top: 1px solid var(--line-soft);
}

.plan__includes {
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
}

.plan__item {
  display: flex;
  align-items: flex-start;
  gap: 0.5625rem;
  font: var(--type-body);
  font-size: 0.84375rem;
  line-height: 1.1875rem;
  color: var(--body);
}

.plan__check {
  flex: none;
  margin-top: 2px;
  color: var(--accent-strong);
}
</style>
