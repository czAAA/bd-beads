<script setup lang="ts">
import { computed, inject } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'
import { PANEL_CONTEXT } from './panelContext'

// One row of a panel (MenuPanel card): icon, label, value, a mark (› `sub`, ↗ `external`, a fold mark with `expanded`: it
// unfolds rows under it, never closing the panel, 1058); `accent`, `accentIcon`, `danger` color it, `secondary` makes it a
// small link under the row before (0700). A folded row's label and mark are in accent-2 (1121). A button, or a link with `href`; a disabled one is `aria-disabled`, for its Tooltip.
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
    /** It unfolds rows under it (ticket 1058): whether they show, said by `aria-expanded` and the fold mark. */
    expanded?: boolean
    disabled?: boolean
    /** What a disabled item's Tooltip is named and says. */
    name?: string
    disabledBody?: string
    href?: string
    external?: boolean
    /** Leave the panel open (Import: its file picker belongs to the open panel). */
    stays?: boolean
    secondary?: boolean
  }>(),
  { icon: undefined, value: undefined, danger: false, accent: false, accentIcon: false, sub: false, expanded: undefined, disabled: false, name: undefined, disabledBody: undefined, href: undefined, external: false, stays: false, secondary: false },
)
const emit = defineEmits<{ select: [] }>()
const context = inject(PANEL_CONTEXT)
/** A fold row (ticket 1058): `expanded` given, true or false. */
const folds = computed(() => props.expanded !== undefined)
/** The design system draws one chevron-left: › (a subpanel, a folded row) is it turned, an unfolded row's is down. */
const turned = computed(() => props.sub || props.expanded === false)
const mark = computed(() => {
  if (props.external) return 'external'
  if (props.expanded) return 'chevron-down'
  return turned.value ? 'chevron-left' : undefined
})

function onClick(event: Event) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  if (!props.stays && !folds.value) context?.close()
  emit('select')
}
</script>

<template>
  <AppTooltip v-if="disabled && name && disabledBody" :name="name" disabled :disabled-body="disabledBody" :announce="false" class="panel-item-wrap">
    <button v-bind="$attrs" class="ui-control panel-item" :class="{ 'panel-item--danger': danger, 'panel-item--accent': accent }" type="button" aria-disabled="true" @click="onClick">
      <AppIcon v-if="icon" :name="icon" :size="16" :class="{ 'panel-item__icon--accent': accentIcon }" />
      <span class="panel-item__label"><slot /></span>
      <span v-if="value" class="panel-item__value">{{ value }}</span>
      <AppIcon v-if="mark" :name="mark" :size="14" class="panel-item__mark" :class="{ 'panel-item__mark--sub': turned }" />
    </button>
  </AppTooltip>
  <component
    :is="href ? 'a' : 'button'"
    v-else
    v-bind="$attrs"
    class="ui-control panel-item"
    :class="{ 'panel-item--danger': danger, 'panel-item--accent': accent, 'panel-item--secondary': secondary, 'panel-item--folded': expanded === false }"
    :type="href ? undefined : 'button'"
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener' : undefined"
    :aria-disabled="disabled || undefined"
    :aria-expanded="expanded"
    @click="onClick"
  >
    <AppIcon v-if="icon" :name="icon" :size="16" :class="{ 'panel-item__icon--accent': accentIcon }" />
    <span class="panel-item__label"><slot /></span>
    <span v-if="value" class="panel-item__value">{{ value }}</span>
    <AppIcon v-if="mark" :name="mark" :size="14" class="panel-item__mark" :class="{ 'panel-item__mark--sub': turned }" />
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

/* A link under its row (MenuPanel card): `small`, `muted`, from the label column, underlined on hover. */
.panel-item--secondary {
  min-height: var(--panel-item-secondary-height);
  padding-left: calc(var(--space-10) + 16px + var(--space-8));
  font: var(--type-small);
  color: var(--muted);
  text-underline-offset: var(--link-underline-offset);
}

/* On touch it keeps the full row's height, to be pressed. */
@media (pointer: coarse) {
  .panel-item--secondary {
    min-height: var(--panel-item-height);
  }
}

@media (hover: hover) {
  .panel-item--secondary:hover {
    color: var(--ink);
    text-decoration: underline;
  }
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

/* The design system draws one chevron-left; › (and a folded row's mark) is it turned. */
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

/* A folded row (ticket 1121): its label and mark in accent-2, as every folded part of a panel is. */
.panel-item--folded,
.panel-item--folded .panel-item__mark {
  color: var(--accent-2);
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
