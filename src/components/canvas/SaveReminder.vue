<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { lastFileAgo } from '../../domain/beadsSinceFile'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import { plural } from '../../i18n/plural'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import { actionKey } from '../ui/controlAction'

// The save ring (SaveReminder card, tickets 0796, 0922): on the Canvas strip beside the Project button once the open
// Project's Project file is well behind. A press runs Save, the Project panel's row; its label "Save Project file · n beads
// since the last file" hangs under it for a moment, over the drawing area, so it covers no strip control.
const props = defineProps<{
  /** The open Project's Beads since last file. */
  beads: number
  /** When its last Project file was saved on this device; none when it never was. */
  lastFileAt?: number
  /** The label is open (useSaveReminder). */
  labelOpen: boolean
}>()
const emit = defineEmits<{
  save: []
  /** The pointer or focus came onto the ring (true) or left it (false): an open label stays while it is there. */
  hold: [on: boolean]
}>()

const { t, locale } = useI18n()
const save = controlAction('save-project-file')
const countId = useId()

const count = computed(() => groupThousands(props.beads, locale.value))
/** What the count counts, said in the label itself (ticket 0858), not a bare "+n" read as "n beads not saved". */
const since = computed(() => plural(locale.value, props.beads, t.value.saveReminder.since))
const countLine = computed(() => fillBlanks(t.value.saveReminder.count, { count: count.value }))
/** How wide the label may be: from the ring's left edge to 8px short of the screen's right edge, so it is never cut;
 * measured while it is open, again whenever the window is resized. A count with no room left on the line is left out,
 * so the label is as wide as the words it shows. */
const buttonEl = ref<HTMLElement>()
const textEl = ref<HTMLElement>()
const countEl = ref<HTMLElement>()
const labelRoom = ref<string>()
const countLeftOut = ref(false)
const LABEL_MARGIN_PX = 8
async function measureRoom() {
  const left = buttonEl.value?.getBoundingClientRect().left
  if (left === undefined) return
  labelRoom.value = `${Math.max(0, document.documentElement.clientWidth - left - LABEL_MARGIN_PX)}px`
  countLeftOut.value = false
  await nextTick()
  // On the hidden second line: below the words.
  countLeftOut.value = !!countEl.value && !!textEl.value && countEl.value.offsetTop >= textEl.value.offsetTop + textEl.value.offsetHeight
}
function onResize() {
  void measureRoom()
}
watch(
  () => props.labelOpen,
  async (open) => {
    window.removeEventListener('resize', onResize)
    if (!open) return
    await nextTick()
    await measureRoom()
    // Closed again while it was measured: nothing to follow.
    if (props.labelOpen) window.addEventListener('resize', onResize)
  },
  { immediate: true },
)
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
const lastLine = computed(() => {
  if (props.lastFileAt === undefined) return t.value.saveReminder.noFile
  const { value, unit } = lastFileAgo(props.lastFileAt, Date.now())
  return fillBlanks(t.value.saveReminder.lastFile, { when: new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }).format(value, unit) })
})
</script>

<template>
  <AppTooltip
    class="save-ring"
    :class="{ 'save-ring--open': labelOpen }"
    :name="t.saveReminder.label"
    :hotkey="actionKey(save)"
    :body="t.saveReminder.body"
    :meta="[countLine, lastLine]"
    :announce="false"
  >
    <!-- Open, the label's words are the ring's name (ticket 0940); closed, it is Save Project file, the count its description. -->
    <button
      ref="buttonEl"
      type="button"
      class="ui-control save-ring__button"
      :aria-label="labelOpen ? undefined : t.saveReminder.label"
      :aria-describedby="labelOpen && !countLeftOut ? undefined : countId"
      data-testid="save-ring"
      @click="emit('save')"
      @pointerenter="emit('hold', true)"
      @pointerleave="emit('hold', false)"
      @focus="emit('hold', true)"
      @blur="emit('hold', false)"
    >
      <span class="save-ring__halo"><AppIcon name="save" :size="16" /></span>
      <span class="save-ring__label" :style="labelRoom ? { '--label-room': labelRoom } : undefined" :aria-hidden="labelOpen ? undefined : 'true'" data-testid="save-ring-label">
        <span class="save-ring__line">
          <span ref="textEl" class="save-ring__text">{{ t.saveReminder.label }}</span>
          {{ ' ' }}
          <span ref="countEl" class="save-ring__count" :class="{ 'save-ring__count--left-out': countLeftOut }" data-testid="save-ring-count">{{ since }}</span>
        </span>
      </span>
    </button>
    <span :id="countId" class="save-ring__described">{{ countLine }}</span>
  </AppTooltip>
</template>

<style scoped>
/* In the Canvas strip's left slot, right after the Project button (ticket 0922): as tall as the strip's buttons, so the
 * strip keeps its height and nothing beside it moves when it comes, goes or opens its label. */
.save-ring {
  --ring-size: var(--strip-item-height);

  flex: none;
  animation: save-ring-in var(--duration-slow) var(--ease-standard);
}

/* The Tool pill's material, without its shadow: it sits in the strip like the buttons beside it. */
.save-ring__button {
  position: relative;
  display: inline-grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--ring-size);
  height: var(--ring-size);
  padding: 0;
  color: var(--accent-strong);
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: scale var(--duration-fast) var(--ease-standard);
}

.save-ring__button:hover {
  background-image: linear-gradient(var(--hover-fill), var(--hover-fill));
}

.save-ring__button:active {
  background-image: linear-gradient(var(--press-fill), var(--press-fill));
  scale: 0.96;
}

.save-ring__button:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.save-ring__halo {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: var(--save-ring-halo);
  height: var(--save-ring-halo);
  border: var(--save-ring-stroke) solid currentColor;
  border-radius: var(--radius-full);
}

/* The label hangs 6px under the ring, left edges aligned, over the drawing area: "Save Project file" then "n beads since
 * the last file". Part of the button, so a press on it saves too. At most as wide as the screen leaves it; a count with
 * no room wraps onto the hidden second line, leaving the words. */
.save-ring__label {
  position: absolute;
  top: calc(100% + var(--space-6));
  left: -1px;
  z-index: var(--z-chrome);
  display: flex;
  box-sizing: border-box;
  width: max-content;
  max-width: min(32rem, var(--label-room, 32rem));
  padding: var(--space-6) var(--space-12);
  font: var(--type-tab);
  white-space: nowrap;
  pointer-events: none;
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-2);
  opacity: 0;
  visibility: hidden;
  translate: 0 calc(-1 * var(--space-4));
  transition:
    opacity var(--duration-base) var(--ease-standard),
    translate var(--duration-slow) var(--ease-standard),
    visibility 0s linear var(--duration-base);
}

.save-ring--open .save-ring__label {
  pointer-events: auto;
  opacity: 1;
  visibility: visible;
  translate: 0 0;
  transition:
    opacity var(--duration-base) var(--ease-standard),
    translate var(--duration-slow) var(--ease-standard);
}

.save-ring__line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--space-6);
  min-width: 0;
  height: 1lh;
  overflow: hidden;
}

.save-ring__text {
  font: var(--type-tab);
  color: var(--ink);
}

.save-ring__count {
  font: var(--type-meta-small);
  color: var(--muted);
  /* Too long for any line, it breaks on the hidden lines rather than running off the screen. */
  white-space: normal;
}

.save-ring__count--left-out {
  display: none;
}

.save-ring__described {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

:root[data-theme='contrast'] .save-ring__button,
:root[data-theme='contrast'] .save-ring__label {
  border: 2px solid var(--line-strong);
}

:root[data-theme='contrast'] .save-ring__button {
  color: var(--ink);
}

@keyframes save-ring-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

@keyframes save-ring-fade-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .save-ring {
    animation-name: save-ring-fade-in;
  }

  .save-ring__label,
  .save-ring--open .save-ring__label {
    translate: none;
  }
}
</style>
