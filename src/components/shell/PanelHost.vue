<script setup lang="ts">
import { computed } from 'vue'
import PanelShell from './PanelShell.vue'
import { PANELS, type PanelId } from './panels'
import { useI18n } from '../../i18n/useI18n'

// The one place a PanelShell is mounted (ticket 510): shows the panel that is open, if it is one of `only`, set up from
// its descriptor. The panel's content goes in the slots;.
const props = defineProps<{
  /** The open panel, or none. */
  open: PanelId | null
  /** The panels this host shows, so Menu and Project share one that stays mounted while they swap. */
  only: readonly PanelId[]
}>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const panel = computed(() => (props.open && props.only.includes(props.open) ? PANELS[props.open] : undefined))
</script>

<template>
  <PanelShell
    v-if="panel"
    :title="panel.title(t)"
    :anchor="panel.anchor"
    :menu="panel.menu"
    :skips-fields="panel.skipsFields"
    @close="emit('close')"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </PanelShell>
</template>
