<script setup lang="ts">
import IconButton from '../ui/IconButton.vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { IconSize } from '../ui/icons'

export type EditControlId = 'undo' | 'redo' | 'rotate' | 'copy' | 'paste'

/**
 * Undo, Redo, Rotate, Copy and Paste (Toolbox and Frame-sheet cards; ticket 384), shared by the Toolbox's Edit group
 * (undo, redo, rotate, copy) and the phone Frame sheet (rotate, copy, paste -- Undo and Redo live in the Zoom pill
 * there, ticket 296): both read the same registry actions and the same enabled state.
 */
const props = withDefaults(
  defineProps<{
    ids: readonly EditControlId[]
    deps?: unknown
    iconSize?: IconSize
    /** Each caller names its own testid pattern (`${id}-button` in the Toolbox, `sheet-${id}` in the sheet);
     * `undefined` leaves the attribute off, as the sheet's Copy button does today. */
    testIdFor: (id: EditControlId) => string | undefined
  }>(),
  { deps: undefined, iconSize: undefined },
)

const emit = defineEmits<{ activate: [id: EditControlId] }>()

const actions = Object.fromEntries(props.ids.map((id) => [id, controlAction(id)])) as Record<
  EditControlId,
  ReturnType<typeof controlAction>
>

/** Undo and Copy carry the product tour's step ids (ticket 80, switched off); Redo and Paste don't. */
function dataTour(id: EditControlId) {
  return id === 'undo' || id === 'copy' ? id : undefined
}
</script>

<template>
  <IconButton
    v-for="id in ids"
    :key="id"
    variant="toolbox"
    size="lg"
    :icon-size="iconSize"
    :action="actions[id]"
    :deps="deps"
    :data-testid="testIdFor(id)"
    :data-tour="dataTour(id)"
    @click="emit('activate', id)"
  />
</template>
