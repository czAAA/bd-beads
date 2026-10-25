<script setup lang="ts">
// A two-line row of a panel list (MenuPanel card): a thumbnail, the name (one line, ellipsis) over a second line in
// `muted`, then facts at the right, and an `actions` slot shown on hover or keyboard focus (the library's × Remove).
// The row is one button; `active` rings the thumbnail and colors the name (the open project).
defineProps<{ name: string; sub?: string; active?: boolean; label?: string; selectTestid?: string }>()
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <div class="panel-list-row" :class="{ 'panel-list-row--active': active }">
    <button class="ui-control panel-list-row__select" type="button" :aria-label="label" :aria-pressed="active" :data-testid="selectTestid" @click="emit('select')">
      <span class="panel-list-row__thumb"><slot name="thumb" /></span>
      <span class="panel-list-row__text">
        <span class="panel-list-row__name">{{ name }}</span>
        <span v-if="sub" class="panel-list-row__sub">{{ sub }}</span>
      </span>
    </button>
    <span class="panel-list-row__facts"><slot name="facts" /></span>
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
  .panel-list-row:hover {
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

.panel-list-row__select:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
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

.panel-list-row__facts {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
  color: var(--muted);
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
