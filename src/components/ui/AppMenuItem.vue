<script setup lang="ts">
import { inject } from 'vue'
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'
import { MENU_CLOSE } from './menuContext'

/**
 * One item of an AppMenu (Menu card): 34px, an icon and a label; choosing it runs `select` and closes the menu.
 * `chosen` makes it one of a set to pick from (the language list, ticket 368): a check marks the chosen one, and the
 * others keep the same space so the labels line up. With an `href` it is a link (HeaderMenu card: Overview is
 * navigation, not an action), so the browser follows it itself.
 */
const props = withDefaults(
  defineProps<{ icon?: IconName; disabled?: boolean; href?: string; current?: boolean; chosen?: boolean }>(),
  { icon: undefined, chosen: undefined, disabled: false, href: undefined, current: false },
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
  <button
    v-else
    class="ui-control app-menu-item"
    type="button"
    role="menuitem"
    tabindex="-1"
    :disabled="disabled"
    :aria-current="chosen ? 'true' : undefined"
    @click="onClick"
  >
    <AppIcon v-if="icon" :name="icon" :size="16" />
    <template v-else-if="chosen !== undefined">
      <AppIcon v-if="chosen" name="check" :size="16" />
      <span v-else class="app-menu-item__gap" aria-hidden="true" />
    </template>
    <span class="app-menu-item__label"><slot /></span>
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
  outline-offset: -1px;
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
.app-menu-item__gap {
  flex: none;
  width: 16px;
}
</style>
