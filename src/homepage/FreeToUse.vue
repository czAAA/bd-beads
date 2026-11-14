<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { useI18n } from '../i18n/useI18n'
import FreeList from './FreeList.vue'
import { freeListGroups } from './freeList'

// Free to use for a new visitor (ticket 0947; Homepage card): with one plan there is no plan tile. The heading and the
// way in on the left, the whole free list on the right in What's inside's four chapters, every row in view at once, so
// nothing grows and the section never scrolls its heading or button away.
const emit = defineEmits<{ makeFirstProject: [] }>()
const { t, locale } = useI18n()
const plans = computed(() => t.value.homepage.plans)
const groups = computed(() => freeListGroups(t.value, locale.value))
/** The chapters in two columns, Draw and Start from something, then Real bead colors and Weave and keep. */
const columns = computed(() => [groups.value.slice(0, 2), groups.value.slice(2)])
/** The last chapter, which ends on "More on the way". */
const lastId = computed(() => groups.value.at(-1)?.id)
</script>

<template>
  <div class="free-to-use" data-testid="free-to-use">
    <div class="free-to-use__lead">
      <h2 id="homepage-plans" class="free-to-use__heading">{{ plans.alone.heading }}</h2>
      <p class="free-to-use__why" data-testid="plans-why"><AppIcon name="info" :size="16" />{{ plans.alone.why }}</p>
      <p class="free-to-use__price">
        <b>{{ plans.tiles[0].price }}</b><span>{{ plans.tiles[0].meta }}</span>
      </p>
      <p class="free-to-use__text">{{ plans.tiles[0].text }}</p>
      <AppButton class="free-to-use__button" variant="primary" data-wrap-ok data-testid="free-to-use-way-in" @click="emit('makeFirstProject')">
        {{ t.homepage.makeFirstProject }}
      </AppButton>
    </div>
    <div class="free-to-use__list">
      <p class="free-to-use__list-head">{{ plans.free.heading }}</p>
      <div class="free-to-use__columns">
        <div v-for="(column, c) in columns" :key="c" class="free-to-use__column">
          <section
            v-for="group in column"
            :key="group.id"
            class="free-to-use__group"
            :aria-labelledby="`free-group-${group.id}`"
            :data-testid="`free-group-${group.id}`"
          >
            <!-- A long chapter name may take two lines in a tablet's column: `data-wrap-ok` tells the fit check so. -->
            <h3 :id="`free-group-${group.id}`" class="free-to-use__group-name" data-wrap-ok>
              <AppIcon :name="group.icon" :size="18" class="free-to-use__group-icon" />{{ group.name }}
            </h3>
            <FreeList
              :rows="group.rows"
              :more="group.id === lastId ? plans.free.more : undefined"
              :labelled-by="`free-group-${group.id}`"
            />
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Stacked in a tablet's narrow box; from 960 the lead `--free-lead-width` wide beside the list. */
.free-to-use {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-24) var(--space-32);
  align-items: start;
}

@container homepage (min-width: 960px) {
  .free-to-use {
    grid-template-columns: var(--free-lead-width) minmax(0, 1fr);
  }
}

.free-to-use__lead {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-10);
}

.free-to-use__heading {
  margin: 0;
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

.free-to-use__why {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0 0 var(--space-12);
  font: var(--type-inside-line);
  color: var(--muted);
}

.free-to-use__price {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
  margin: 0;
}

.free-to-use__price b {
  font: var(--type-title);
  color: var(--ink);
}

.free-to-use__price span {
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
}

.free-to-use__text {
  margin: 0 0 var(--space-6);
  font: var(--type-body);
  color: var(--body);
}

.free-to-use__button {
  height: auto;
  min-height: var(--touch-target);
  white-space: normal;
}

/* The list on `panel`, a 1px `panel-rule` edge and `radius-lg`, as a phone's grouped lists: calm under the rows. */
.free-to-use__list {
  min-width: 0;
  padding: var(--space-20) var(--space-24) var(--space-24);
  background: var(--panel);
  border: 1px solid var(--panel-rule);
  border-radius: var(--radius-lg);
}

/* "forever free:" over the chapters. */
.free-to-use__list-head {
  margin: 0 0 var(--space-16);
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
}

/* The chapters in two columns from 600, so the list's 17 rows stand in a screen's height. */
.free-to-use__columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-24) var(--space-32);
}

@container homepage (min-width: 600px) {
  .free-to-use__columns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.free-to-use__column {
  display: flex;
  flex-direction: column;
  gap: var(--space-24);
  min-width: 0;
}

.free-to-use__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
}

/* A chapter's name as What's inside shows it: its 18px icon in `accent-strong`, the name in `control`, `ink`. */
.free-to-use__group-name {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0;
  padding-bottom: var(--space-8);
  font: var(--type-control);
  color: var(--ink);
  border-bottom: 1px solid var(--panel-rule);
}

.free-to-use__group-icon {
  flex: none;
  color: var(--accent-strong);
}
</style>
