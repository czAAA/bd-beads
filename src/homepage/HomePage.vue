<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import ConfirmModal from '../components/ui/ConfirmModal.vue'
import ProjectsLibrary from '../components/project/ProjectsLibrary.vue'
import { controlAction } from '../composables/shell/controlRegistry'
import type { ProjectLibrary } from '../composables/project/useProjectLibrary'
import type { LibraryEntry } from '../composables/project/useSavedProjectConfirms'
import type { Project } from '../domain/project'
import type { SealedProject } from '../domain/sealedProject'
import CanvasStrip from '../components/canvas/CanvasStrip.vue'
import MenuPanel from '../components/shell/MenuPanel.vue'
import PanelHost from '../components/shell/PanelHost.vue'
import { useElementSize } from '../composables/ui/useElementSize'
import { useMediaQuery } from '../composables/ui/useMediaQuery'
import { useOverlayLayer } from '../composables/ui/useOverlayLayer'
import AppLogo from '../components/ui/AppLogo.vue'
import { positionMarkBackground } from '../rendering/positionMarks'
import { useCanvasBackground } from '../theme/useCanvasBackground'
import CoffeeTile from './CoffeeTile.vue'
import FeatureCarousel from './FeatureCarousel.vue'
import FreeRoll, { type RollPlace } from './FreeRoll.vue'
import PlanTiles from './PlanTiles.vue'
import RollingSlogan from './RollingSlogan.vue'
import SectionBar from './SectionBar.vue'
import { SECTIONS, sectionAt } from './sections'
import { useFreeRoll } from './useFreeRoll'
import { provideI18n } from '../i18n/useI18n'
import { HOMEPAGE_MAX_ZOOM_PERCENT, HOMEPAGE_MIN_ZOOM_PERCENT, useHomepageZoom } from './homepageZoom'
import { fillBlanks } from '../domain/fillBlanks'
import { findBead } from '../domain/beads'
import { beadCell } from '../domain/weave'
import FeedbackSheet from '../components/shell/FeedbackSheet.vue'
import ToastRegion from '../components/ui/ToastRegion.vue'
import { useDialogs } from '../composables/shell/useDialogs'
import { useFeedbackFlow } from '../composables/shell/useFeedbackFlow'
import { useToasts } from '../composables/ui/useToasts'
import type { FeedbackService } from '../services/feedback'

// The Homepage (ticket 77; Homepage card): one canvas box like the editor's (ticket 540, ADR 0073) mid-page: the Canvas
// strip, the hero, one section at a time, the Progress bar. Scrolling turns the box to the next section (ticket 0739);
// the box never moves. It only reports which way in was chosen: the entry decides where that goes.
const props = defineProps<{
  /** How many Projects this device has saved, read without decoding any; none means a new visitor. */
  projectCount: number
  /** Sending a Report: the Menu's Send feedback works here too (spec 0698), so a beader can say the app won't start. */
  feedback: FeedbackService
  /** The library, opened only once its Saved Projects are shown in the Menu (ticket 0716). */
  openLibrary?: () => HomepageLibrary
}>()
const emit = defineEmits<{
  makeFirstProject: []
  openEditor: []
  /** The editor with no Project open and the Menu on Saved Projects (ticket 0716). */
  openSavedProjects: []
  /** The editor on the Project picked in the Menu's Saved Projects. */
  openProject: [id: string]
  exportAll: [projects: Project[], sealed: SealedProject[]]
}>()

/** What the Homepage's Saved Projects needs of the library (ticket 0716). */
type HomepageLibrary = Pick<ProjectLibrary, 'projects' | 'sealed' | 'removeProject' | 'addProjects' | 'entryOf'>

const { t, locale } = provideI18n()
watchEffect(() => {
  document.title = `${t.value.homepage.pageTitle} · ${t.value.app.title}`
})

const menuOpen = ref(false)
// The Homepage has no app shell: its one dialog, the Feedback sheet, has a registry and toasts of its own.
const dialogs = useDialogs()
const { toasts, show: showToast, dismiss: dismissToast } = useToasts()
const feedback = useFeedbackFlow({ feedback: props.feedback, locale: () => locale.value, messages: () => t.value, showToast, dialogs })
const zoom = useHomepageZoom()
/** The content's own width once zoomed: the width its layout is made for (the CSS asks the container the same). */
/** The width from which the carousel is a tablist, as in the CSS (1024px). */
const WIDE_FROM = 1024
const bodyEl = ref<HTMLElement>()
const bodySize = useElementSize(bodyEl)
const pageWidth = computed(() => (bodySize.width.value || window.innerWidth) / (zoom.percent.value / 100))
const canvasBackground = useCanvasBackground()
/** The Delica 11/0's real cell, the one an editor Project in that Bead draws (ticket 0724). */
const DELICA_CELL = beadCell(findBead('miyuki/delica/11-0'))
// The page's background is the editor Canvas's empty positions of a Miyuki Delica 11/0 Project worked in peyote (each
// row shifted half a bead), in the Bead's real cell, outlined in the theme's Position mark color, sized by the zoom.
const boxStyle = computed(() => {
  const color = canvasBackground.background.value?.color
  const zoomScale = zoom.percent.value / 100
  const pixelRatio = window.devicePixelRatio || 1
  const marks = positionMarkBackground({
    technique: 'peyote',
    cell: DELICA_CELL,
    deviceScale: zoomScale * pixelRatio,
    pixelRatio,
    color: canvasBackground.projectTheme.value.positionMark,
  })
  return {
    ...(color ? { '--canvas-bg': color } : undefined),
    ...(marks ? { '--canvas-marks': `url(${marks.url})`, '--canvas-tile': `${marks.width}px ${marks.height}px` } : undefined),
  }
})

// The sections (ticket 0739): the page is a viewport of scroll per section, snapping, and the section shown is the
// nearest one; the box stays put on a sticky stage while it scrolls.
const pageEl = ref<HTMLElement>()
const stageEl = ref<HTMLElement>()
const section = ref(0)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const sectionNames = computed(() => [t.value.homepage.whatsInside, t.value.homepage.coffee.title, t.value.homepage.plans.heading])
const PLANS = SECTIONS.indexOf('plans')

function onPageScroll() {
  const page = pageEl.value!
  const shown = sectionAt(page.scrollTop, page.clientHeight)
  if (shown === section.value) return
  section.value = shown
  if (shown !== PLANS) putRollAway()
}

/** Back and Next: the page scrolls a section's worth, and the scroll turns the box. */
function goTo(index: number) {
  const page = pageEl.value
  page?.scrollTo?.({ top: index * page.clientHeight, behavior: reducedMotion.value ? 'auto' : 'smooth' })
}

/** Where a section is drawn: the one shown, or the side it slid out to. */
function sectionState(index: number) {
  return index === section.value ? 'shown' : index < section.value ? 'before' : 'after'
}

// Keys scroll the page itself (Page Down, Space, the arrows), so it holds the focus until something in it takes it.
onMounted(() => pageEl.value?.focus({ preventScroll: true }))

// The free list (ticket 0739): on the third scroll of its window it unrolls below the No account tile; the page grows
// by the roll's length, stops snapping and scrolls on to show it. A click outside the roll or on its curl, Escape, or
// scrolling back to the coffee rolls it up.
const freeRoll = useFreeRoll()
const plans = ref<InstanceType<typeof PlanTiles>>()
const rollEl = ref<InstanceType<typeof FreeRoll>>()
const rollPlace = ref<RollPlace & { extra: number }>()
/** The room the page keeps below the roll's curl. */
const ROLL_ROOM = 48
let rollingUp = false

watch(freeRoll.unrolled, (unrolled) => {
  const freeWindow = plans.value?.freeWindow
  const stage = stageEl.value
  if (!unrolled || !freeWindow || !stage) return
  const at = freeWindow.getBoundingClientRect()
  const list = freeWindow.firstElementChild!.getBoundingClientRect()
  const from = stage.getBoundingClientRect()
  const offset = at.top - list.top
  const rolledHeight = at.height
  const height = Math.max(rolledHeight, list.height - offset)
  const y = at.top - from.top
  rollPlace.value = { x: at.left - from.left, y, width: at.width, rolledHeight, height, offset, extra: Math.max(0, Math.round(y + height + ROLL_ROOM - from.height)) }
})

/** Rolls the list back into the tile and the page back up to the plans. */
async function rollUp() {
  if (!rollPlace.value || rollingUp) return
  rollingUp = true
  const page = pageEl.value!
  const plansTop = PLANS * page.clientHeight
  if (page.scrollTop > plansTop) page.scrollTo?.({ top: plansTop, behavior: reducedMotion.value ? 'auto' : 'smooth' })
  await rollEl.value?.rollUp()
  rollingUp = false
  rollPlace.value = undefined
  freeRoll.rollUp()
}

/** Leaving the plans puts the roll away at once and the window back to its top. */
function putRollAway() {
  rollPlace.value = undefined
  freeRoll.rollUp()
  const freeWindow = plans.value?.freeWindow
  if (freeWindow?.scrollTop) {
    freeRoll.ignoreNextScroll()
    freeWindow.scrollTop = 0
  }
}

/** A click anywhere outside the roll rolls it up; a swipe is no click, so it scrolls the page on. */
function onPageClick(event: MouseEvent) {
  if (!rollPlace.value || !(event.target instanceof Node)) return
  if (!rollEl.value?.root?.contains(event.target)) void rollUp()
}

// Escape rolls it up too; a press is the click's to judge, so the registry leaves every press alone.
useOverlayLayer({ isOpen: () => rollPlace.value !== undefined, root: () => rollEl.value?.root, close: () => void rollUp(), keepsPress: () => true })

// The Menu's Saved Projects (ticket 0716): the editor's list, its Remove asking first, a pick opening the editor on it.
const library = shallowRef<HomepageLibrary>()
const count = computed(() => (library.value ? library.value.projects.value.length + library.value.sealed.value.length : props.projectCount))
const pendingRemove = ref<LibraryEntry>()

function showSavedProjects() {
  library.value ??= props.openLibrary?.()
}

function confirmRemove() {
  const entry = pendingRemove.value
  pendingRemove.value = undefined
  if (entry) library.value?.removeProject(entry.id)
}

const isNew = computed(() => count.value === 0)
const savedProjects = controlAction('saved-projects')
/** "Saved Projects · 3": the Menu row's name with the count (ticket 0716). */
const savedProjectsLabel = computed(() => `${savedProjects.name(t.value)} · ${count.value}`)
</script>

<template>
  <div
    ref="pageEl"
    class="homepage-page"
    :class="{ 'homepage-page--unrolled': rollPlace }"
    tabindex="-1"
    data-testid="homepage-page"
    @scroll.passive="onPageScroll"
    @click="onPageClick"
  >
    <div class="homepage-page__track">
      <div ref="stageEl" class="homepage-page__stage">
        <!-- The two faint X1 marks beside the box, drifting a little as the page scrolls. -->
        <span class="homepage-page__marks">
          <AppLogo class="homepage-page__mark homepage-page__mark--large" :size="420" data-testid="homepage-mark" />
          <AppLogo class="homepage-page__mark homepage-page__mark--small" :size="120" data-testid="homepage-mark" />
        </span>

        <div class="homepage" :style="boxStyle" data-testid="homepage">
          <CanvasStrip
            page="homepage"
            :open-panel="menuOpen ? 'menu' : null"
            :zoom-percent="zoom.percent.value"
            :zoom-min-percent="HOMEPAGE_MIN_ZOOM_PERCENT"
            :zoom-max-percent="HOMEPAGE_MAX_ZOOM_PERCENT"
            @select-panel="menuOpen = !menuOpen"
            @zoom-in="zoom.zoomIn"
            @zoom-out="zoom.zoomOut"
            @reset="zoom.reset"
          />
          <PanelHost v-if="menuOpen" open="menu" :only="['menu']" :sub-title="t.projects.heading" :sub-meta="String(count)" @close="menuOpen = false">
            <MenuPanel page="homepage" :project-count="count" @saved-projects="showSavedProjects" @feedback="feedback.onOpenFeedback" />
            <template #sub="{ depth }">
              <ProjectsLibrary
                v-if="depth === 1 && library"
                :projects="library.projects.value"
                :sealed="library.sealed.value"
                @select="emit('openProject', $event)"
                @remove="pendingRemove = library.entryOf($event)"
                @import="library.addProjects"
                @export-all="emit('exportAll', library.projects.value, library.sealed.value)"
              />
            </template>
          </PanelHost>
          <ConfirmModal
            v-if="pendingRemove"
            data-testid="remove-project-modal"
            :title="t.removeProject.title"
            :message="fillBlanks(t.removeProject.message, { name: pendingRemove.name })"
            :confirm-label="t.removeProject.confirmButton"
            :cancel-label="t.removeProject.cancelButton"
            @confirm="confirmRemove"
            @cancel="pendingRemove = undefined"
          />
          <FeedbackSheet
            v-if="dialogs.open.value === 'feedback' && feedback.feedbackRequest.value"
            :request="feedback.feedbackRequest.value"
            :verify="feedback.verifyFeedback"
            :send="feedback.sendReport"
            :copy="feedback.copyReport"
            @cancel="feedback.onCloseFeedback"
          />
          <ToastRegion :toasts="toasts" @dismiss="dismissToast" />

          <div ref="bodyEl" class="homepage__body" data-testid="homepage-body">
            <main class="homepage__page" :style="{ zoom: zoom.percent.value / 100 }">
              <section class="homepage__hero">
                <RollingSlogan />
                <p class="homepage__tagline">
                  <span class="homepage__tagline-text">{{ t.homepage.tagline }}</span>
                  <span class="homepage__aside homepage__aside--us" aria-hidden="true" data-testid="homepage-note-on-us">
                    <svg class="homepage__arrow" width="18" height="8" viewBox="0 0 18 8"><path d="M17 4 H2 M6 1 L2 4 L6 7" /></svg>
                    <span class="homepage__note homepage__note--accent">{{ t.homepage.notes.onUs }}</span>
                  </span>
                </p>
                <div class="homepage__actions">
                  <span v-if="isNew" class="homepage__buttons">
                    <AppButton variant="primary" size="lg" data-testid="homepage-make-first" @click="emit('makeFirstProject')">
                      {{ t.homepage.makeFirstProject }}
                    </AppButton>
                    <AppButton size="lg" data-testid="homepage-open-editor" @click="emit('openEditor')">
                      {{ t.homepage.openEditor }}
                    </AppButton>
                  </span>
                  <span v-else class="homepage__buttons">
                    <AppButton variant="primary" size="lg" data-testid="homepage-open-editor" @click="emit('openEditor')">
                      {{ t.homepage.openEditor }}
                    </AppButton>
                    <!-- Saved Projects (ticket 0716): the editor with no Project open and the Menu on its list. -->
                    <AppButton size="lg" icon="library" data-testid="homepage-saved-projects" @click="emit('openSavedProjects')">
                      {{ savedProjectsLabel }}
                    </AppButton>
                  </span>
                </div>
              </section>

              <div class="homepage__sections">
                <section
                  class="homepage__section"
                  :class="`homepage__section--${sectionState(0)}`"
                  aria-labelledby="homepage-inside"
                  data-testid="homepage-section-inside"
                >
                  <h2 id="homepage-inside" class="homepage__heading">{{ t.homepage.whatsInside }}</h2>
                  <FeatureCarousel class="homepage__fill" :wide="pageWidth >= WIDE_FROM" />
                </section>
                <section
                  class="homepage__section homepage__section--centred"
                  :class="`homepage__section--${sectionState(1)}`"
                  :aria-label="t.homepage.coffee.title"
                  data-testid="homepage-section-coffee"
                >
                  <CoffeeTile />
                </section>
                <div class="homepage__section" :class="`homepage__section--${sectionState(2)}`" data-testid="homepage-section-plans">
                  <PlanTiles ref="plans" :lit="freeRoll.lit.value" :unrolled="freeRoll.unrolled.value" @open-editor="emit('openEditor')" @free-scroll="freeRoll.onWindowScroll" />
                </div>
              </div>
            </main>
          </div>
          <SectionBar :section="section" :names="sectionNames" @go="goTo" />
        </div>

        <FreeRoll v-if="rollPlace" ref="rollEl" :place="rollPlace" :items="t.homepage.plans.tiles[0]!.items" :zoom="zoom.percent.value / 100" @roll-up="rollUp" />
      </div>
      <span v-for="(id, index) in SECTIONS" :key="id" class="homepage-page__snap" :style="{ top: `calc(${index} * 100% / var(--sections))` }" aria-hidden="true" />
    </div>
    <div v-if="rollPlace" :style="{ height: `${rollPlace.extra}px` }" aria-hidden="true" data-testid="homepage-roll-room" />
  </div>
</template>

<style scoped>
/* The page (ticket 0739): the theme's own ground, a viewport of scroll per section, snapping to each; the stage holding
 * the box stays on screen while it scrolls. While the free list is unrolled the page grows by its length and stops
 * snapping. */
.homepage-page {
  position: fixed;
  inset: 0;
  overflow: hidden auto;
  color: var(--ink);
  background: var(--page-ground);
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  outline: none;
}

.homepage-page::-webkit-scrollbar {
  display: none;
}

.homepage-page--unrolled {
  scroll-snap-type: none;
}

.homepage-page__track {
  position: relative;
  height: calc(var(--sections) * 100%);
  --sections: 3;
}

.homepage-page__snap {
  position: absolute;
  left: 0;
  width: 1px;
  height: calc(100% / var(--sections));
  scroll-snap-align: start;
  pointer-events: none;
}

.homepage-page__stage {
  position: sticky;
  top: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100% / var(--sections));
  padding: max(var(--space-8), env(safe-area-inset-top)) max(var(--space-8), env(safe-area-inset-right))
    max(var(--space-8), env(safe-area-inset-bottom)) max(var(--space-8), env(safe-area-inset-left));
}

@media (min-width: 744px) {
  .homepage-page__stage {
    padding: var(--space-24);
  }
}

/* Two faint X1 marks outside the box (the drawn layer is gone): `accent`, behind it, drifting with the page's scroll
 * where the browser can tie an animation to it; cut at the screen's edge. */
.homepage-page__marks {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.homepage-page__mark {
  position: absolute;
  z-index: 0;
  color: var(--accent);
  pointer-events: none;
  will-change: transform;
}

.homepage-page__mark--large {
  top: 14%;
  left: calc(50% - var(--homepage-box-width) / 2 - var(--homepage-mark-large) / 2 - var(--space-24));
  stroke-width: 1.4;
  opacity: 0.07;
}

.homepage-page__mark--small {
  right: calc(50% - var(--homepage-box-width) / 2 - var(--homepage-mark-small) - var(--space-32));
  bottom: 10%;
  stroke-width: 2.6;
  opacity: 0.16;
}

@supports (animation-timeline: scroll()) {
  .homepage-page__mark--large {
    animation: homepage-drift-large linear both;
    animation-timeline: scroll(nearest block);
  }

  .homepage-page__mark--small {
    animation: homepage-drift-small linear both;
    animation-timeline: scroll(nearest block);
  }
}

@keyframes homepage-drift-large {
  from {
    transform: translateY(5rem);
  }

  to {
    transform: translateY(-8.75rem);
  }
}

@keyframes homepage-drift-small {
  from {
    transform: translateY(-3.75rem);
  }

  to {
    transform: translateY(6.875rem);
  }
}

/* The canvas box (ticket 540, ADR 0073): the Canvas strip on top, the hero and one section between, the Progress bar
 * below, as the editor's box is laid out. */
.homepage {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--homepage-box-width);
  height: 100%;
  max-height: var(--homepage-box-height);
  overflow: hidden;
  color: var(--ink);
  background: var(--box);
  border-radius: var(--canvas-box-radius);
}

/* The drawing area: today's Canvas background with its peyote position marks. */
.homepage__body {
  display: flex;
  flex: 1 1 0;
  min-height: 0;
  background-color: var(--canvas-bg, var(--canvas));
  background-image: var(--canvas-marks, none);
  background-size: var(--canvas-tile);
}

/* The zoom scales the content; the layout is made for the width it ends up with, so the text reflows and the page never
 * scrolls sideways. */
.homepage__page {
  container: homepage / inline-size;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/* The hero stays put while the sections change under it. */
.homepage__hero {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  padding: var(--space-20) var(--space-16) var(--space-12);
  text-align: center;
}

@container homepage (min-width: 744px) {
  .homepage__hero {
    padding: var(--space-24) var(--space-24) var(--space-16);
  }
}

.homepage__tagline {
  position: relative;
  margin: var(--space-14) 0 0;
  font: var(--type-meta);
  color: var(--muted);
}

.homepage__tagline-text {
  display: inline-block;
}

/* The hand-written notes (Homepage card): decorative, never over text, muted unless they say otherwise. */
.homepage__note {
  position: absolute;
  font: var(--type-note);
  color: var(--muted);
  white-space: nowrap;
  pointer-events: none;
}

.homepage__note--accent {
  color: var(--accent-strong);
}

.homepage__aside {
  pointer-events: none;
}

.homepage__arrow {
  overflow: visible;
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* "on us": above the line's right end on a phone, beside it from 744. */
.homepage__aside--us {
  position: absolute;
  top: 0;
  right: 0;
  left: auto;
}

.homepage__aside--us .homepage__note {
  top: -1.125rem;
  right: -0.25rem;
  transform: rotate(-6deg);
}

.homepage__aside--us .homepage__arrow {
  display: none;
}

@container homepage (min-width: 744px) {
  .homepage__aside--us {
    top: 0.0625rem;
    left: calc(100% + 0.25rem);
    right: auto;
  }

  .homepage__aside--us .homepage__note {
    top: 0;
    right: auto;
    left: 1.375rem;
  }

  .homepage__aside--us .homepage__arrow {
    display: block;
    margin-top: 0.4375rem;
  }
}

.homepage__actions {
  display: flex;
  justify-content: center;
  margin-top: var(--space-16);
}

.homepage__buttons {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-12);
}

/* One section at a time in the room left (ticket 0739): the one shown, the ones before slid up and faded, the ones after
 * waiting below; a section taller than the room scrolls inside itself. */
.homepage__sections {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
}

.homepage__section {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-width: 67.5rem;
  margin: 0 auto;
  padding: var(--space-4) var(--space-8) var(--space-12);
  overflow-y: auto;
  overscroll-behavior-x: contain;
  transition:
    opacity var(--section-turn) var(--ease-standard),
    transform var(--section-turn) var(--ease-standard),
    visibility 0s linear var(--section-turn);
}

@container homepage (min-width: 744px) {
  .homepage__section {
    padding: var(--space-8) var(--space-24) var(--space-24);
  }
}

@container homepage (min-width: 1024px) {
  .homepage__section {
    padding-right: var(--space-32);
    padding-left: var(--space-32);
  }
}

.homepage__section--shown {
  transition-delay: 0s;
}

.homepage__section--before,
.homepage__section--after {
  visibility: hidden;
  opacity: 0;
}

.homepage__section--before {
  transform: translateY(calc(var(--section-shift) * -1)) scale(var(--section-scale));
}

.homepage__section--after {
  transform: translateY(var(--section-shift)) scale(var(--section-scale));
}

.homepage__section--centred {
  justify-content: center;
}

.homepage__heading {
  flex: none;
  margin: 0 0 var(--space-12);
  font: var(--type-serif-heading);
  letter-spacing: var(--tracking-serif-heading);
  color: var(--ink);
}

.homepage__fill {
  flex: 1 1 0;
  min-height: 0;
}

/* Reduced motion: the sections swap without sliding. */
@media (prefers-reduced-motion: reduce) {
  .homepage__section {
    transform: none !important;
    transition: none;
  }

  .homepage-page__mark {
    animation: none !important;
  }
}
</style>
