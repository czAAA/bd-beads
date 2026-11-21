<script setup lang="ts">
import { computed } from 'vue'
import type { Handedness, InputMode } from '../../domain/inputMode'
import type { PillPosition } from '../../domain/toolPill'
import { pagesBase } from '../../i18n/addressLocale'
import { useI18n } from '../../i18n/useI18n'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useKeyHints } from '../../composables/ui/useKeyHints'
import { homepageUrl } from '../../homepage/homepageRoute'
import type { ThemePick } from '../../theme/theme'
import { useThemePick } from '../../theme/useThemePick'
import type { Account } from '../../domain/account'
import AccountSection from './AccountSection.vue'
import PanelFactRow from './PanelFactRow.vue'
import PanelItem from './PanelItem.vue'
import PanelPicker from './PanelPicker.vue'
import PanelSection from './PanelSection.vue'
import type { IconName } from '../ui/icons'
import { inject } from 'vue'
import { PANEL_CONTEXT } from './panelContext'
import { COFFEE_URL } from '../../data/coffeeLink'
import { PRIVACY_URL } from '../../data/privacyLink'
import { SOURCE_URL } from '../../data/sourceLink'
import { BUILD_MARK, BUILD_VERSION } from '../../data/build'

// The body of Menu (spec 0440, tickets 443, 0553; MenuPanel card): five folding sections, the same rows on every page
// (1113) but the demo's Projects and shortcuts (0797); the Homepage's New Project and Sign in open the editor, pushing no
// Subpanel. A row that leaves the page awaits `leave` first; Convert image is the current page while open (0756).
const props = withDefaults(
  defineProps<{
    /** The page the panel is opened on. */
    page?: 'editor' | 'homepage' | 'convert-image'
    /** Leaves the current page: true once it has gone (or had nothing to ask), false when the person stayed. */
    leave?: () => Promise<boolean>
    /** How many Projects the library holds, sealed ones too (ticket 0716). */
    projectCount?: number
    /** The Projects couldn't be opened, so none is counted: Saved Projects is still there, to say so (spec 1018). */
    countUnknown?: boolean
    toolsPosition?: PillPosition
    inputMode?: InputMode
    handedness?: Handedness
    /** Input shows only once a pen has been seen (ticket 326), and is absent, not disabled, before. */
    penSeen?: boolean
    /** The Homepage's demo editor (ticket 0797): only the Projects and Keyboard shortcuts, so nothing in the demo
     * changes the app; its New Project empties the demo, with no form. */
    demo?: boolean
    /** Whether the browser keeps the Projects (tickets 0839, 0936): the row shows it; absent where it can't say. */
    kept?: boolean
    /** The signed-in account (ticket 0078); none for a Guest. */
    account?: Account
    /** A press on Sign in: whether its Subpanel may open, false once a toast said signing in can't be done now. */
    mayOpenSignIn?: () => Promise<boolean>
  }>(),
  {
    page: 'editor',
    demo: false,
    leave: () => Promise.resolve(true),
    projectCount: 0,
    toolsPosition: 'left',
    inputMode: 'mouse',
    handedness: 'right',
    penSeen: false,
    kept: undefined,
    account: undefined,
    mayOpenSignIn: () => Promise.resolve(true),
  },
)
/** On the Homepage New Project and Sign in open the editor (ticket 1113): the page goes, with no Subpanel pushed here. */
const onHomepage = computed(() => props.page === 'homepage')
/** Whether New Project opens its form here: not in the demo, which it empties, nor on the Homepage, which leaves. */
const formHere = computed(() => !props.demo && !onHomepage.value)
const converting = computed(() => props.page === 'convert-image')
const emit = defineEmits<{
  'saved-projects': []
  'new-project': []
  'convert-image': []
  'update:toolsPosition': [position: PillPosition]
  'update:inputMode': [mode: InputMode]
  'update:handedness': [hand: Handedness]
  /** The Keyboard shortcuts Subpanel is about to be pushed (ticket 1159). */
  shortcuts: []
  /** What the buttons do (ticket 0927): every strip and pill button shows its name until the next press. */
  'button-names': []
  /** Opens the Feedback sheet with its Report kind (ticket 0700). */
  feedback: [kind: 'general' | 'translation']
  /** The Sign in Subpanel is about to be pushed, and Sign out (ticket 0078). */
  'sign-in': []
  'sign-out': []
  'delete-account': []
}>()

const { t } = useI18n()
const { pick, setPick } = useThemePick()
const { shown: hintsShown } = useKeyHints()
const context = inject(PANEL_CONTEXT)

/** Under the address's language folder when it names one (ticket 1053), which the language switch changes. */
const homepageHref = computed(() => homepageUrl(pagesBase()))

const actions = {
  newProject: controlAction('new-project'),
  savedProjects: controlAction('saved-projects'),
  convertImage: controlAction('convert-image'),
  shortcuts: controlAction('shortcuts-help'),
}

/** New Project leaves the page, so it opens its form once the page has let go. The demo's empties the demo and the
 * Homepage's opens the editor on the form, at once, as the panel goes. */
async function openNewProject() {
  if (!(await props.leave())) return
  emit('new-project')
  context?.openSub()
}

/** The Homepage is another document: a link that leaves a page with something to lose waits for the page's answer. */
async function openHomepage(event: MouseEvent) {
  if (props.page === 'editor') return
  event.preventDefault()
  if (await props.leave()) location.assign(homepageHref.value)
}

const themeOptions = computed<{ value: ThemePick; icon: IconName; label: string }[]>(() => [
  { value: 'device', icon: 'device', label: t.value.theme.matchDevice },
  { value: 'light', icon: 'sun', label: t.value.panels.menu.themeLight },
  { value: 'dark', icon: 'moon', label: t.value.panels.menu.themeDark },
  { value: 'contrast', icon: 'contrast', label: t.value.theme.contrast },
])
const positionOptions = computed(() => [
  { value: 'left' as const, icon: 'position-left' as const, label: t.value.toolPill.left },
  { value: 'top' as const, icon: 'position-top' as const, label: t.value.toolPill.top },
  { value: 'right' as const, icon: 'position-right' as const, label: t.value.toolPill.right },
  { value: 'bottom' as const, icon: 'position-bottom' as const, label: t.value.toolPill.bottom },
])
const handOptions = computed(() => [
  { value: 'right' as const, label: t.value.panels.menu.right },
  { value: 'left' as const, label: t.value.panels.menu.left },
])
const inputOptions = computed(() => [
  { value: 'pen' as const, label: t.value.panels.menu.pen, icon: 'pen-mode' as const },
  { value: 'mouse' as const, label: t.value.panels.menu.mouse, icon: 'pen-mode-off' as const },
])
</script>

<template>
  <div class="menu-panel" data-testid="menu-panel">
    <!-- Account (ticket 0078): the demo and the demo tour have none. -->
    <AccountSection v-if="!demo" :account="account" :leave="leave" :may-open-sign-in="mayOpenSignIn" :sign-in-here="!onHomepage" @sign-in="emit('sign-in')" @sign-out="emit('sign-out')" @delete-account="emit('delete-account')" />
    <PanelSection id="menu:projects" :label="t.panels.menu.projects">
      <!-- New Project opens in this panel (spec 0478): the shell swaps to the subpanel the app shell fills. -->
      <PanelItem icon="plus" accent :sub="formHere" :stays="formHere" data-testid="menu-new-project" @select="formHere ? openNewProject() : emit('new-project')">{{ actions.newProject.name(t) }}</PanelItem>
      <!-- Convert image is an App page (ADR 0086): while it is open, its row is the current page. -->
      <PanelItem icon="image" :aria-current="converting ? 'page' : undefined" data-testid="menu-convert-image" @select="converting || emit('convert-image')">
        {{ actions.convertImage.name(t) }}
      </PanelItem>
      <PanelItem icon="library" :value="countUnknown ? undefined : String(projectCount)" sub stays data-testid="menu-saved-projects" @select="emit('saved-projects'); context?.openSub()">
        {{ actions.savedProjects.name(t) }}
      </PanelItem>
      <!-- Whether the browser keeps the Projects, as a fact with its reason behind an Info button (tickets 0839, 0936). -->
      <PanelFactRow
        v-if="!demo && kept !== undefined"
        icon="device"
        :label="t.panels.menu.keepProjects"
        :value="kept ? t.panels.menu.keepProjectsOn : t.panels.menu.keepProjectsOff"
        :info-label="t.panels.menu.keepProjectsInfoLabel"
        :body="t.panels.menu.keepProjectsInfo"
        testid="menu-keep-projects"
      />
    </PanelSection>

    <PanelSection v-if="!demo" id="menu:preferences" :label="t.panels.menu.preferences">
      <PanelPicker
        :model-value="pick"
        :label="t.theme.groupLabel"
        icon="sun"
        :options="themeOptions"
        data-testid="theme-picker"
        @update:model-value="setPick"
      />
      <PanelPicker
        :model-value="toolsPosition"
        :label="t.toolPill.position"
        icon="grid"
        :options="positionOptions"
        data-testid="menu-tools-position"
        @update:model-value="emit('update:toolsPosition', $event)"
      />
      <PanelPicker
        v-if="penSeen"
        :model-value="inputMode"
        :label="t.panels.menu.input"
        icon="pen-mode"
        :options="inputOptions"
        data-testid="menu-input-mode"
        @update:model-value="emit('update:inputMode', $event)"
      />
      <PanelPicker
        v-if="penSeen"
        :model-value="handedness"
        :label="t.panels.menu.writingHand"
        icon="pen-mode"
        :options="handOptions"
        data-testid="menu-handedness"
        @update:model-value="emit('update:handedness', $event)"
      />
    </PanelSection>

    <PanelSection id="menu:help" :label="t.panels.menu.help">
      <!-- Keyboard shortcuts is Menu's Subpanel (ticket 1159, ShortcutsHelp card), wider than Menu; the key shows where a keyboard is. -->
      <PanelItem icon="keyboard" :value="hintsShown ? '?' : undefined" sub stays data-testid="menu-item-shortcuts" @select="emit('shortcuts'); context?.openSub()">{{ t.shortcutsHelp.title }}</PanelItem>
      <PanelItem v-if="!demo" icon="info" data-testid="menu-item-button-names" @select="emit('button-names')">{{ t.panels.menu.buttonNames }}</PanelItem>
      <PanelItem v-if="!demo" icon="message" data-testid="menu-item-feedback" @select="emit('feedback', 'general')">{{ t.panels.menu.sendFeedback }}</PanelItem>
      <!-- Report a translation problem sits under Send feedback: both open the FeedbackSheet (tickets 0700, 1144). -->
      <PanelItem v-if="!demo" secondary data-testid="menu-report-translation" @select="emit('feedback', 'translation')">{{ t.panels.menu.reportTranslation }}</PanelItem>
      <PanelItem v-if="!demo" icon="bead" :href="homepageHref" :aria-current="onHomepage ? 'page' : undefined" data-testid="menu-item-homepage" @click="openHomepage">{{ t.header.homepageItem }}</PanelItem>
    </PanelSection>

    <PanelSection v-if="!demo" id="menu:about" :label="t.panels.menu.about">
      <!-- The repository is public under AGPL-3.0 (ADR 0031, ticket 269); this link is what the license's network clause requires a hosted copy to offer. -->
      <PanelItem icon="code" :href="SOURCE_URL" external data-testid="menu-item-source">{{ t.header.sourceItem }}</PanelItem>
      <PanelItem icon="eye-off" :href="PRIVACY_URL" external data-testid="menu-item-privacy">{{ t.account.privacy }}</PanelItem>
      <PanelItem v-if="COFFEE_URL" icon="coffee" accent-icon :href="COFFEE_URL" external data-testid="menu-item-coffee">{{ t.panels.menu.coffee }}</PanelItem>
      <div class="menu-panel__version" data-testid="menu-version">
        <span>{{ t.panels.menu.version }}</span>
        <span class="menu-panel__number">{{ BUILD_VERSION }} <span class="menu-panel__build">· {{ BUILD_MARK }}</span></span>
      </div>
    </PanelSection>
  </div>
</template>

<style scoped>
.menu-panel__version {
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-10) 0 calc(var(--space-10) + 16px + var(--space-8));
  font: var(--type-control);
  color: var(--muted);
}

.menu-panel__number {
  font: var(--type-meta);
  font-variant-numeric: tabular-nums;
}

/* The build mark after the Version, a step quieter (ticket 1045). */
.menu-panel__build {
  color: var(--subtle);
}
</style>
