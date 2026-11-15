<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useShellScope } from '../../composables/ui/shellScope'
import { ROW_WAYS, type ShownWay } from '../../domain/rowProgress'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppSwitch from '../ui/AppSwitch.vue'

// Turn row direction's list (ProgressBar card, ticket 0973, UX-060): the four ways in words, the current one checked,
// so its press turns nothing; choosing one turns the rows and closes it. Under them Show row marks, Row highlight's
// Switch named by its words. Escape or a press outside closes it and nothing changes.
const props = defineProps<{
  /** The button it hangs from: its own press toggles the list. */
  anchor: HTMLElement | undefined
  /** The way the rows run now, as the Frame lies. */
  current: ShownWay
  /** Whether the Canvas draws the Row progress marks. */
  rowHighlight: boolean
  /** Which side of the button it opens on: above the Progress bar, below the margin's band. */
  side: 'above' | 'below'
  /** The prefix of its test ids. */
  testid: string
}>()
const emit = defineEmits<{
  close: []
  /** A way chosen other than the one the rows run now. */
  choose: [way: ShownWay]
  'toggle-row-highlight': []
}>()

const { t } = useI18n()
/** Out of the bar, into the shell's popover layer, so the bar's one Tab stop (ADR 0075) doesn't take its buttons in; it
 * stays where it is with no shell round it (a component test). */
const teleportTo = useShellScope().teleportTo
const inShell = document.querySelector(teleportTo) !== null
const rootEl = ref<HTMLElement>()
const anchorEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(anchorEl, rootEl, () => 'start', () => props.side)

const wayLabel = (way: ShownWay): string => {
  const words = t.value.rowProgress
  return { down: words.topToBottom, right: words.leftToRight, up: words.bottomToTop, left: words.rightToLeft }[way]
}

function close() {
  emit('close')
  props.anchor?.focus({ preventScroll: true })
}

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close,
  onOutsidePress: () => emit('close'),
  isOpener: (target) => props.anchor?.contains(target) ?? false,
})

function choose(way: ShownWay) {
  if (way !== props.current) emit('choose', way)
  close()
}

const radios = () => [...(rootEl.value?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])]

/** The arrows step through the four ways, as in any radio group; Enter or Space chooses one. */
function onWaysKeydown(event: KeyboardEvent) {
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
  if (step === undefined) return
  event.preventDefault()
  // The Progress bar's own arrows (its roving focus) don't also run.
  event.stopPropagation()
  const list = radios()
  const at = list.indexOf(document.activeElement as HTMLElement)
  list[(at + step + list.length) % list.length]?.focus()
}

onMounted(async () => {
  anchorEl.value = props.anchor
  await nextTick()
  anchored.follow()
  radios()[ROW_WAYS.indexOf(props.current)]?.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport :to="teleportTo" :disabled="!inShell">
  <div
    ref="rootEl"
    class="row-direction anchored-popup"
    popover="manual"
    :style="anchored.style.value"
    role="dialog"
    :aria-label="t.rowProgress.directionButton"
    :data-testid="`${testid}-direction-list`"
  >
    <span class="row-direction__title" aria-hidden="true">{{ t.rowProgress.directionButton }}</span>
    <div class="row-direction__ways" role="radiogroup" :aria-label="t.rowProgress.directionButton" @keydown="onWaysKeydown">
      <button
        v-for="way in ROW_WAYS"
        :key="way"
        class="ui-control row-direction__way"
        type="button"
        role="radio"
        :aria-checked="way === current"
        :tabindex="way === current ? 0 : -1"
        :data-testid="`${testid}-direction-${way}`"
        @click="choose(way)"
      >
        <AppIcon v-if="way === current" name="check" :size="16" />
        <span v-else class="row-direction__gap" aria-hidden="true" />
        {{ wayLabel(way) }}
      </button>
    </div>
    <span class="row-direction__rule" aria-hidden="true" />
    <label class="row-direction__marks">
      <span>{{ t.rowProgress.showRowMarks }}</span>
      <AppSwitch
        :model-value="rowHighlight"
        :label="t.rowProgress.showRowMarks"
        :data-testid="`${testid}-row-marks`"
        @update:model-value="emit('toggle-row-highlight')"
      />
    </label>
  </div>
  </Teleport>
</template>

<style scoped>
/* The shared popover look (Go to row's): the overlay fill and line, elevation 3; a menu's 4px padding round its items. */
.row-direction {
  position: fixed;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: var(--menu-width);
  padding: var(--space-4);
  pointer-events: auto;
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

.row-direction__title {
  padding: var(--space-6) var(--space-10) var(--space-4);
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}

.row-direction__ways {
  display: flex;
  flex-direction: column;
}

/* Each way is a Menu item (Menu card): 34px, the control type, the chosen one's check leading. */
.row-direction__way {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  width: 100%;
  height: var(--menu-item-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
  text-align: left;
  white-space: nowrap;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.row-direction__way:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.row-direction__way:focus {
  background: var(--overlay-hover);
}

@media (hover: hover) {
  .row-direction__way:hover {
    background: var(--overlay-hover);
  }
}

.row-direction__gap {
  flex: none;
  width: var(--space-16);
}

.row-direction__rule {
  height: 1px;
  margin: var(--space-4) var(--space-6);
  background: var(--overlay-line);
}

/* Show row marks: its name, then the Switch at the far end, the whole line a press target. */
.row-direction__marks {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  min-height: var(--menu-item-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
  cursor: pointer;
}
</style>
