<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMediaQuery } from '../composables/ui/useMediaQuery'
import { useI18n } from '../i18n/useI18n'
import FreeList from './FreeList.vue'

// The unrolled free list (ticket 0739; Homepage card): one long paper roll out through the No account tile's bottom
// edge, its curled end last, falling with a little bounce. It lies over the page, so the box's edge doesn't clip it.
// Its list repeats the tile's window, so it is hidden from screen readers; the curl rolls it back up.
export interface RollPlace {
  /** Where the tile's window is, in the stage's px. */
  x: number
  y: number
  width: number
  /** The window's height: what the roll starts from and goes back up to. */
  rolledHeight: number
  /** The whole list from where the window was scrolled to; the curl hangs below it. */
  height: number
  /** How far the window was scrolled, in the stage's px, so the roll goes on from the row it showed. */
  offset: number
}

const props = defineProps<{
  place: RollPlace
  items: readonly string[]
  /** The Homepage's zoom, so the list is drawn the size the tile draws it. */
  zoom: number
}>()
const emit = defineEmits<{ rollUp: [] }>()
const { t } = useI18n()
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const rollEl = ref<HTMLElement>()

/** The fall: 650ms and a little more the further it falls (1.2ms a px, 750ms more at most); the way back, 480ms. */
const DROP_MS = 650
const DROP_PER_PX = 1.2
const DROP_MAX_EXTRA_MS = 750
const UP_MS = 480

const px = (value: number) => `${value}px`

onMounted(() => {
  const { rolledHeight, height } = props.place
  if (reducedMotion.value || !rollEl.value?.animate) return
  rollEl.value.animate(
    [
      { height: px(rolledHeight), offset: 0, easing: 'cubic-bezier(.5, 0, .9, .45)' },
      { height: px(height + 12), offset: 0.8, easing: 'ease-out' },
      { height: px(height - 5), offset: 0.9, easing: 'ease-in-out' },
      { height: px(height), offset: 1 },
    ],
    { duration: Math.round(DROP_MS + Math.min(DROP_MAX_EXTRA_MS, (height - rolledHeight) * DROP_PER_PX)), fill: 'both' },
  )
})

/** Rolls back up into the tile; resolves once it is there (at once under reduced motion). */
function rollUp(): Promise<void> {
  const el = rollEl.value
  if (reducedMotion.value || !el?.animate) return Promise.resolve()
  const animation = el.animate([{ height: px(props.place.height) }, { height: px(props.place.rolledHeight) }], {
    duration: UP_MS,
    easing: 'cubic-bezier(.4, 0, .2, 1)',
    fill: 'forwards',
  })
  return animation.finished.then(() => undefined, () => undefined)
}
defineExpose({ rollUp, root: rollEl })
</script>

<template>
  <div
    ref="rollEl"
    class="free-roll"
    :style="{ left: px(place.x), top: px(place.y), width: px(place.width), height: px(place.height) }"
    data-testid="free-roll"
  >
    <div class="free-roll__paper" aria-hidden="true">
      <div :style="{ transform: `translateY(${px(-place.offset)})` }">
        <FreeList :items="items" :style="{ zoom }" />
      </div>
    </div>
    <button type="button" class="free-roll__curl" :aria-label="t.homepage.plans.free.rollUp" data-testid="free-roll-curl" @click="emit('rollUp')" />
  </div>
</template>

<style scoped>
.free-roll {
  position: absolute;
  z-index: 3;
}

/* The paper: a little wider than the window it comes out of, in the tile's own fill and edges, the list going on from
 * the window's last row. */
.free-roll__paper {
  position: absolute;
  inset: 0 calc(var(--space-8) * -1);
  overflow: hidden;
  padding: 0 var(--space-8);
  background: var(--canvas);
  box-shadow: inset 1px 0 0 var(--line), inset -1px 0 0 var(--line);
}

/* The curled end: a cylinder a little wider than the paper, lit from above. */
.free-roll__curl {
  position: absolute;
  right: calc((var(--space-8) + var(--space-6)) * -1);
  bottom: calc(var(--free-roll-curl) / -2);
  left: calc((var(--space-8) + var(--space-6)) * -1);
  height: var(--free-roll-curl);
  padding: 0;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--ink) 28%, var(--canvas)) 0%,
    color-mix(in srgb, var(--ink) 18%, var(--canvas)) 45%,
    color-mix(in srgb, var(--ink) 6%, var(--canvas)) 100%
  );
  border: 0;
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-2);
  cursor: pointer;
}

.free-roll__curl:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}
</style>
