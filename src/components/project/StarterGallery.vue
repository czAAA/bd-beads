<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { STARTERS, type Starter, type StarterId } from '../../domain/starters'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import { PANEL_CONTEXT } from '../shell/panelContext'
import AppIcon from '../ui/AppIcon.vue'
import StarterPicture from './StarterPicture.vue'

// The Starter gallery at the top of New Project (ticket 493, spec 0488; StarterGallery card): a Blank canvas tile and one
// card per Starter, in a radiogroup of one tab stop. Blank canvas is the choice the form below makes; a tap on a Starter
// card opens its setup (the panel's next subpanel). One column.
const props = defineProps<{
  /** Opened from the Project panel's Frame area (ticket 495): there is no Blank canvas to start from. */
  withoutBlank?: boolean
}>()
const emit = defineEmits<{ choose: [id: StarterId]; 'choose-blank': [] }>()

const { t } = useI18n()
const panel = inject(PANEL_CONTEXT, undefined)
const rootEl = ref<HTMLElement>()

type Choice = { id: 'blank' } | { id: StarterId; starter: Starter }
const choices = computed<Choice[]>(() => [...(props.withoutBlank ? [] : [{ id: 'blank' as const }]), ...STARTERS.map((starter) => ({ id: starter.id, starter }))])

function specLine(starter: Starter): string {
  return t.value.starters.specLine
    .replace('{width}', String(starter.width.default))
    .replace('{height}', String(starter.height.default))
    .replace('{technique}', techniqueName(t.value, starter.technique))
}

/** Blank canvas is what the form below makes, so choosing it only takes the reader there. */
function onChoose(choice: Choice) {
  if (choice.id === 'blank') {
    emit('choose-blank')
    return
  }
  emit('choose', choice.id)
  panel?.openSub(t.value.starters[choice.id].name)
}

function onKeydown(event: KeyboardEvent) {
  const radios = [...(rootEl.value?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])]
  const index = radios.indexOf(event.target as HTMLElement)
  if (index < 0) return
  const last = radios.length - 1
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? Math.min(last, index + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? Math.max(0, index - 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined
  if (next === undefined) return
  event.preventDefault()
  event.stopPropagation()
  radios[next]?.focus()
}
</script>

<template>
  <div
    ref="rootEl"
    class="starter-gallery"
    role="radiogroup"
    :aria-label="t.starters.galleryLabel"
    data-testid="starter-gallery"
    @keydown="onKeydown"
  >
    <button
      v-for="choice in choices"
      :key="choice.id"
      class="starter-gallery__card"
      type="button"
      role="radio"
      :aria-checked="choice.id === 'blank'"
      :tabindex="choice.id === 'blank' ? 0 : -1"
      :data-testid="`starter-card-${choice.id}`"
      data-wrap-ok
      @click="onChoose(choice)"
    >
      <span class="starter-gallery__picture">
        <slot name="picture" :starter="'starter' in choice ? choice.starter : undefined">
          <StarterPicture
            v-if="'starter' in choice"
            :technique="choice.starter.technique"
            :columns="choice.starter.width.default"
            :rows="choice.starter.height.default"
            :seed-text="choice.id"
          />
          <AppIcon v-else name="plus" :size="22" />
        </slot>
      </span>
      <span class="starter-gallery__text">
        <span class="starter-gallery__name">{{ t.starters[choice.id].name }}</span>
        <span class="starter-gallery__description">{{ t.starters[choice.id].description }}</span>
        <span v-if="'starter' in choice" class="starter-gallery__spec" data-testid="starter-spec">{{ specLine(choice.starter) }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.starter-gallery {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-8);
}

.starter-gallery__card {
  display: flex;
  gap: var(--space-10);
  align-items: center;
  box-sizing: border-box;
  min-height: var(--field-height);
  padding: var(--space-8) var(--space-10);
  font: inherit;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
}

.starter-gallery__card:hover {
  background: var(--hover-fill);
}

.starter-gallery__card[aria-checked='true'] {
  border-color: var(--accent-strong);
  box-shadow: inset 0 0 0 1px var(--accent-strong);
}

.starter-gallery__card:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.starter-gallery__picture {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
}

.starter-gallery__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.starter-gallery__name {
  font: var(--type-control);
  font-weight: 700;
}

.starter-gallery__description {
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.starter-gallery__spec {
  font: var(--type-meta);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
