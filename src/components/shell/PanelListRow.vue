<script setup lang="ts">
// A two-line row of a panel list (MenuPanel card): a thumbnail, the name over a second line in `muted` (`sub` or its
// slot), and `actions` shown on hover or focus. `wraps`: a 44px thumbnail, the name on two lines, the line wrapping (0982).
// One button named by the words it shows (0940), `active` ringing the thumbnail; a `still` row only shows (0790).
defineProps<{ name: string; sub?: string; active?: boolean; selectTestid?: string; still?: boolean; wraps?: boolean }>()
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <div class="panel-list-row" :class="{ 'panel-list-row--active': active, 'panel-list-row--still': still, 'panel-list-row--wraps': wraps }">
    <component
      :is="still ? 'div' : 'button'"
      class="panel-list-row__select"
      :class="{ 'ui-control': !still }"
      :type="still ? undefined : 'button'"
      :aria-pressed="still ? undefined : active"
      :data-testid="selectTestid"
      @click="still || emit('select')"
    >
      <span class="panel-list-row__thumb"><slot name="thumb" /></span>
      <span class="panel-list-row__text">
        <span class="panel-list-row__name" data-user-text>{{ name }}</span>
        {{ ' ' }}
        <span v-if="sub || $slots.sub" class="panel-list-row__sub"><slot name="sub">{{ sub }}</slot></span>
      </span>
    </component>
    <span class="panel-list-row__actions"><slot name="actions" /></span>
  </div>
</template>

<style scoped>
.panel-list-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  min-height: var(--panel-row-two-line);
  padding: 0 var(--space-6);
  border-radius: var(--radius-sm);
}

@media (pointer: coarse) {
  .panel-list-row {
    min-height: var(--panel-row-two-line-touch);
  }
}

@media (hover: hover) {
  .panel-list-row:not(.panel-list-row--still):hover {
    background: var(--hover-fill);
  }
}

/* The whole row presses; the facts and actions sit over its right end. */
.panel-list-row__select {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
  align-self: stretch;
  padding: 0;
  font: var(--type-control);
  color: var(--ink);
  text-align: left;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.panel-list-row--still .panel-list-row__select {
  cursor: default;
}

.panel-list-row__select:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.panel-list-row__thumb {
  --thumbnail-size: var(--panel-thumbnail-size);
  display: grid;
  flex: none;
  border-radius: var(--radius-sm);
}

.panel-list-row__thumb :deep(.project-thumbnail) {
  border-radius: var(--radius-sm);
}

.panel-list-row__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-list-row__name,
.panel-list-row__sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-list-row__sub {
  font: var(--type-small);
  color: var(--muted);
}

/* A long name on two lines, then the ellipsis, and the second line wrapping (ticket 0982); the row grows round them. */
.panel-list-row--wraps {
  padding-block: var(--space-4);
}

.panel-list-row--wraps .panel-list-row__thumb {
  --thumbnail-size: var(--library-thumbnail-size);
}

.panel-list-row--wraps .panel-list-row__name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  white-space: normal;
  overflow-wrap: anywhere;
}

.panel-list-row--wraps .panel-list-row__sub {
  white-space: normal;
}

.panel-list-row__actions {
  display: flex;
  flex: none;
}

.panel-list-row--active .panel-list-row__thumb {
  box-shadow:
    0 0 0 2px var(--overlay-fill),
    0 0 0 4px var(--accent-strong);
}

.panel-list-row--active .panel-list-row__name {
  color: var(--accent-strong);
}

@media (forced-colors: active) {
  .panel-list-row--active .panel-list-row__thumb {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
}
</style>
