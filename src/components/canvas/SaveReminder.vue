<script setup lang="ts">
import { computed, useId } from 'vue'
import { lastFileAgo } from '../../domain/beadsSinceFile'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import { actionKey } from '../ui/controlAction'

// The save ring (SaveReminder card, ticket 0796): at the drawing area's top-right once the open Project's Project file is
// well behind. A press runs Save, the Project panel's row; its label "Save Project file +n" opens leftwards for a moment.
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
const countLine = computed(() => fillBlanks(t.value.saveReminder.count, { count: count.value }))
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
    align="end"
    :announce="false"
  >
    <button
      type="button"
      class="ui-control save-ring__button"
      :aria-label="t.saveReminder.label"
      :aria-describedby="countId"
      data-testid="save-ring"
      @click="emit('save')"
      @pointerenter="emit('hold', true)"
      @pointerleave="emit('hold', false)"
      @focus="emit('hold', true)"
      @blur="emit('hold', false)"
    >
      <span class="save-ring__label" aria-hidden="true" data-testid="save-ring-label">
        <span class="save-ring__text">{{ t.saveReminder.label }}</span>
        <span class="save-ring__count">+{{ count }}</span>
      </span>
      <span class="save-ring__halo"><AppIcon name="save" :size="16" /></span>
    </button>
    <span :id="countId" class="save-ring__described">{{ countLine }}</span>
  </AppTooltip>
</template>

<style scoped>
/* Under the Canvas strip at the drawing area's top-right, still while the canvas pans, zooms or turns. */
.save-ring {
  --ring-size: var(--save-ring-size);
  --ring-pad: var(--space-4);

  position: absolute;
  top: var(--save-ring-inset);
  right: var(--save-ring-inset);
  z-index: var(--z-chrome);
  max-width: calc(100% - 2 * var(--save-ring-inset));
  animation: save-ring-in var(--duration-slow) var(--ease-standard);
}

/* The Tool pill's material; the button widens leftwards, its right edge staying put. */
.save-ring__button {
  display: inline-flex;
  flex-direction: row-reverse;
  align-items: center;
  box-sizing: border-box;
  min-width: var(--ring-size);
  max-width: 100%;
  height: var(--ring-size);
  padding: var(--ring-pad);
  color: var(--accent-strong);
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-2);
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
  flex: none;
  place-items: center;
  box-sizing: border-box;
  width: var(--save-ring-halo);
  height: var(--save-ring-halo);
  border: var(--save-ring-stroke) solid currentColor;
  border-radius: var(--radius-full);
}

/* "Save Project file" then "+n"; a count with no room wraps onto the hidden second line, leaving the words. */
.save-ring__label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: var(--space-6);
  min-width: 0;
  max-width: 0;
  height: 1lh;
  overflow: hidden;
  font: var(--type-tab);
  opacity: 0;
  white-space: nowrap;
  transition:
    max-width var(--duration-slow) var(--ease-standard),
    opacity var(--duration-base) var(--ease-standard),
    padding var(--duration-slow) var(--ease-standard);
}

.save-ring--open .save-ring__label {
  max-width: 20rem;
  padding: 0 var(--space-12) 0 var(--space-4);
  opacity: 1;
}

.save-ring__text {
  font: var(--type-tab);
  color: var(--ink);
}

.save-ring__count {
  font: var(--type-meta-small);
  color: var(--muted);
}

.save-ring__described {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (pointer: coarse) {
  .save-ring {
    --ring-size: var(--save-ring-size-touch);
    --ring-pad: var(--space-6);
  }
}

@media (max-width: 743px) {
  .save-ring {
    --ring-size: var(--save-ring-size-touch);
    --ring-pad: var(--space-6);

    top: var(--save-ring-inset-phone);
    right: var(--save-ring-inset-phone);
    max-width: calc(100% - 2 * var(--save-ring-inset-phone));
  }
}

:root[data-theme='contrast'] .save-ring__button {
  color: var(--ink);
  border: 2px solid var(--line-strong);
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

  .save-ring__label {
    transition: opacity var(--duration-base) linear;
  }
}
</style>
