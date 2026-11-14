<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '../../domain/grid'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { useScrollCut } from '../../composables/ui/useScrollCut'
import type { Project } from '../../domain/project'
import { fillBlanks } from '../../domain/fillBlanks'
import { projectNameOf } from '../../domain/layerRecord'
import { useI18n } from '../../i18n/useI18n'
import { COFFEE_URL } from '../../data/coffeeLink'
import { homepageUrl } from '../../homepage/homepageRoute'
import RollingSlogan from '../../homepage/RollingSlogan.vue'
import AppButton from '../ui/AppButton.vue'
import AppLogo from '../ui/AppLogo.vue'
import IconButton from '../ui/IconButton.vue'
import FileButton from '../ui/form/FileButton.vue'
import SaveReminder from './SaveReminder.vue'
import { imageInputAccept } from '../../domain/imageConversion'
import type { OpenPanel } from '../../composables/shell/openPanel'

// The canvas box's header strip on every App page (tickets 143, 540, 0756, ADRs 0046, 0073, 0085; CanvasStrip card): Menu ·
// Project (the save ring beside it while due, ticket 0922) · Frame on the left (Menu · Close on Convert image), the Brand in the middle, Rotate · Rulers · Undo · Redo, zoom
// and Export, never scrolled away, on the right (tickets 543, 0652, 0843); the Homepage's way in, its slogan as the wordmark.
const props = defineProps<{
  /** Which page the strip is on: the editor's Brand opens the Homepage, the Homepage's is the current page, and
   * Convert image's is plain, so leaving never happens by a link that asks nothing. */
  page?: 'editor' | 'homepage' | 'convert-image'
  project?: Project
  /** The open sheet, so Menu and Project show lit while theirs is open. */
  openPanel?: OpenPanel | null
  rulers?: boolean
  /** The reference image (ticket 0790): none yet, or shown or hidden; left out off the editor. */
  referenceImage?: 'none' | 'shown' | 'hidden'
  /** Whether the Frame panel is open, so the Frame button shows lit. */
  frameOpen?: boolean
  canUndo?: boolean
  canRedo?: boolean
  zoomPercent?: number
  /** The zoom range the buttons stop at, when it isn't the Project canvas's (the Homepage has its own). */
  zoomMinPercent?: number
  zoomMaxPercent?: number
  /** The Homepage's demo editor (ticket 0797): Menu, Project and Frame; Reference image, Undo and Redo, and the Brand,
   * which links nowhere. */
  demo?: boolean
  /** The Homepage's Welcome section has the way in itself (ticket 0830): the strip's is away, its place kept. */
  wayInAway?: boolean
  /** The demo beside What's inside's list (ticket 0830): the word its button reads, Expand or Collapse; none without. */
  expand?: 'expand' | 'collapse'
  /** The save ring while it is due (SaveReminder card, ticket 0922): beside the Project button; none hides it. */
  saveRing?: { beads: number; lastFileAt?: number; labelOpen: boolean }
}>()
const emit = defineEmits<{
  'select-panel': [sheet: 'menu' | 'project' | 'export']
  'toggle-frame': []
  /** Expand or Collapse: the demo asks for the section's whole width, or gives it back. */
  'toggle-expand': []
  /** Close (×) on Convert image: the page's way out, which asks first once a picture is set. */
  close: []
  'rotate-canvas': []
  'toggle-rulers': []
  /** The Reference image button with a picture: show or hide it. */
  'toggle-reference-image': []
  /** The Reference image button with none: the file picked in the picker it opened. */
  'pick-reference-image': [file: File]
  undo: []
  redo: []
  'zoom-in': []
  'zoom-out': []
  reset: []
  /** The save ring was pressed: Save, the action Save Project file and Ctrl/Cmd+S run. */
  'save-project-file': []
  /** The pointer or focus came onto the save ring (true) or left it (false). */
  'hold-save-ring': [on: boolean]
}>()

const { t } = useI18n()

/** Every button is a registry action, so its name, Tooltip, key and disabled reason come from there (ADR 0035). */
const actions = {
  menu: controlAction('strip-menu'),
  close: controlAction('close'),
  coffee: controlAction('strip-coffee'),
  project: controlAction('strip-project'),
  frame: controlAction('strip-frame'),
  export: controlAction('strip-export'),
  rotateCanvas: controlAction('rotate-canvas'),
  rulers: controlAction('rulers'),
  referenceImage: controlAction('reference-image'),
  undo: controlAction('undo'),
  redo: controlAction('redo'),
  zoomOut: controlAction('zoom-out'),
  zoomIn: controlAction('zoom-in'),
  zoomFit: controlAction('zoom-fit'),
}
/** The Project button shows the open Project's name (ticket 0858), and is named and Tooltipped "Project: {name}" whole. */
const projectName = computed(() => (props.project ? projectNameOf(props.project) : ''))
const projectNamed = computed(() => fillBlanks(t.value.header.projectButtonNamed, { name: projectName.value }))
const deps = computed(() => controlDeps({ activeProject: () => props.project, canUndo: () => !!props.canUndo, canRedo: () => !!props.canRedo }))
/** Rulers is lit only while it can be pressed: on an empty Canvas it is held and plain, whatever the device keeps (ticket 0921). */
const rulersLit = computed(() => !!props.rulers && !!actions.rulers.enabled?.(deps.value))
const onHomepage = computed(() => props.page === 'homepage')
/** The Brand is a link only on the editor. */
const brandLinks = computed(() => !props.demo && (props.page === undefined || props.page === 'editor'))
const min = computed(() => props.zoomMinPercent ?? MIN_ZOOM_PERCENT)
const max = computed(() => props.zoomMaxPercent ?? MAX_ZOOM_PERCENT)
const homepageHref = homepageUrl(import.meta.env.BASE_URL)

// The Reference image button (ReferenceImage card): with no picture a plain button opening the Convert image picker,
// with one a toggle whose Tooltip says what a press does, with the `I` chip.
const referenceAccept = imageInputAccept()
const referencePickerEl = ref<HTMLElement>()
const referenceTooltip = computed(() => ({
  body: props.referenceImage === 'shown' ? t.value.referenceImage.hideTooltip : props.referenceImage === 'hidden' ? t.value.referenceImage.showTooltip : t.value.referenceImage.addTooltip,
}))
function onReferenceImage() {
  if (props.referenceImage === 'none') referencePickerEl.value?.querySelector<HTMLInputElement>('input[type="file"]')?.click()
  else emit('toggle-reference-image')
}
function onReferenceFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('pick-reference-image', file)
  // Picking the same file again still counts as a change.
  input.value = ''
}

// One Tab stop per section (ADR 0075): the panels, the Brand with the coffee link and the right-hand tools. ←/→ step inside
// a section and stop at its ends; ↓ on a panel button opens its panel, like Enter.
const panelsEl = ref<HTMLElement>()
const centerEl = ref<HTMLElement>()
const controlsEl = ref<HTMLElement>()
const panelsRoving = useRovingFocus(panelsEl, { axis: () => 'horizontal', managesTabIndex: true })
const centerRoving = useRovingFocus(centerEl, { selector: 'a[href]', axis: () => 'horizontal', managesTabIndex: true })
const controlsRoving = useRovingFocus(controlsEl, { selector: 'button, a[href]', axis: () => 'horizontal', managesTabIndex: true })
/** The right slot's scrolling row (ticket 0843): which of its edges cut a control, so that edge fades. */
const scrollerEl = ref<HTMLElement>()
const cut = useScrollCut(scrollerEl)

function onPanelsKeydown(event: KeyboardEvent) {
  const button = event.target as HTMLElement
  // ↓ opens a panel; the save ring has none, so it is not pressed by it.
  if (event.key === 'ArrowDown' && button.getAttribute('aria-pressed') !== 'true' && !button.closest('.save-ring')) {
    event.preventDefault()
    event.stopPropagation()
    button.click()
    return
  }
  panelsRoving.onKeydown(event)
}
</script>

<template>
  <header class="canvas-strip no-page-pan" :class="{ 'canvas-strip--homepage': onHomepage }" data-testid="canvas-strip">
    <!-- A header: the page's banner, outside main (ticket 0856, ScreenReaders card); inside the Homepage's demo, plain. -->
    <div class="canvas-strip__panels">
      <div ref="panelsEl" class="canvas-strip__panel-buttons" @keydown="onPanelsKeydown" @focusin="panelsRoving.onFocusin">
        <AppButton
          variant="text"
          :action="actions.menu"
          :selected="openPanel === 'menu' ? true : undefined"
          data-testid="strip-menu"
          @click="emit('select-panel', 'menu')"
        >
          <span class="canvas-strip__label">{{ actions.menu.name(t) }}</span>
        </AppButton>
        <IconButton v-if="page === 'convert-image'" variant="plain" :icon-size="18" :action="actions.close" data-testid="convert-close" @click="emit('close')" />
        <AppButton
          v-if="project"
          variant="text"
          class="canvas-strip__project"
          :action="actions.project"
          :label="projectNamed"
          :aria-label="projectNamed"
          :selected="openPanel === 'project' ? true : undefined"
          data-testid="strip-project"
          @click="emit('select-panel', 'project')"
        >
          <span class="canvas-strip__label canvas-strip__project-name" data-user-text>{{ projectName }}</span>
        </AppButton>
        <!-- The save ring (tickets 0796, 0922; SaveReminder card): beside the Project button, after it in Tab order. -->
        <SaveReminder
          v-if="project && saveRing"
          :beads="saveRing.beads"
          :last-file-at="saveRing.lastFileAt"
          :label-open="saveRing.labelOpen"
          @save="emit('save-project-file')"
          @hold="emit('hold-save-ring', $event)"
        />
        <AppButton
          v-if="project"
          variant="text"
          :action="actions.frame"
          :deps="deps"
          :selected="frameOpen"
          data-testid="strip-frame"
          @click="emit('toggle-frame')"
        >
          <span class="canvas-strip__label">{{ actions.frame.name(t) }}</span>
        </AppButton>
      </div>
      <!-- The Homepage's way into the editor (ticket 0822): its own Tab stops, styled here so the editor's first paint
           draws it as handed over. -->
      <div
        v-if="$slots['way-in']"
        class="canvas-strip__way-in"
        :class="{ 'canvas-strip__way-in--away': wayInAway }"
        :aria-hidden="wayInAway || undefined"
        :inert="wayInAway || undefined"
        data-testid="strip-way-in"
      >
        <slot name="way-in" />
      </div>
    </div>
    <!-- The Brand (tickets 540, 543): the strip's middle slot; the editor's opens the Homepage, the Homepage's is the page itself. -->
    <div ref="centerEl" class="canvas-strip__center" @keydown="centerRoving.onKeydown" @focusin="centerRoving.onFocusin">
      <component
        :is="brandLinks ? 'a' : 'span'"
        class="canvas-strip__brand"
        :href="brandLinks ? homepageHref : undefined"
        :aria-current="onHomepage ? 'page' : undefined"
        data-testid="canvas-brand"
      >
        <AppLogo class="canvas-strip__mark" :size="22" />
        <!-- On the Homepage the slogan is the brand (ticket 0822). -->
        <RollingSlogan v-if="onHomepage" class="canvas-strip__slogan" />
        <span v-else class="canvas-strip__wordmark">{{ t.app.title }}</span>
      </component>
      <!-- The Homepage's demo says it is one (ticket 0841), where the editor has Buy me a coffee. -->
      <span v-if="demo" class="canvas-strip__demo" data-testid="strip-demo">{{ t.homepage.inside.demoTag }}</span>
      <!-- Buy me a coffee (ticket 560): after the wordmark; only where the strip has room (1024px and up), under it the Menu row is the way in. -->
      <span v-if="COFFEE_URL && !demo" class="canvas-strip__coffee">
        <IconButton variant="plain" :icon-size="18" :action="actions.coffee" :href="COFFEE_URL" data-testid="strip-coffee" />
      </span>
    </div>
    <div ref="controlsEl" class="canvas-strip__controls" data-testid="canvas-strip-controls" @keydown="controlsRoving.onKeydown" @focusin="controlsRoving.onFocusin">
      <!-- Everything before Export, in a row that scrolls sideways where the strip is too narrow (ticket 0843). -->
      <div ref="scrollerEl" class="canvas-strip__scroller" :data-cut="cut" data-testid="canvas-strip-scroller">
        <!-- Expand (ticket 0830): words only, the icon set has none for it; it keeps the width of the wider word. -->
        <AppButton v-if="expand" class="canvas-strip__expand" size="sm" data-testid="strip-expand" @click="emit('toggle-expand')">
          <span class="canvas-strip__expand-word" :data-other="expand === 'expand' ? t.homepage.inside.collapse : t.homepage.inside.expand">{{
            expand === 'expand' ? t.homepage.inside.expand : t.homepage.inside.collapse
          }}</span>
        </AppButton>
        <div v-if="project" class="canvas-strip__tools">
          <template v-if="!demo">
            <IconButton variant="plain" :icon-size="18" :action="actions.rotateCanvas" :deps="deps" data-testid="strip-rotate-canvas" @click="emit('rotate-canvas')" />
            <IconButton variant="plain" :icon-size="18" :action="actions.rulers" :deps="deps" :selected="rulersLit" data-testid="strip-rulers" @click="emit('toggle-rulers')" />
          </template>
          <template v-if="referenceImage">
            <IconButton
              variant="plain"
              :icon-size="18"
              :action="actions.referenceImage"
              :selected="referenceImage === 'none' ? undefined : referenceImage === 'shown'"
              :shortcut="referenceImage === 'none' ? '' : undefined"
              :tooltip="referenceTooltip"
              data-testid="strip-reference-image"
              @click="onReferenceImage"
            />
            <span ref="referencePickerEl" hidden>
              <FileButton :label="actions.referenceImage.name(t)" :accept="referenceAccept" tabindex="-1" data-testid="strip-reference-image-input" @change="onReferenceFile" />
            </span>
          </template>
          <IconButton variant="plain" :icon-size="18" :action="actions.undo" :deps="deps" data-testid="strip-undo" @click="emit('undo')" />
          <IconButton variant="plain" :icon-size="18" :action="actions.redo" :deps="deps" data-testid="strip-redo" @click="emit('redo')" />
        </div>
        <div v-if="zoomPercent !== undefined && !demo" class="canvas-strip__zoom" :data-zoom-percent="zoomPercent" data-testid="canvas-strip-zoom">
          <IconButton variant="plain" :icon-size="18" :action="actions.zoomOut" :disabled="zoomPercent <= min" :disabled-body="t.tooltips.zoomOutLimit" data-testid="zoom-out" @click="emit('zoom-out')" />
          <IconButton variant="plain" :icon-size="18" :action="actions.zoomIn" :disabled="zoomPercent >= max" :disabled-body="t.tooltips.zoomInLimit" data-testid="zoom-in" @click="emit('zoom-in')" />
          <IconButton variant="plain" :icon-size="18" :action="actions.zoomFit" data-testid="zoom-reset" @click="emit('reset')" />
        </div>
      </div>
      <!-- Export (tickets 0652, 0843): the strip's last button, in its right corner, never scrolled away; lit while the
           Export panel is open. -->
      <IconButton
        v-if="project && !demo"
        variant="plain"
        :icon-size="18"
        :action="actions.export"
        :selected="openPanel === 'export'"
        data-testid="strip-export"
        @click="emit('select-panel', 'export')"
      />
    </div>
  </header>
</template>

<style scoped>
/* Three slots (ticket 543): panels left, the Brand centred, the tools and zoom right. */
.canvas-strip {
  position: relative;
  display: grid;
  flex: none;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-8);
  box-sizing: border-box;
  /* As tall as its tallest item plus 1px above and below (ticket 544); --strip-height is the same rule for the
   * Homepage, which has the same strip. The top corners follow the canvas box's curve. */
  min-height: var(--strip-height);
  padding: var(--bar-pad) var(--space-10) var(--bar-pad) var(--space-16);
  color: var(--ink);
  border: 1px solid color-mix(in srgb, var(--box-muted) 22%, transparent);
  border-top: 0;
  border-radius: var(--canvas-box-radius) var(--canvas-box-radius) 0 0;
}

/* The strip's widths are its shell's (ticket 0797): the screen for the editor, the Homepage's box for its strip, the
 * demo's own box in What's inside. Menu, Project and Frame all fit in a 320px window in the longest language (473). */
@container shell (max-width: 340px) {
  .canvas-strip {
    gap: var(--space-4);
    padding-left: var(--space-8);
  }
}

.canvas-strip__panels {
  display: flex;
  align-items: center;
  justify-self: start;
  gap: var(--space-8);
  min-width: 0;
  max-width: 100%;
}

.canvas-strip__panel-buttons {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

/* Where the left slot is short of room, the Project button gives way first: its name is cut sooner (ticket 0858). */
.canvas-strip__panel-buttons > :deep(.app-tooltip:has(> .canvas-strip__project)),
.canvas-strip__panel-buttons :deep(.canvas-strip__project) {
  min-width: 0;
}

/* The Homepage's way into the editor (ticket 0822; Homepage card): `sm` buttons 8px apart, beside Menu. */
.canvas-strip__way-in {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  transition: opacity var(--duration-base) var(--ease-standard);
}

/* Away on the Welcome section (ticket 0830): not shown, not pressed and not read, but its room kept, so the slogan
 * never moves; it fades back in as the page turns to the second section. */
.canvas-strip__way-in--away {
  visibility: hidden;
  opacity: 0;
  transition:
    opacity var(--duration-base) var(--ease-standard),
    visibility 0s linear var(--duration-base);
}

/* Under 1000px Projects library's name hides, its icon and count staying; a screen reader still hears it. */
@container shell (max-width: 999px) {
  .canvas-strip__way-in :deep(.canvas-strip__way-in-name) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}

/* Under 1024px the words go and the icons stay; the label stays in the page for a screen reader. */
@container shell (max-width: 1023px) {
  .canvas-strip__label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}

/* The open Project's name (ticket 0858): one line, cut with an ellipsis, so a long one never crowds the Brand. */
.canvas-strip__project-name {
  min-width: 0;
  max-width: var(--strip-project-name-max);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@container shell (max-width: 1023px) {
  .canvas-strip__coffee {
    display: none;
  }
}

/* The right slot holds the tools, the zoom and Export as one cluster. On a phone, too narrow for it, everything before
 * Export scrolls sideways and Export stays whole at the end (ticket 0843). */
.canvas-strip__controls {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
}

.canvas-strip__controls > .icon-btn-wrap {
  flex: none;
}

/* The scrolling row fades its edge where a control is cut, so the row shows it goes on; a swipe scrolls it. */
.canvas-strip__scroller {
  --fade-start: 0px;
  --fade-end: 0px;

  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.canvas-strip__scroller::-webkit-scrollbar {
  display: none;
}

.canvas-strip__scroller:not([data-cut='none']) {
  mask-image: linear-gradient(to right, transparent, var(--ink) var(--fade-start), var(--ink) calc(100% - var(--fade-end)), transparent);
}

.canvas-strip__scroller:is([data-cut='start'], [data-cut='both']) {
  --fade-start: var(--strip-fade);
}

.canvas-strip__scroller:is([data-cut='end'], [data-cut='both']) {
  --fade-end: var(--strip-fade);
}

/* Expand: `--control-height-small`, 28px, 8px before the tools. The word not read lies hidden in the same cell. */
.canvas-strip .canvas-strip__expand {
  flex: none;
  height: var(--control-height-small);
  margin-right: var(--space-6);
}

.canvas-strip__expand-word {
  display: inline-grid;
}

.canvas-strip__expand-word::after {
  content: attr(data-other);
  grid-area: 1 / 1;
  height: 0;
  visibility: hidden;
}

.canvas-strip__tools,
.canvas-strip__zoom {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}

.canvas-strip__center {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.canvas-strip__brand {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  color: var(--ink);
  text-decoration: none;
}

.canvas-strip__mark {
  color: var(--accent);
}

.canvas-strip__wordmark {
  display: none;
  font: var(--type-brand);
  letter-spacing: var(--tracking-brand);
}

@container shell (min-width: 1024px) {
  .canvas-strip__wordmark {
    display: inline;
  }
}

/* The demo's tag: `meta-small` in `accent-strong` on `accent` at 12%, `radius-full`, padding 2 8, never cut. */
.canvas-strip__demo {
  flex: none;
  padding: var(--space-2) var(--space-8);
  font: var(--type-meta-small);
  color: var(--accent-strong);
  white-space: nowrap;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: var(--radius-full);
}

a.canvas-strip__brand:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
  border-radius: var(--radius-xs);
}

/* The editor's phone strip has no Brand and gives the room to the controls; the Homepage's keeps its slogan. */
@container shell (max-width: 743px) {
  .canvas-strip:not(.canvas-strip--homepage) {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .canvas-strip:not(.canvas-strip--homepage) .canvas-strip__center {
    display: none;
  }
}

/* The Homepage's left slot is as wide as Menu and its way in need: the slogan stays centred while there is room and moves
 * right where there is not, the zoom scrolling (ticket 0822). */
.canvas-strip--homepage {
  grid-template-columns: minmax(max-content, 1fr) auto minmax(0, 1fr);
}

/* Under 744px the way in has no room beside Menu and the slogan: it takes a row of its own under them, centred. */
@container shell (max-width: 743px) {
  .canvas-strip--homepage {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    padding-bottom: var(--space-8);
  }

  .canvas-strip--homepage .canvas-strip__panels {
    display: contents;
  }

  .canvas-strip--homepage .canvas-strip__panel-buttons {
    grid-area: 1 / 1;
    justify-self: start;
  }

  .canvas-strip--homepage .canvas-strip__center {
    grid-area: 1 / 2;
  }

  .canvas-strip--homepage .canvas-strip__controls {
    grid-area: 1 / 3;
  }

  .canvas-strip--homepage .canvas-strip__way-in {
    grid-area: 2 / 1 / 3 / -1;
    justify-self: center;
  }
}

/* A phone's Homepage strip has no zoom (Homepage card): the slogan takes its room. The way in is the phone bar's; what
 * the slot holds, Projects library's icon and count, stands on the right, 36px tall (ticket 0827). The slogan stays
 * centred while there is room and moves over where the narrowest phones have none. */
@container shell (max-width: 480px) {
  .canvas-strip--homepage {
    grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
    padding-bottom: var(--bar-pad);
  }

  .canvas-strip--homepage .canvas-strip__zoom {
    display: none;
  }

  .canvas-strip--homepage .canvas-strip__way-in {
    grid-area: 1 / 3;
    justify-self: end;
  }

  .canvas-strip--homepage .canvas-strip__way-in :deep(.app-button) {
    height: var(--phone-library);
    padding: 0 var(--space-10);
  }
}

/* A finger needs a bigger target than the pointer's 30px (responsive.md "Input, not width"). */
@media (pointer: coarse) {
  .canvas-strip__controls :deep(.icon-btn--plain) {
    width: var(--touch-target);
    height: var(--touch-target);
  }
}
</style>
