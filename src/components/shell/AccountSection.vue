<script setup lang="ts">
import { computed, inject, nextTick, ref } from 'vue'
import type { Account } from '../../domain/account'
import { ACCOUNT_SECTION } from '../../composables/shell/useAccountFlow'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import InfoButton from '../ui/InfoButton.vue'
import PanelItem from './PanelItem.vue'
import PanelSection from './PanelSection.vue'
import { PANEL_CONTEXT } from './panelContext'

// The Menu's Account section (MenuPanel card, ticket 0078). A Guest gets Sign in and the line that everything works
// without an account; a signed-in person the email and plan as a fact (neither name nor picture is stored), the settings
// line (1086), Sign out with no confirm, and Delete account, which asks first (0082).
const props = withDefaults(defineProps<{
  /** The signed-in account; none for a Guest. */
  account?: Account
  /** Leaves the current page first, as New Project does: signing in reloads the page. */
  leave: () => Promise<boolean>
  /** Whether the Sign in Subpanel may open: false after a toast said signing in can't be done now. */
  mayOpenSignIn: () => Promise<boolean>
  /** Whether Sign in pushes its Subpanel here; on the Homepage it opens the editor on it instead (ticket 1113). */
  signInHere?: boolean
}>(), { account: undefined, signInHere: true })
const emit = defineEmits<{
  /** The Sign in Subpanel is about to be pushed. */
  'sign-in': []
  'sign-out': []
  /** Delete account was pressed: the shell asks "Delete your account?" first (ticket 0082). */
  'delete-account': []
}>()

const { t } = useI18n()
const context = inject(PANEL_CONTEXT)
const section = ref<InstanceType<typeof PanelSection>>()
const plan = computed(() => (props.account?.plan === 'pro' ? t.value.account.planPro : t.value.account.planFree))

/** A second press while the backend is being asked opens nothing twice. */
let asking = false

async function openSignIn() {
  if (asking) return
  asking = true
  try {
    if (!(await props.leave()) || !(await props.mayOpenSignIn())) return
    emit('sign-in')
    if (props.signInHere) context?.openSub(t.value.account.signIn, { opener: 'menu-sign-in' })
  } finally {
    asking = false
  }
}

/** The row pressed is gone once signed out: focus moves to Sign in, which took its place. */
async function signOut() {
  emit('sign-out')
  await nextTick()
  ;(section.value?.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('[data-testid="menu-sign-in"]')?.focus({ preventScroll: true })
}
</script>

<template>
  <PanelSection :id="ACCOUNT_SECTION" ref="section" :label="t.account.section">
    <template v-if="!account">
      <PanelItem icon="account" sub stays data-testid="menu-sign-in" @select="openSignIn">{{ t.account.signIn }}</PanelItem>
      <p class="account-section__note" data-testid="menu-account-note">{{ t.account.guestNote }}</p>
    </template>
    <template v-else>
      <!-- A fact, not a button. A long address cuts at its end, so the whole of it is the row's Tooltip. -->
      <AppTooltip :name="account.email" :announce="false" class="account-section__tip">
        <div class="account-section__who" data-testid="menu-account">
          <AppIcon name="account" :size="16" />
          <span class="account-section__email" data-user-text data-testid="menu-account-email">{{ account.email }}</span>
          <span class="account-section__plan" data-testid="menu-account-plan">{{ plan }}</span>
        </div>
      </AppTooltip>
      <!-- The line never changes; its Info button lists which settings are the same on every device (ticket 1086). -->
      <p class="account-section__note account-section__settings" data-testid="menu-account-settings">
        {{ t.account.settingsLine }}
        <InfoButton :label="t.account.settingsInfoLabel" :body="t.account.settingsInfo" data-testid="menu-account-settings-info" />
      </p>
      <PanelItem icon="sign-out" stays data-testid="menu-sign-out" @select="signOut">{{ t.account.signOut }}</PanelItem>
      <PanelItem icon="delete" danger stays data-testid="menu-delete-account" @select="emit('delete-account')">{{ t.account.deleteAccount }}</PanelItem>
    </template>
  </PanelSection>
</template>

<style scoped>
/* From the label column: under the row's label, clear of its icon. */
.account-section__note {
  margin: 0;
  padding: 0 var(--space-10) var(--space-6) calc(var(--space-10) + 16px + var(--space-8));
  font: var(--type-small);
  color: var(--muted);
}

/* The Info button ends the sentence, on its last line, without making that line taller than the others. */
.account-section__settings :deep(.icon-btn-wrap) {
  margin-block: calc(var(--space-8) * -1);
  vertical-align: middle;
}

.account-section__tip {
  display: block;
}

.account-section__who {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2) var(--space-8);
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
}

/* One line, cut at its end; the plan beside it stays whole. */
.account-section__email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: text;
}

.account-section__plan {
  font: var(--type-meta);
  color: var(--muted);
}

/* On a phone the plan drops under the email, from the label column, and may wrap. */
@media (max-width: 30rem) {
  .account-section__who {
    grid-template-columns: auto minmax(0, 1fr);
    padding-top: var(--space-6);
    padding-bottom: var(--space-6);
  }

  .account-section__plan {
    grid-column: 2;
  }
}
</style>
