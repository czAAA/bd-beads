<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import type { SignInRefusal } from '../../domain/account'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppMessage from '../ui/AppMessage.vue'
import GoogleMark from '../ui/GoogleMark.vue'

// The Sign in Subpanel of the Menu (SignIn card, ticket 0078): what signing in is for, what openbeads keeps in plain
// sight above the button, then Continue with Google and the line that a first sign-in makes the account. Back from
// Google refused, the reason stands at the top.
const props = defineProps<{
  /** Why the last try didn't sign the person in. */
  refusal?: SignInRefusal
  /** Cloudflare's widget is asking the person something. */
  asks: boolean
  /** Between the press on the Google button and the page leaving for Google, Cloudflare's check included. */
  leaving: boolean
  /** Starts Cloudflare's check in the element as the Subpanel opens; returns what to call as it closes. */
  verify: (container: HTMLElement) => () => void
}>()
const emit = defineEmits<{ continue: [] }>()

const { t } = useI18n()
const words = computed(() => t.value.account)
const headingId = useId()

/** Each refusal's tone (SignIn card, Back from Google). */
const TONES = { cancelled: 'info', failed: 'danger', paused: 'warning' } as const

const verifyEl = ref<HTMLElement>()
let stopVerifying: (() => void) | undefined
onMounted(() => {
  if (verifyEl.value) stopVerifying = props.verify(verifyEl.value)
})
onBeforeUnmount(() => stopVerifying?.())
</script>

<template>
  <div class="sign-in" data-testid="sign-in-panel">
    <AppMessage v-if="refusal" :tone="TONES[refusal]" placement="notice" :closable="false" role="alert" data-testid="sign-in-refusal">{{ words[refusal] }}</AppMessage>
    <p class="sign-in__purpose">{{ words.purpose }}</p>
    <section class="sign-in__keeps" :aria-labelledby="headingId">
      <h3 :id="headingId" class="sign-in__heading">{{ words.keepsHeading }}</h3>
      <!-- One row per thing kept: a ticket that stores one more thing adds a row. -->
      <ul class="sign-in__list" data-testid="sign-in-keeps">
        <li v-for="kept in [words.keepsEmail, words.keepsSettings]" :key="kept" class="sign-in__kept">
          <AppIcon name="check" :size="16" class="sign-in__check-mark" />
          <span>{{ kept }}</span>
        </li>
      </ul>
      <p class="sign-in__nothing">{{ words.keepsNothingElse }}</p>
    </section>
    <!-- Cloudflare's check runs unseen; its own widget shows here only when it asks the person something. -->
    <div class="sign-in__check" :class="{ 'sign-in__check--asks': asks }">
      <p v-if="asks" class="sign-in__check-note" data-testid="sign-in-check-note">{{ words.oneMoreCheck }}</p>
      <div ref="verifyEl" class="sign-in__verify" />
    </div>
    <div class="sign-in__action">
      <AppButton class="sign-in__google" :disabled="leaving" data-panel-entry data-testid="sign-in-google" @click="emit('continue')">
        <GoogleMark />
        {{ leaving ? words.openingGoogle : words.continueWithGoogle }}
      </AppButton>
      <p class="sign-in__hint">{{ words.firstTime }}</p>
    </div>
  </div>
</template>

<style scoped>
.sign-in {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.sign-in__purpose {
  margin: 0;
  font: var(--type-body);
  color: var(--muted);
}

.sign-in__keeps {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.sign-in__heading {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

.sign-in__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin: 0;
  padding: var(--space-10) var(--space-12);
  list-style: none;
  background: var(--surface);
  border-radius: var(--radius-md);
}

:root[data-theme='contrast'] .sign-in__list {
  border: 2px solid var(--line-strong);
}

.sign-in__kept {
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
  font: var(--type-control);
  color: var(--ink);
}

.sign-in__check-mark {
  flex: none;
  margin-top: var(--space-2);
  color: var(--muted);
}

.sign-in__nothing {
  margin: 0;
  font: var(--type-body);
  color: var(--body);
}

/* Nothing of the check takes room until Cloudflare asks the person something. */
.sign-in__check:not(.sign-in__check--asks) {
  display: none;
}

.sign-in__check {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.sign-in__check-note {
  margin: 0;
  font: var(--type-small);
  color: var(--muted);
}

.sign-in__action {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

/* The app's secondary Button at the form's field height, the Subpanel's full width; Google's mark 10 before the label. */
.sign-in__google {
  gap: var(--space-10);
  width: 100%;
  height: var(--field-height);
}

/* Busy, from the press until the page leaves for Google: muted on `surface`, the mark as it is. */
.sign-in__google[aria-disabled='true'] {
  color: var(--muted);
  background: var(--surface);
  cursor: default;
}

.sign-in__hint {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}
</style>
