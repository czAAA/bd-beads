<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMediaQuery } from '../composables/ui/useMediaQuery'
import { SLOGAN_HOLD_MS, SLOGAN_ROLL_MS, SLOGAN_WORDS } from './slogan'

// The Homepage's rolling slogan (tickets 550, 0822; Homepage card), its brand in the Canvas strip: "open" stays still,
// the word after it rolls; screen readers hear "openbeads". The column holds the words reversed, "beads" on top, so each
// step moves it down and the next word drops in from above; on the closing "beads" it jumps back to the first unseen.
const column = [...SLOGAN_WORDS, SLOGAN_WORDS[0]!].reverse()
const lastStep = column.length - 1

const step = ref(0)
const animated = ref(true)
const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const word = computed(() => column[lastStep - step.value]!)

let timer: ReturnType<typeof setTimeout> | undefined
function stop() {
  clearTimeout(timer)
  timer = undefined
}
function hold() {
  timer = setTimeout(roll, SLOGAN_HOLD_MS)
}
function roll() {
  animated.value = true
  step.value += 1
  timer = setTimeout(() => {
    if (step.value === lastStep) {
      animated.value = false
      step.value = 0
    }
    hold()
  }, SLOGAN_ROLL_MS)
}
function sync() {
  stop()
  if (step.value === lastStep) {
    animated.value = false
    step.value = 0
  }
  if (reduceMotion.value) {
    animated.value = false
    step.value = 0
  } else if (!document.hidden) {
    hold()
  }
}

watch(reduceMotion, sync)
onMounted(() => {
  document.addEventListener('visibilitychange', sync)
  sync()
})
onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', sync)
})
</script>

<template>
  <span class="slogan" aria-label="openbeads" :data-word="word" data-testid="homepage-slogan">
    <span class="slogan__open" aria-hidden="true">open</span>
    <span class="slogan__slot" aria-hidden="true">
      <span
        class="slogan__column"
        :class="{ 'slogan__column--still': !animated }"
        :style="{
          transform: `translateY(calc(var(--slogan-line) * ${step - lastStep}))`,
        }"
        data-testid="slogan-column"
      >
        <span v-for="(w, i) in column" :key="i" class="slogan__word">{{ w }}</span>
      </span>
      <span class="slogan__sizer">
        <span v-for="w in SLOGAN_WORDS" :key="w">{{ w }}</span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.slogan {
  /* In the Canvas strip, in the wordmark's place (ticket 0822): 24px, 22px on a phone. */
  --slogan-size: var(--strip-slogan-size);
  --slogan-line: calc(var(--slogan-size) * 1.25);

  display: flex;
  justify-content: center;
  white-space: nowrap;
  font: var(--type-tagline);
  font-size: var(--slogan-size);
  line-height: var(--slogan-line);
  letter-spacing: var(--tracking-tagline);
  color: var(--ink);
}

@container shell (max-width: 480px) {
  .slogan {
    --slogan-size: var(--strip-slogan-size-phone);
  }
}

.slogan__open {
  flex: none;
}

/* One line tall, as wide as the widest word, its top and bottom edges faded. */
.slogan__slot {
  display: grid;
  flex: none;
  height: var(--slogan-line);
  overflow: hidden;
  text-align: left;
  color: var(--accent-strong);
  mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent);
}

.slogan__column {
  grid-area: 1 / 1;
  display: block;
  transition: transform var(--slogan-roll) var(--ease-standard);
}

.slogan__column--still {
  transition: none;
}

.slogan__word {
  display: block;
  height: var(--slogan-line);
}

/* Every word, unseen, in the column's cell: the slot is as wide as the widest. */
.slogan__sizer {
  grid-area: 1 / 1;
  display: block;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  white-space: nowrap;
}

.slogan__sizer > span {
  display: block;
}

@media (prefers-reduced-motion: reduce) {
  .slogan__column {
    transition: none;
  }
}
</style>
