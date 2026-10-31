<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import PatternDone from '../components/canvas/PatternDone.vue'
import ProgressBar from '../components/canvas/ProgressBar.vue'
import ProgressTrack from '../components/canvas/ProgressTrack.vue'
import { useI18n } from '../i18n/useI18n'

// The Homepage's Progress bar (ticket 0739; Homepage and ProgressBar cards): the editor's bar, its sections in place of
// rows. The counter, the section's name, the track a third per section, Back where Row not done sits and Next where Row
// done sits. A step forward flares the spark as Row done does; reaching the last section plays Pattern done's burst.
const props = defineProps<{
  /** The section shown, from 0. */
  section: number
  /** Each section's name, in order. */
  names: readonly string[]
}>()
const emit = defineEmits<{ go: [section: number] }>()
const { t } = useI18n()

const last = computed(() => props.names.length - 1)
const flares = ref(0)
/** Counts the bursts, so each one is drawn afresh; none while it is 0 or over. */
const burst = ref(0)
const bursting = ref(false)
/** The burst's length: its third flash starts 760ms in and its rays take 900ms (Motion section). */
const BURST_MS = 1700
let burstEnd: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.section,
  (now, before) => {
    if (now <= before) return
    flares.value += 1
    if (now !== last.value) return
    burst.value += 1
    bursting.value = true
    clearTimeout(burstEnd)
    burstEnd = setTimeout(() => (bursting.value = false), BURST_MS)
  },
)
onBeforeUnmount(() => clearTimeout(burstEnd))

/** Pattern done plays in a square round the track's end; its bursts sit along a short span there, none up. */
const BURST_SHEET = { x: -160, y: -160, width: 320, height: 320 }
const BURST_SPAN = { x: 100, y: 160, width: 120, height: 0 }
</script>

<template>
  <ProgressBar class="section-bar" data-testid="section-bar">
    <p class="section-bar__counter" data-testid="section-counter">{{ section + 1 }}/{{ names.length }}</p>
    <p class="section-bar__name" data-testid="section-name">{{ names[section] }}</p>
    <ProgressTrack
      :share="(section + 1) / names.length"
      :flares="flares"
      :label="t.homepage.sections.label"
      :min="1"
      :max="names.length"
      :now="section + 1"
      :aria-valuetext="`${section + 1}/${names.length} · ${names[section]}`"
      testid="section"
    >
      <span v-if="bursting" :key="burst" class="section-bar__burst" data-testid="section-burst">
        <PatternDone :sheet="BURST_SHEET" :frame="BURST_SPAN" :stars="[]" />
      </span>
    </ProgressTrack>
    <span class="section-bar__steps">
      <AppButton
        variant="box"
        size="lg"
        icon="arrow-up"
        :label="t.homepage.sections.back"
        :disabled="section === 0"
        :disabled-body="t.homepage.sections.firstBody"
        data-testid="section-back"
        @click="emit('go', section - 1)"
      >
        {{ t.homepage.sections.back }}
      </AppButton>
      <AppButton
        variant="primary"
        size="lg"
        trailing-icon="arrow-down"
        :label="t.homepage.sections.next"
        :disabled="section === last"
        :disabled-body="t.homepage.sections.lastBody"
        data-testid="section-next"
        @click="emit('go', section + 1)"
      >
        {{ t.homepage.sections.next }}
      </AppButton>
    </span>
  </ProgressBar>
</template>

<style scoped>
/* The counter is Row progress's ("5/30", `control`); the name beside it `meta` in `box-muted`, as the row's "of 30". */
.section-bar__counter {
  margin: 0 0 0 var(--space-2);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
}

.section-bar__name {
  margin: 0;
  font: var(--type-meta);
  color: var(--box-muted);
  text-transform: lowercase;
  white-space: nowrap;
}

.section-bar__burst {
  position: absolute;
  top: 50%;
  right: 0;
  width: 0;
  height: 0;
}

.section-bar__steps {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
}

/* Phone widths: the name gives way to the track, and Back and Next take the second row, half the bar each, as Row not
 * done and Row done do (ProgressBar card). */
@media (max-width: 30rem) {
  .section-bar__name {
    display: none;
  }

  .section-bar__steps {
    flex: 1 1 100%;
    min-width: 0;
    gap: var(--space-4);
  }

  .section-bar__steps > .app-button,
  .section-bar__steps :deep(.app-button-wrap) {
    flex: 1 1 0;
    min-width: 0;
  }

  .section-bar__steps :deep(.app-button) {
    width: 100%;
    min-width: 0;
    padding-inline: var(--space-6);
    gap: var(--space-2);
    justify-content: center;
    font: var(--type-small);
  }
}
</style>
