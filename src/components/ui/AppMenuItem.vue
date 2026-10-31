<script setup lang="ts">
import { inject } from 'vue'
import AppIcon from './AppIcon.vue'
import AppTooltip from './AppTooltip.vue'
import type { IconName } from './icons'
import { MENU_CLOSE } from './menuContext'

// One item of a MenuButton's menu (Menu card): choosing runs `select` and closes the menu. `chosen` marks a set to pick
// from (ticket 368), `checked` an on/off `menuitemcheckbox` (MarginSheet card), each with a check; `href` makes a link. A
// disabled item given `name` and `disabledBody` says why (ADR 0035) but stays natively disabled, so the arrows skip it.
const props = withDefaults(
  defineProps<{ icon?: IconName; disabled?: boolean; href?: string; current?: boolean; chosen?: boolean; checked?: boolean; name?: string; disabledBody?: string }>(),
  { icon: undefined, chosen: undefined, checked: undefined, disabled: false, href: undefined, current: false, name: undefined, disabledBody: undefined },
)
const emit = defineEmits<{ select: [] }>()
const closeMenu = inject(MENU_CLOSE, () => {})

function onClick() {
  if (props.disabled) return
  closeMenu()
  emit('select')
}
</script>

<template>
  <a v-if="href" class="ui-control app-menu-item" :href="href" role="menuitem" tabindex="-1" :aria-current="current ? 'page' : undefined" @click="onClick">
    <AppIcon v-if="icon" :name="icon" :size="16" />
    <span class="app-menu-item__label"><slot /></span>
  </a>
  <AppTooltip v-else-if="disabled && name && disabledBody" :name="name" disabled :disabled-body="disabledBody" :announce="false" class="app-menu-item-wrap">
    <button
      class="ui-control app-menu-item"
      type="button"
      role="menuitem"
      tabindex="-1"
      disabled
      @click="onClick"
    >
      <AppIcon v-if="icon" :name="icon" :size="16" />
      <span class="app-menu-item__label"><slot /></span>
    </button>
  </AppTooltip>
  <button
    v-else
    class="ui-control app-menu-item"
    type="button"
    :role="checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
    tabindex="-1"
    :disabled="disabled"
    :aria-current="chosen ? 'true' : undefined"
    :aria-checked="checked"
    @click="onClick"
  >
    <AppIcon v-if="icon" :name="icon" :size="16" />
    <template v-else-if="chosen !== undefined">
      <AppIcon v-if="chosen" name="check" :size="16" />
      <span v-else class="app-menu-item__gap" aria-hidden="true" />
    </template>
    <span class="app-menu-item__label"><slot /></span>
    <AppIcon v-if="checked" name="check" :size="16" class="app-menu-item__check" />
  </button>
</template>

<style scoped>
.app-menu-item {
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
  text-decoration: none;
  white-space: nowrap;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-standard);
}

.app-menu-item:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.app-menu-item:focus {
  background: var(--overlay-hover);
}

@media (hover: hover) {
  .app-menu-item:hover:not(:disabled) {
    background: var(--overlay-hover);
  }
}

.app-menu-item:disabled {
  color: var(--faint);
  cursor: not-allowed;
}
.app-menu-item-wrap {
  display: block;
  width: 100%;
}

.app-menu-item__gap {
  flex: none;
  width: 16px;
}

/* An on item's check, after its label in `accent-strong` (MarginSheet card). */
.app-menu-item__check {
  flex: none;
  margin-left: auto;
  color: var(--accent-strong);
}
</style>
