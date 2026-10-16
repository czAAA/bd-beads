<script setup lang="ts">
import { inject } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { IconName } from '../ui/icons'
import { PANEL_CONTEXT } from './panelContext'

/**
 * One row of a panel (MenuPanel card): `item-height` tall (44 to 48px in the Top sheet or on a coarse pointer, and
 * growing with its content), an icon, a label and an optional value at the right. A button, or a link with `href`
 * (`external` opens a new tab). `danger` colors it for Delete. A disabled item keeps its Tooltip saying why (it is
 * `aria-disabled`, so it stays hoverable and a press does nothing). `closes` shuts the panel before `select` runs.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    icon?: IconName
    value?: string
    danger?: boolean
    disabled?: boolean
    /** What a disabled item's Tooltip is named and says. */
    name?: string
    disabledBody?: string
    href?: string
    external?: boolean
    /** Leave the panel open (Import: its file picker belongs to the open panel). */
    stays?: boolean
  }>(),
  { icon: undefined, value: undefined, danger: false, disabled: false, name: undefined, disabledBody: undefined, href: undefined, external: false, stays: false },
)
const emit = defineEmits<{ select: [] }>()
const context = inject(PANEL_CONTEXT)

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
    <button v-bind="$attrs" class="ui-control panel-item" :class="{ 'panel-item--danger': danger }" type="button" :role="context?.itemRole.value" aria-disabled="true" @click="onClick">
      <AppIcon v-if="icon" :name="icon" :size="16" />
      <span class="panel-item__label"><slot /></span>
      <span v-if="value" class="panel-item__value">{{ value }}</span>
    </button>
  </AppTooltip>
  <component
    :is="href ? 'a' : 'button'"
    v-else
    v-bind="$attrs"
    class="ui-control panel-item"
    :class="{ 'panel-item--danger': danger }"
    :type="href ? undefined : 'button'"
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener' : undefined"
    :role="context?.itemRole.value"
    :aria-disabled="disabled || undefined"
    @click="onClick"
  >
    <AppIcon v-if="icon" :name="icon" :size="16" />
    <span class="panel-item__label"><slot /></span>
    <span v-if="value" class="panel-item__value">{{ value }}</span>
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
  gap: var(--space-2) var(--space-10);
  box-sizing: border-box;
  width: 100%;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-12);
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
  outline-offset: 2px;
}

.panel-item--danger {
  color: var(--danger);
}

.panel-item[aria-disabled='true'] {
  color: var(--faint);
  cursor: default;
}
</style>
