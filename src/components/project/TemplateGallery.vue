<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { TEMPLATES, type Template, type TemplateId } from '../../domain/templates'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import { PANEL_CONTEXT } from '../shell/panelContext'
import AppIcon from '../ui/AppIcon.vue'
import TemplatePicture from './TemplatePicture.vue'

// The Template gallery at the top of New Project (ticket 493, spec 0488; TemplateGallery card): a Blank canvas tile and one
// card per Template, in a radiogroup of one tab stop. Blank canvas is the choice the form below makes; a tap on a Template
// card opens its setup (the panel's next sub-view). One column on a phone and in the dropdown, two in the Top sheet at width.
const props = defineProps<{
  /** Opened from the Project panel's Frame area (ticket 495): there is no Blank canvas to start from. */
  withoutBlank?: boolean
}>()
const emit = defineEmits<{ choose: [id: TemplateId] }>()

const { t } = useI18n()
const panel = inject(PANEL_CONTEXT, undefined)
const rootEl = ref<HTMLElement>()

type Choice = { id: 'blank' } | { id: TemplateId; template: Template }
const choices = computed<Choice[]>(() => [...(props.withoutBlank ? [] : [{ id: 'blank' as const }]), ...TEMPLATES.map((template) => ({ id: template.id, template }))])

function specLine(template: Template): string {
  return t.value.templates.specLine
    .replace('{width}', String(template.width.default))
    .replace('{height}', String(template.height.default))
    .replace('{technique}', techniqueName(t.value, template.technique))
}

/** Blank canvas is what the form below makes, so choosing it only takes the reader there. */
function onChoose(choice: Choice) {
  if (choice.id === 'blank') {
    rootEl.value?.parentElement?.querySelector<HTMLInputElement>('#name-input')?.focus()
    return
  }
  emit('choose', choice.id)
  panel?.openSub(t.value.templates[choice.id].name)
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
    class="template-gallery"
    :class="{ 'template-gallery--sheet': panel?.sheet.value }"
    role="radiogroup"
    :aria-label="t.templates.galleryLabel"
    data-testid="template-gallery"
    @keydown="onKeydown"
  >
    <button
      v-for="choice in choices"
      :key="choice.id"
      class="template-gallery__card"
      type="button"
      role="radio"
      :aria-checked="choice.id === 'blank'"
      :tabindex="choice.id === 'blank' ? 0 : -1"
      :data-testid="`template-card-${choice.id}`"
      data-wrap-ok
      @click="onChoose(choice)"
    >
      <span class="template-gallery__picture">
        <slot name="picture" :template="'template' in choice ? choice.template : undefined">
          <TemplatePicture
            v-if="'template' in choice"
            :technique="choice.template.technique"
            :columns="choice.template.width.default"
            :rows="choice.template.height.default"
            :seed-text="choice.id"
          />
          <AppIcon v-else name="plus" :size="22" />
        </slot>
      </span>
      <span class="template-gallery__text">
        <span class="template-gallery__name">{{ t.templates[choice.id].name }}</span>
        <span class="template-gallery__description">{{ t.templates[choice.id].description }}</span>
        <span v-if="'template' in choice" class="template-gallery__spec" data-testid="template-spec">{{ specLine(choice.template) }}</span>
      </span>
    </button>
  </div>
</template>

<style scoped>
.template-gallery {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-8);
}

/* The Top sheet at width has room for two columns. */
@media (min-width: 40rem) {
  .template-gallery--sheet {
    grid-template-columns: 1fr 1fr;
  }
}

.template-gallery__card {
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

.template-gallery__card:hover {
  background: var(--hover-fill);
}

.template-gallery__card[aria-checked='true'] {
  border-color: var(--accent-strong);
  box-shadow: inset 0 0 0 1px var(--accent-strong);
}

.template-gallery__card:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.template-gallery__picture {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
}

.template-gallery__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.template-gallery__name {
  font: var(--type-control);
  font-weight: 700;
}

.template-gallery__description {
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.template-gallery__spec {
  font: var(--type-meta);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
</style>
