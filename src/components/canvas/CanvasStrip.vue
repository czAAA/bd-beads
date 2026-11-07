<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT } from '../../domain/grid'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import { COFFEE_URL } from '../../data/coffeeLink'
import { homepageUrl } from '../../homepage/homepageRoute'
import RollingSlogan from '../../homepage/RollingSlogan.vue'
import AppButton from '../ui/AppButton.vue'
import AppLogo from '../ui/AppLogo.vue'
import IconButton from '../ui/IconButton.vue'
import FileButton from '../ui/form/FileButton.vue'
import { imageInputAccept } from '../../domain/imageConversion'
import type { OpenPanel } from '../../composables/shell/openPanel'

// The canvas box's header strip on every App page (tickets 143, 540, 0756, ADRs 0046, 0073, 0085; CanvasStrip card): Menu ·
// Project · Frame on the left (Menu · Close on Convert image), the Brand in the middle, Rotate · Rulers · Undo · Redo, zoom
// and Export on the right (tickets 543, 0652); the Homepage's way in beside Menu, its slogan as the wordmark (0822).
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
}>()
const emit = defineEmits<{
  'select-panel': [sheet: 'menu' | 'project' | 'export']
  'toggle-frame': []
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
const deps = computed(() => controlDeps({ activeProject: () => props.project, canUndo: () => !!props.canUndo, canRedo: () => !!props.canRedo }))
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

function onPanelsKeydown(event: KeyboardEvent) {
  const button = event.target as HTMLElement
  if (event.key === 'ArrowDown' && button.getAttribute('aria-pressed') !== 'true') {
    event.preventDefault()
    event.stopPropagation()
    button.click()
    return
  }
  panelsRoving.onKeydown(event)
}
</script>

<template>
  <div class="canvas-strip no-page-pan" :class="{ 'canvas-strip--homepage': onHomepage }" data-testid="canvas-strip">
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
          :action="actions.project"
          :selected="openPanel === 'project' ? true : undefined"
          data-testid="strip-project"
          @click="emit('select-panel', 'project')"
        >
          <span class="canvas-strip__label">{{ actions.project.name(t) }}</span>
        </AppButton>
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
      <div v-if="$slots['way-in']" class="canvas-strip__way-in" data-testid="strip-way-in"><slot name="way-in" /></div>
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
      <!-- Buy me a coffee (ticket 560): after the wordmark; only where the strip has room (1024px and up), under it the Menu row is the way in. -->
      <span v-if="COFFEE_URL && !demo" class="canvas-strip__coffee">
        <IconButton variant="plain" :icon-size="18" :action="actions.coffee" :href="COFFEE_URL" data-testid="strip-coffee" />
      </span>
    </div>
    <div ref="controlsEl" class="canvas-strip__controls" data-testid="canvas-strip-controls" @keydown="controlsRoving.onKeydown" @focusin="controlsRoving.onFocusin">
      <div v-if="project" class="canvas-strip__tools">
        <template v-if="!demo">
          <IconButton variant="plain" :icon-size="18" :action="actions.rotateCanvas" :deps="deps" data-testid="strip-rotate-canvas" @click="emit('rotate-canvas')" />
          <IconButton variant="plain" :icon-size="18" :action="actions.rulers" :deps="deps" :selected="rulers" data-testid="strip-rulers" @click="emit('toggle-rulers')" />
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
      <!-- Export (ticket 0652): the strip's last button, in its right corner; lit while the Export panel is open. -->
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
  </div>
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
}

.canvas-strip__panel-buttons {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* The Homepage's way into the editor (ticket 0822; Homepage card): `sm` buttons 8px apart, beside Menu. */
.canvas-strip__way-in {
  display: flex;
  align-items: center;
  gap: var(--space-8);
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

@container shell (max-width: 1023px) {
  .canvas-strip__coffee {
    display: none;
  }
}

/* The right slot holds the tools and the zoom as one cluster; on a phone, too narrow for it, it scrolls sideways. */
.canvas-strip__controls {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.canvas-strip__controls::-webkit-scrollbar {
  display: none;
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

/* Under 744px the way in has no room beside Menu and the slogan: it takes a row of its own under them, centred (on a
 * phone until the phone's own bar carries it, ticket 0827). */
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

/* A phone's Homepage strip has no zoom (Homepage card): the slogan takes its room. */
@container shell (max-width: 480px) {
  .canvas-strip--homepage .canvas-strip__zoom {
    display: none;
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
