<script setup lang="ts">
import { computed } from 'vue'
import type { Handedness, InputMode } from '../../domain/inputMode'
import type { PillPosition } from '../../domain/toolPill'
import { useI18n } from '../../i18n/useI18n'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useKeyHints } from '../../composables/ui/useKeyHints'
import { homepageUrl } from '../../homepage/homepageRoute'
import { LOCALES, LOCALE_NAMES, localeCode } from '../../domain/locale'
import type { ThemePick } from '../../theme/theme'
import { useThemePick } from '../../theme/useThemePick'
import PanelItem from './PanelItem.vue'
import PanelPicker from './PanelPicker.vue'
import PanelSection from './PanelSection.vue'
import type { IconName } from '../ui/icons'
import { inject } from 'vue'
import { PANEL_CONTEXT } from './panelContext'
import { COFFEE_URL } from '../../data/coffeeLink'

// The body of Menu (spec 0440, tickets 443, 0553; MenuPanel card): the app and the device in four folding sections. It only
// asks: the app shell does the work. On the Homepage (ticket 540) the editor's parts are left out, Saved Projects kept (ticket
// 0716). A row that leaves the page awaits `leave` first and knows no page; Convert image is the current page while open (0756).
const props = withDefaults(
  defineProps<{
    /** The page the panel is opened on. */
    page?: 'editor' | 'homepage' | 'convert-image'
    /** Leaves the current page: true once it has gone (or had nothing to ask), false when the person stayed. */
    leave?: () => Promise<boolean>
    /** How many Projects the library holds, sealed ones too (ticket 0716). */
    projectCount?: number
    toolsPosition?: PillPosition
    inputMode?: InputMode
    handedness?: Handedness
    /** Input shows only once a pen has been seen (ticket 326), and is absent, not disabled, before. */
    penSeen?: boolean
  }>(),
  { page: 'editor', leave: () => Promise.resolve(true), projectCount: 0, toolsPosition: 'left', inputMode: 'mouse', handedness: 'right', penSeen: false },
)
const inEditor = computed(() => props.page !== 'homepage')
const converting = computed(() => props.page === 'convert-image')
const emit = defineEmits<{
  'saved-projects': []
  'new-project': []
  'convert-image': []
  'update:toolsPosition': [position: PillPosition]
  'update:inputMode': [mode: InputMode]
  'update:handedness': [hand: Handedness]
  shortcuts: []
  /** Opens the Feedback sheet with its Report kind (ticket 0700). */
  feedback: [kind: 'general' | 'translation']
}>()

const { t, locale, setLocale } = useI18n()
const { pick, setPick } = useThemePick()
const { shown: hintsShown } = useKeyHints()
const context = inject(PANEL_CONTEXT)

const SOURCE_URL = 'https://github.com/czAAA/bd-beads'
const homepageHref = homepageUrl(import.meta.env.BASE_URL)

const actions = {
  newProject: controlAction('new-project'),
  savedProjects: controlAction('saved-projects'),
  convertImage: controlAction('convert-image'),
  shortcuts: controlAction('shortcuts-help'),
}
const version = __APP_VERSION__

/** New Project leaves the page, so it opens its form once the page has let go. */
async function openNewProject() {
  if (!(await props.leave())) return
  emit('new-project')
  context?.openSub()
}

/** The Homepage is another document: a link that leaves a page with something to lose waits for the page's answer. */
async function openHomepage(event: MouseEvent) {
  if (props.page === 'editor') return
  event.preventDefault()
  if (await props.leave()) location.assign(homepageHref)
}

const languageOptions = LOCALES.map((code) => ({ value: code, label: LOCALE_NAMES[code], shortLabel: localeCode(code), lang: code }))
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
    <!-- On the Homepage only Saved Projects, while the library is not empty (ticket 0716). -->
    <PanelSection v-if="inEditor || projectCount > 0" id="menu:projects" :label="t.panels.menu.projects">
      <!-- New Project opens in this panel (spec 0478): the shell swaps to the subpanel the app shell fills. -->
      <PanelItem v-if="inEditor" icon="plus" accent sub stays data-testid="menu-new-project" @select="openNewProject">{{ actions.newProject.name(t) }}</PanelItem>
      <!-- Convert image is an App page (ADR 0086): while it is open, its row is the current page. -->
      <PanelItem v-if="inEditor" icon="image" :aria-current="converting ? 'page' : undefined" data-testid="menu-convert-image" @select="converting || emit('convert-image')">
        {{ actions.convertImage.name(t) }}
      </PanelItem>
      <PanelItem icon="library" :value="String(projectCount)" sub stays data-testid="menu-saved-projects" @select="emit('saved-projects'); context?.openSub()">
        {{ actions.savedProjects.name(t) }}
      </PanelItem>
    </PanelSection>

    <PanelSection id="menu:preferences" :label="t.panels.menu.preferences">
      <PanelPicker
        :model-value="locale"
        :label="t.languageSwitcher.ariaLabel"
        icon="globe"
        :options="languageOptions"
        data-testid="language-switcher"
        @update:model-value="setLocale"
      />
      <PanelItem secondary data-testid="menu-report-translation" @select="emit('feedback', 'translation')">{{ t.panels.menu.reportTranslation }}</PanelItem>
      <PanelPicker
        :model-value="pick"
        :label="t.theme.groupLabel"
        icon="sun"
        :options="themeOptions"
        data-testid="theme-picker"
        @update:model-value="setPick"
      />
      <PanelPicker
        v-if="inEditor"
        :model-value="toolsPosition"
        :label="t.toolPill.position"
        icon="grid"
        :options="positionOptions"
        data-testid="menu-tools-position"
        @update:model-value="emit('update:toolsPosition', $event)"
      />
      <PanelPicker
        v-if="inEditor && penSeen"
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
      <PanelItem v-if="inEditor" icon="keyboard" :value="hintsShown ? '?' : undefined" data-testid="menu-item-shortcuts" @select="emit('shortcuts')">{{ t.shortcutsHelp.title }}</PanelItem>
      <PanelItem icon="message" data-testid="menu-item-feedback" @select="emit('feedback', 'general')">{{ t.panels.menu.sendFeedback }}</PanelItem>
      <PanelItem icon="bead" :href="homepageHref" :aria-current="inEditor ? undefined : 'page'" data-testid="menu-item-homepage" @click="openHomepage">{{ t.header.homepageItem }}</PanelItem>
    </PanelSection>

    <PanelSection id="menu:about" :label="t.panels.menu.about">
      <!-- The repository is public under AGPL-3.0 (ADR 0031, ticket 269); this link is what the license's network clause requires a hosted copy to offer. -->
      <PanelItem icon="code" :href="SOURCE_URL" external data-testid="menu-item-source">{{ t.header.sourceItem }}</PanelItem>
      <PanelItem v-if="COFFEE_URL" icon="coffee" accent-icon :href="COFFEE_URL" external data-testid="menu-item-coffee">{{ t.panels.menu.coffee }}</PanelItem>
      <div class="menu-panel__version" data-testid="menu-version">
        <span>{{ t.panels.menu.version }}</span>
        <span class="menu-panel__number">{{ version }}</span>
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
}
</style>
