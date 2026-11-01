<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PatternDone from '../components/canvas/PatternDone.vue'
import StepBar from '../components/canvas/StepBar.vue'
import { fillBlanks } from '../domain/fillBlanks'
import { useI18n } from '../i18n/useI18n'

// The Homepage's Progress bar (tickets 0739, 0744; Homepage and ProgressBar cards): the editor's bar, its sections in
// place of rows, drawn by StepBar. What is the Homepage's own is Pattern done, which plays round the track's end on
// reaching the last section.
const props = defineProps<{
  /** The section shown, from 0. */
  section: number
  /** The Homepage's sections in order; each one's heading names its step. */
  sections: readonly { id: string; heading: string }[]
}>()
const emit = defineEmits<{ go: [section: number] }>()
const { t } = useI18n()

const steps = computed(() => props.sections.map((entry) => ({ id: entry.id, label: entry.heading })))
const last = computed(() => props.sections.length - 1)

/** Counts the bursts, so each one is drawn afresh; none while it is 0 or over. */
const burst = ref(0)
const bursting = ref(false)
/** The burst's length: its third flash starts 760ms in and its rays take 900ms (Motion section). */
const BURST_MS = 1700
let burstEnd: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.section,
  (now, before) => {
    if (now <= before || now !== last.value) return
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
  <StepBar
    :step="section"
    :steps="steps"
    :track-label="t.homepage.sections.label"
    :go-to="(heading) => fillBlanks(t.homepage.sections.goTo, { section: heading })"
    :back-label="t.homepage.sections.back"
    :next-label="t.homepage.sections.next"
    :first-body="t.homepage.sections.firstBody"
    :last-body="t.homepage.sections.lastBody"
    testid="section"
    @go="emit('go', $event)"
  >
    <template #track>
      <span v-if="bursting" :key="burst" class="section-bar__burst" data-testid="section-burst">
        <PatternDone :sheet="BURST_SHEET" :frame="BURST_SPAN" :stars="[]" />
      </span>
    </template>
  </StepBar>
</template>

<style scoped>
.section-bar__burst {
  position: absolute;
  top: 50%;
  right: 0;
  width: 0;
  height: 0;
}
</style>
