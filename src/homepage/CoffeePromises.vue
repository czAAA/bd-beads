<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../components/ui/AppIcon.vue'
import { useI18n } from '../i18n/useI18n'
import CoffeeAction from './CoffeeAction.vue'
import { coffeeActs, coffeePromises } from './coffeeCopy'

// Under the coffee screen's band (tickets 0880, 0948, 1175; Homepage card): the seven promises, four over three (what
// it is, then how you use it), then Open source and Say hello. Every name is in view at once, nothing to press, so
// nothing needs a hover or a tap to say what it is. Each item's line is for screen readers only.
const emit = defineEmits<{ feedback: [] }>()

const { t } = useI18n()
const rows = computed(() => {
  const promises = coffeePromises(t.value)
  return (['what', 'how'] as const).map((row) => ({ row, promises: promises.filter((promise) => promise.row === row) }))
})
const acts = computed(() => coffeeActs(t.value))
</script>

<template>
  <div class="coffee-promises">
    <div class="coffee-promises__list" data-testid="homepage-coffee-promises">
      <ul v-for="{ row, promises } in rows" :key="row" class="coffee-promises__row" :data-testid="`homepage-coffee-promises-${row}`">
        <li v-for="promise in promises" :key="promise.id" class="coffee-promise" :data-testid="`homepage-coffee-promise-${promise.id}`">
          <AppIcon class="coffee-promise__icon" :name="promise.icon" :size="18" />
          <span class="coffee-promise__name">{{ promise.name }}</span>
          <!-- The stop keeps a screen reader from running the name into its line. -->
          <span class="coffee-promise__said">. {{ promise.text }}</span>
        </li>
      </ul>
    </div>
    <ul class="coffee-promises__acts" data-testid="homepage-coffee-acts">
      <li v-for="act in acts" :key="act.id" class="coffee-promise coffee-promise--act" :data-testid="`homepage-coffee-act-${act.id}`">
        <AppIcon class="coffee-promise__icon" :name="act.icon" :size="18" />
        <span class="coffee-promise__name">{{ act.name }}</span>
        <span class="coffee-promise__said">. {{ act.text }}</span>
        <CoffeeAction class="coffee-promise__action" :of="act.id" @feedback="emit('feedback')" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* The promises, then 16px under them the two that act. */
.coffee-promises {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-16);
}

/* Four over three (ticket 1175), each row centred, the three under the four like brick stitch, 12px between the rows. */
.coffee-promises__list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-12);
  max-width: 100%;
}

/* One row: a name wraps between its words where the row is short of room, 24px between the promises, 32px from 744.
   Under 640 two to a row, each half the width, the odd one out centred, so the longest word of every language keeps
   to its half. */
.coffee-promises__row {
  display: flex;
  justify-content: center;
  gap: var(--space-12) var(--space-24);
  max-width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A promise is never narrower than its longest word, which would poke out of its box. */
.coffee-promises__row > .coffee-promise {
  min-width: auto;
}

/* One row, centred, 32px apart, one under the other where there is no room. */
.coffee-promises__acts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-12) var(--space-32);
  max-width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

@container homepage (max-width: 639px) {
  .coffee-promises__row {
    flex-wrap: wrap;
    width: 100%;
  }

  .coffee-promises__row > .coffee-promise {
    flex: 0 0 calc((100% - var(--space-24)) / 2);
  }
}

@container homepage (min-width: 744px) {
  .coffee-promises__row {
    column-gap: var(--space-32);
  }
}

/* The Welcome's promise: the icon, 10px on its name. */
.coffee-promise {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--space-10);
  min-width: 0;
}

.coffee-promise--act {
  align-items: center;
}

.coffee-promise__icon {
  flex: none;
  color: var(--accent-strong);
}

.coffee-promise__name {
  min-width: 0;
  font: var(--type-promise);
  color: var(--ink);
}

.coffee-promise__action {
  flex: none;
  margin-left: var(--space-2);
}

.coffee-promise__said {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
