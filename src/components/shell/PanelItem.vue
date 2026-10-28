<script setup lang="ts">
import { computed, inject } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'
import { PANEL_CONTEXT } from './panelContext'

// One row of a panel (MenuPanel card): `panel-row` tall, icon, label, value and a trailing mark (› `sub`, ↗ `external`).
// `accent` colors it as the main action, `accentIcon` only its icon, `danger` as Delete. A button, or a link with
// `href` (`external` opens a new tab). A disabled item is `aria-disabled` so it keeps its Tooltip saying why.
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    icon?: IconName
    value?: string
    danger?: boolean
    accent?: boolean
    accentIcon?: boolean
    /** It opens a subpanel. */
    sub?: boolean
    disabled?: boolean
    /** What a disabled item's Tooltip is named and says. */
    name?: string
    disabledBody?: string
    href?: string
    external?: boolean
    /** Leave the panel open (Import: its file picker belongs to the open panel). */
    stays?: boolean
  }>(),
  { icon: undefined, value: undefined, danger: false, accent: false, accentIcon: false, sub: false, disabled: false, name: undefined, disabledBody: undefined, href: undefined, external: false, stays: false },
)
const emit = defineEmits<{ select: [] }>()
const context = inject(PANEL_CONTEXT)
const mark = computed(() => (props.external ? 'external' : props.sub ? 'chevron-left' : undefined))

function onClick(event: Event) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  if (!props.stays) context?.close()
  emit('select')
}
</script>

<template>
  <AppTooltip v-if="disabled && name && disabledBody" :name="name" disabled :disabled-body="disabledBody" :announce="false" class="panel-item-wrap">
    <button v-bind="$attrs" class="ui-control panel-item" :class="{ 'panel-item--danger': danger, 'panel-item--accent': accent }" type="button" :role="context?.itemRole.value" aria-disabled="true" @click="onClick">
      <AppIcon v-if="icon" :name="icon" :size="16" :class="{ 'panel-item__icon--accent': accentIcon }" />
      <span class="panel-item__label"><slot /></span>
      <span v-if="value" class="panel-item__value">{{ value }}</span>
      <AppIcon v-if="mark" :name="mark" :size="14" class="panel-item__mark" :class="{ 'panel-item__mark--sub': sub }" />
    </button>
  </AppTooltip>
  <component
    :is="href ? 'a' : 'button'"
    v-else
    v-bind="$attrs"
    class="ui-control panel-item"
    :class="{ 'panel-item--danger': danger, 'panel-item--accent': accent }"
    :type="href ? undefined : 'button'"
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener' : undefined"
    :role="context?.itemRole.value"
    :aria-disabled="disabled || undefined"
    @click="onClick"
  >
    <AppIcon v-if="icon" :name="icon" :size="16" :class="{ 'panel-item__icon--accent': accentIcon }" />
    <span class="panel-item__label"><slot /></span>
    <span v-if="value" class="panel-item__value">{{ value }}</span>
    <AppIcon v-if="mark" :name="mark" :size="14" class="panel-item__mark" :class="{ 'panel-item__mark--sub': sub }" />
  </component>
</template>

<style scoped>
.panel-item-wrap {
  display: block;
}

.panel-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-8);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
  text-align: left;
  text-decoration: none;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.panel-item__label {
  flex: 1 1 auto;
  min-width: min-content;
}

.panel-item__icon--accent {
  color: var(--accent-strong);
}

.panel-item__mark {
  flex: none;
  color: var(--muted);
}

/* The design system draws one chevron-left; › is it turned. */
.panel-item__mark--sub {
  transform: rotate(180deg);
}

.panel-item__value {
  flex: none;
  margin-left: auto;
  font: var(--type-meta);
  color: var(--muted);
}

@media (hover: hover) {
  .panel-item:hover:not([aria-disabled='true']) {
    background: var(--hover-fill);
  }
}

.panel-item:active:not([aria-disabled='true']) {
  background: var(--press-fill);
}

.panel-item:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.panel-item--danger {
  color: var(--danger);
}

.panel-item--accent {
  color: var(--accent-strong);
}

/* The page the panel is opened on (the Homepage's own item on the Homepage). */
.panel-item[aria-current='page'] {
  color: var(--accent-strong);
  cursor: default;
}

.panel-item[aria-disabled='true'] {
  color: var(--faint);
  cursor: default;
}
</style>
