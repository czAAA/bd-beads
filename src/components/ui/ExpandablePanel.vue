<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import ExpandButton from './ExpandButton.vue'
import type { IconName } from './icons'

/**
 * The expandable panel template (ticket 146; BeadsNeeded and SavedProjectsExpanded cards), shared by Beads needed and
 * Saved Projects. A 28px header: an optional `icon` (ticket 188: Saved Projects' own library icon, at every tier),
 * the title (`control`) with an optional muted `suffix`, optional `meta` on the right, then the round expand button.
 * Collapsed, the body is a fixed-height summary (`collapsedHeight`); expanded, the box grows downward to its natural
 * height, never less, pushing the boxes below it down, and shows the `footer`. Escape from inside it, or ↑, collapses
 * it. An empty panel keeps its header, drops the expand button and the fixed height.
 */
const props = withDefaults(
  defineProps<{
    title: string
    icon?: IconName
    /** Whether there is more than the summary shows; without it there is no expand button. */
    expandable?: boolean
    /** Nothing to list: the body is just its one line. */
    empty?: boolean
    collapsedHeight?: string
    /**
     * Whether the collapsed body clips content past `collapsedHeight` (ticket 175). BeadsNeeded needs this: it draws
     * every row and relies on the clip to show only the summary ones. Saved Projects already slices down to its own
     * summary count before this ever sees it, so it turns the clip off instead — the clip was cutting off a
     * truncated name's hover tooltip, which sits below the row that names it.
     */
    clipOverflow?: boolean
  }>(),
  { icon: undefined, expandable: false, empty: false, collapsedHeight: 'var(--panel-body-height)', clipOverflow: true },
)

const expanded = defineModel<boolean>('expanded', { default: false })
const { t } = useI18n()
const headEl = ref<HTMLElement>()

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !expanded.value || !props.expandable) return
  event.preventDefault()
  event.stopPropagation()
  expanded.value = false
  headEl.value?.querySelector<HTMLElement>('[data-testid="panel-expand"]')?.focus()
}
</script>

<template>
  <section
    class="expandable-panel"
    :class="{ 'expandable-panel--expanded': expanded && expandable }"
    @keydown="onKeydown"
  >
    <div ref="headEl" class="expandable-panel__head">
      <AppIcon v-if="icon" :name="icon" :size="16" class="expandable-panel__icon" />
      <h2 class="expandable-panel__title">
        {{ title }}<span v-if="$slots.suffix" class="expandable-panel__suffix">{{ ' ' }}<slot name="suffix" /></span>
      </h2>
      <span class="expandable-panel__meta">
        <slot name="meta" />
        <kbd v-if="expanded && expandable" class="expandable-panel__kbd" aria-hidden="true">esc</kbd>
        <ExpandButton
          v-if="expandable && !empty"
          :expanded="expanded"
          :label="expanded ? t.a11y.collapsePanel : t.a11y.expandPanel"
          data-testid="panel-expand"
          @click="expanded = !expanded"
        />
      </span>
    </div>
    <div
      class="expandable-panel__body"
      :class="{
        'expandable-panel__body--fixed': !empty && !(expanded && expandable),
        'expandable-panel__body--no-clip': !clipOverflow,
      }"
      :style="{ '--collapsed-height': collapsedHeight }"
    >
      <slot />
    </div>
    <div v-if="expanded && expandable && $slots.footer" class="expandable-panel__footer">
      <slot name="footer" />
    </div>
  </section>
</template>

<style scoped>
/* Elevation 1 in light; in dark and high contrast the token is none and the `panel` step carries it. */
.expandable-panel {
  box-sizing: border-box;
  padding: var(--space-14) var(--space-20) var(--space-16);
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
}

.expandable-panel__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-height: var(--panel-head-height);
  margin-bottom: var(--space-8);
}

.expandable-panel__icon {
  flex: none;
  color: var(--muted);
}

.expandable-panel__title {
  min-width: 0;
  margin: 0;
  font: var(--type-control);
  color: var(--ink);
}

.expandable-panel__suffix {
  font-weight: 400;
  color: var(--body);
}

.expandable-panel__meta {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-6);
  margin-left: auto;
  font: var(--type-meta-small);
  color: var(--muted);
}

.expandable-panel__kbd {
  padding: 0 var(--space-4);
  font: var(--type-meta-tiny);
  color: var(--muted);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-xs);
}

.expandable-panel__body--fixed {
  height: var(--collapsed-height);
  overflow: hidden;
}

.expandable-panel__body--no-clip {
  overflow: visible;
}

.expandable-panel__body:not(.expandable-panel__body--fixed) {
  min-height: 0;
}

.expandable-panel--expanded .expandable-panel__body {
  min-height: var(--collapsed-height);
}

.expandable-panel__footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
  margin-top: var(--space-12);
  padding-top: var(--space-12);
  border-top: 1px solid var(--line-soft);
}

@media (pointer: coarse) {
  .expandable-panel__kbd {
    display: none;
  }
}
</style>
