<script setup lang="ts">
import { fillBlanks } from '../../domain/fillBlanks'
import type { UpdateSummary } from '../../domain/waitingBuild'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from './AppIcon.vue'
import KindLabel from './KindLabel.vue'

/** "Update ready"'s list of what waits (ticket 1091, Message card), which its What's new opens under the actions: a row
 * per note, its kind label and line as the one-note toast draws it, then, when more wait than it holds, a link to the
 * rest on the Homepage's What's new, which leaves as What's new's own link did. */
defineProps<{
  list: NonNullable<UpdateSummary['list']>
  more?: number
  href?: string
}>()
const emit = defineEmits<{ leave: [] }>()
const { t } = useI18n()
</script>

<template>
  <span class="toast-update-list">
    <ol class="toast-update-list__notes" data-testid="update-list">
      <li v-for="(note, index) in list" :key="index" class="toast-update-list__note">
        <KindLabel class="toast-update-list__kind" :kind="note.kind" />{{ note.line }}
      </li>
    </ol>
    <!-- A sentence, not a word: on the narrowest phone it may take two lines. -->
    <a v-if="more" :href="href" class="ui-control toast-update-list__more" data-wrap-ok data-testid="update-more" @click="emit('leave')">
      {{ fillBlanks(t.shell.updateMore, { count: more }) }}<AppIcon class="toast-update-list__mark" name="external" :size="16" />
    </a>
  </span>
</template>

<style scoped>
/* Under the actions, after a thin line in the toast's own line color; the list scrolls when the toast runs out of
 * room, and the link under it stays in view. */
.toast-update-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-10);
  min-height: 0;
  margin-top: var(--space-10);
  padding-top: var(--space-10);
  border-top: 1px solid var(--message-line);
}

.toast-update-list__notes {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  align-self: stretch;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}

/* A note as the one-note toast draws it: its kind label, then its line in `body`, wrapping under the label. */
.toast-update-list__note {
  color: var(--body);
}

.toast-update-list__kind {
  margin-right: var(--space-6);
}

/* The text-button action's look (Message card, `bb-link`), with the arrow of a link that leaves in `muted`. */
.toast-update-list__more {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-4);
  font: var(--type-control);
  color: var(--ink);
  text-decoration: underline;
}

.toast-update-list__mark {
  color: var(--muted);
}
</style>
