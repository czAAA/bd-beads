<script setup lang="ts">
import { computed } from 'vue'

// Pattern done (ticket 0730; Motion section, Row progress; `.bb-pattern-done-*` in bundle.css): plays once over the Frame
// after the press of Row done that marks the last pass: a silver firework, a shimmer and twinkling stars, CSS animations
// from the moment it is shown. It takes no press, is hidden from screen readers, and the surface removes it when over.
type Box = { x: number; y: number; width: number; height: number }
const props = defineProps<{
  /** The margin sheet, in the drawing's px: it plays inside it. */
  sheet: Box
  /** The Frame, in the sheet's px. */
  frame: Box
  /** The beads the stars light on, in the sheet's px. */
  stars: readonly { x: number; y: number }[]
}>()

/** A ray's length: long and short from the first burst, short and shorter from the side ones. */
type RayKind = 'long' | 'short' | 'shorter'
interface Ray {
  kind: RayKind
  angle: number
  /** Which of the four silvers it is drawn in (`--pattern-done-spark-N`). */
  spark: number
  delay: string
}

/** `count` rays evenly round, from `delay` after the burst's own, every other one 40ms later, in the silvers given. */
function rays(count: number, kind: RayKind, sparks: readonly number[], delay: number, offset: number): Ray[] {
  return Array.from({ length: count }, (_, index) => ({
    kind,
    angle: offset + (360 / count) * index,
    spark: sparks[index % sparks.length]!,
    delay: `${delay + (index % 2) * 40}ms`,
  }))
}

/** The three bursts as the approved prototype throws them: at the Frame's centre, then up and to the left and to the
 * right, a third of the Frame's width out (290px at most) and a sixth of its height up. */
const bursts = computed(() => {
  const { width, height } = props.frame
  const out = Math.min(width / 3, 290)
  const up = -height / 6
  return [
    { x: 0, y: 0, delay: '0ms', rays: [...rays(20, 'long', [1, 2], 0, 0), ...rays(14, 'short', [3, 2, 4], 160, 12)] },
    { x: -out, y: up, delay: 'var(--pattern-done-burst-2)', rays: [...rays(14, 'short', [2, 3], 0, 6), ...rays(10, 'shorter', [1], 100, 18)] },
    { x: out, y: up, delay: 'var(--pattern-done-burst-3)', rays: [...rays(14, 'short', [2, 4], 0, 0), ...rays(10, 'shorter', [1], 100, 18)] },
  ]
})

/** Each star's silver, every third the larger: as the approved prototype lights them. */
const starLook = (index: number) => ({ spark: [2, 1, 3][index % 3]!, large: index % 3 === 0 })
const px = (value: number) => `${value}px`
</script>

<template>
  <div
    class="pattern-done"
    :style="{ left: px(sheet.x), top: px(sheet.y), width: px(sheet.width), height: px(sheet.height) }"
    aria-hidden="true"
    data-testid="pattern-done"
  >
    <div class="pattern-done__shimmer" :style="{ left: px(frame.x), top: px(frame.y), width: px(frame.width), height: px(frame.height) }"><i /></div>
    <div class="pattern-done__firework" :style="{ left: px(frame.x + frame.width / 2), top: px(frame.y + frame.height / 2) }">
      <div v-for="(burst, at) in bursts" :key="at" class="pattern-done__burst" :style="{ transform: `translate(${burst.x}px, ${burst.y}px)`, '--burst-delay': burst.delay }">
        <span class="pattern-done__flash" />
        <div v-for="(ray, index) in burst.rays" :key="index" class="pattern-done__ray" :class="`pattern-done__ray--${ray.kind}`" :style="{ transform: `rotate(${ray.angle}deg)` }">
          <i :style="{ background: `var(--pattern-done-spark-${ray.spark})`, animationDelay: `calc(var(--burst-delay) + ${ray.delay})` }" />
        </div>
      </div>
    </div>
    <svg
      v-for="(star, index) in stars"
      :key="`star-${index}`"
      class="pattern-done__star"
      :class="{ 'pattern-done__star--large': starLook(index).large }"
      viewBox="0 0 24 24"
      :style="{ left: px(star.x), top: px(star.y), color: `var(--pattern-done-spark-${starLook(index).spark})`, animationDelay: `calc(var(--pattern-done-stars-delay) + var(--pattern-done-star-step) * ${index})` }"
    >
      <path d="M12 1.5C12.7 8.4 15.6 11.3 22.5 12 15.6 12.7 12.7 15.6 12 22.5 11.3 15.6 8.4 12.7 1.5 12 8.4 11.3 11.3 8.4 12 1.5Z" fill="currentColor" />
    </svg>
  </div>
</template>

<style scoped>
.pattern-done {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
}

.pattern-done__firework,
.pattern-done__burst,
.pattern-done__ray {
  position: absolute;
  width: 0;
  height: 0;
}

.pattern-done__ray {
  top: 0;
  left: 0;
}

.pattern-done__flash {
  position: absolute;
  top: -40px;
  left: -40px;
  width: 80px;
  height: 80px;
  background: radial-gradient(circle, var(--pattern-done-spark-1), color-mix(in srgb, var(--pattern-done-spark-3) 40%, transparent) 40%, transparent 70%);
  border-radius: 50%;
  opacity: 0;
  animation: pattern-done-bloom 600ms var(--ease-out) var(--burst-delay) both;
}

.pattern-done__ray > i {
  position: absolute;
  top: -1.5px;
  left: 0;
  width: 20px;
  height: 3px;
  border-radius: 3px;
  box-shadow: 0 0 6px var(--pattern-done-glow);
  opacity: 0;
  transform-origin: left center;
  animation: pattern-done-ray 900ms var(--ease-out) both;
}

/* The ray's round head. */
.pattern-done__ray > i::after {
  position: absolute;
  top: 50%;
  right: -2px;
  width: 4px;
  height: 4px;
  margin-top: -2px;
  background: inherit;
  border-radius: 50%;
  content: '';
}

.pattern-done__ray--short > i {
  top: -1px;
  width: 12px;
  height: 2px;
  animation-name: pattern-done-ray-short;
  animation-duration: 760ms;
}

.pattern-done__ray--shorter > i {
  top: -1px;
  width: 8px;
  height: 2px;
  animation-name: pattern-done-ray-shorter;
  animation-duration: 620ms;
}

.pattern-done__shimmer {
  position: absolute;
  overflow: hidden;
  container-type: inline-size;
}

.pattern-done__shimmer > i {
  position: absolute;
  top: -60px;
  bottom: -60px;
  left: 0;
  width: 160px;
  background: linear-gradient(90deg, transparent, var(--pattern-done-shimmer-fill), transparent);
  transform: translateX(-220px) skewX(-24deg);
  animation: pattern-done-shimmer var(--pattern-done-shimmer) var(--ease-standard) var(--pattern-done-shimmer-delay) both;
}

.pattern-done__star {
  position: absolute;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  opacity: 0;
  filter: drop-shadow(0 0 4px var(--pattern-done-glow));
  animation: pattern-done-star var(--pattern-done-star) var(--ease-out) both;
}

.pattern-done__star--large {
  width: 30px;
  height: 30px;
  margin: -15px 0 0 -15px;
}

/* High contrast: no shimmer (Motion section). */
:root[data-theme='contrast'] .pattern-done__shimmer {
  display: none;
}

@keyframes pattern-done-bloom {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }

  25% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: scale(1.6);
  }
}

@keyframes pattern-done-ray {
  0% {
    opacity: 0;
    transform: translateX(6px) scaleX(0.3);
  }

  15% {
    opacity: 1;
    transform: translateX(30px) scaleX(1.2);
  }

  100% {
    opacity: 0;
    transform: translateX(150px) scaleX(0.2);
  }
}

@keyframes pattern-done-ray-short {
  0% {
    opacity: 0;
    transform: translateX(4px) scaleX(0.3);
  }

  15% {
    opacity: 1;
    transform: translateX(20px) scaleX(1.2);
  }

  100% {
    opacity: 0;
    transform: translateX(96px) scaleX(0.2);
  }
}

@keyframes pattern-done-ray-shorter {
  0% {
    opacity: 0;
    transform: translateX(2px) scaleX(0.3);
  }

  15% {
    opacity: 1;
    transform: translateX(12px) scaleX(1.2);
  }

  100% {
    opacity: 0;
    transform: translateX(56px) scaleX(0.2);
  }
}

@keyframes pattern-done-shimmer {
  0% {
    transform: translateX(-220px) skewX(-24deg);
  }

  100% {
    transform: translateX(calc(100cqw + 220px)) skewX(-24deg);
  }
}

@keyframes pattern-done-star {
  0% {
    opacity: 0;
    transform: scale(0.2) rotate(0);
  }

  40% {
    opacity: 1;
    transform: scale(1) rotate(45deg);
  }

  100% {
    opacity: 0;
    transform: scale(0.4) rotate(90deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pattern-done {
    display: none;
  }
}
</style>
