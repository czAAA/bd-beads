<script setup lang="ts">
import AppIcon from '../AppIcon.vue'

/** A form field's frame (ticket 149): label, optional note, hint and error; `labelFor` names the control, a group
 * takes `labelId` instead. */
defineProps<{
  label: string
  labelFor?: string
  labelId?: string
  /** Shown right of the label: "optional", or a note like the size in the other unit. The `aside` slot overrides this
   * with richer content (ticket 170: the size estimate's own info tooltip) while keeping the same placement. */
  aside?: string
  hint?: string
  error?: string
  errorTestid?: string
}>()
</script>

<template>
  <div class="form-field">
    <div class="form-field__label-row">
      <label v-if="labelFor" :id="labelId" class="form-field__label" :for="labelFor">{{ label }}</label>
      <span v-else :id="labelId" class="form-field__label">{{ label }}</span>
      <span v-if="aside || $slots.aside" class="form-field__aside">
        <slot name="aside">{{ aside }}</slot>
      </span>
    </div>
    <slot />
    <p v-if="hint" class="form-field__hint">{{ hint }}</p>
    <p v-if="error" class="form-field__error" role="alert" :data-testid="errorTestid">
      <AppIcon name="warning" :size="14" />
      <span>{{ error }}</span>
    </p>
    <slot name="after" />
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-width: 0;
}

.form-field__label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-8);
}

/* A plain label: none of the ticket-02 pill look the global `label` rule still carries. */
.form-field__label {
  display: block;
  margin: 0;
  padding: 0;
  font: var(--type-control);
  color: var(--ink);
  background: none;
  border-radius: 0;
}

.form-field__aside {
  font: var(--type-meta-small);
  color: var(--muted);
  text-transform: lowercase;
  white-space: nowrap;
}

.form-field__hint {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.form-field__error {
  display: flex;
  gap: var(--space-6);
  align-items: flex-start;
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--danger);
}

.form-field__error > .icon {
  margin-top: var(--space-2);
}
</style>
