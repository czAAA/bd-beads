<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowReactive, shallowRef, watch, watchEffect } from 'vue'
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
import AppLogo from '../components/ui/AppLogo.vue'
import { positionMarkBackground } from '../rendering/positionMarks'
import { useCanvasBackground } from '../theme/useCanvasBackground'
import CoffeeTile from './CoffeeTile.vue'
import FeatureCarousel from './FeatureCarousel.vue'
import PlanTiles from './PlanTiles.vue'
import RollingSlogan from './RollingSlogan.vue'
import SectionBar from './SectionBar.vue'
import { sectionAt, type HomepageSection } from './sections'
import { useFreeGrowth } from './useFreeGrowth'
import { provideI18n } from '../i18n/useI18n'
import { HOMEPAGE_MAX_ZOOM_PERCENT, HOMEPAGE_MIN_ZOOM_PERCENT, useHomepageZoom } from './homepageZoom'
import { fillBlanks } from '../domain/fillBlanks'
import { findBead } from '../domain/beads'
import { beadCell, type Technique } from '../domain/weave'
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
/** What the page's background is woven in (ticket 0734: its every other column hangs half a bead lower). */
const BACKGROUND: { technique: Technique } = { technique: 'peyote' }
/** The Delica 11/0's real cell, the one an editor Project in that Bead draws (ticket 0724). */
const DELICA_CELL = beadCell(findBead('miyuki/delica/11-0'), BACKGROUND.technique)
// The page's background is the editor Canvas's empty positions of a Miyuki Delica 11/0 Project worked in peyote, in the
// Bead's real cell, outlined in the theme's Position mark color, sized by the zoom.
const boxStyle = computed(() => {
  const color = canvasBackground.background.value?.color
  const zoomScale = zoom.percent.value / 100
  const pixelRatio = window.devicePixelRatio || 1
  const marks = positionMarkBackground({
    technique: BACKGROUND.technique,
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

// The sections (tickets 0739, 0744): the page is a viewport of scroll per section, snapping, and the section shown is the
// nearest one; the box stays put on a sticky stage while it scrolls. This list is the one place they are named and
// ordered: the page draws them, their snap points and their turning from it, and the Progress bar its steps.
const sections = computed<HomepageSection[]>(() => [
  { id: 'inside', heading: t.value.homepage.whatsInside, title: 'above', shows: FeatureCarousel, with: () => ({ class: 'homepage__fill', wide: pageWidth.value >= WIDE_FROM }) },
  { id: 'coffee', heading: t.value.homepage.coffee.title, title: 'hidden', centred: true, shows: CoffeeTile },
  {
    id: 'plans',
    heading: t.value.homepage.plans.heading,
    title: 'inside',
    shows: PlanTiles,
    with: () => ({ style: plansStyle.value, freeHeight: freeGrowth.height.value, freeOpen: freeGrowth.open.value, onOpenEditor: () => emit('openEditor') }),
  },
])
const plansIndex = computed(() => sections.value.findIndex((entry) => entry.id === 'plans'))
const pageEl = ref<HTMLElement>()
const section = ref(0)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
/** The section a step's jump is on its way to: the box turns to it at once, not through each one the scroll passes. */
let jumpingTo: number | undefined

function onPageScroll() {
  const page = pageEl.value!
  if (plansIndex.value >= 0) freeGrowth.scrolledPast(page.scrollTop - plansIndex.value * page.clientHeight)
  if (freeGrowth.growing.value) snapOff.value = true
  const shown = sectionAt(page.scrollTop, page.clientHeight, sections.value.length)
  if (jumpingTo !== undefined && shown !== jumpingTo) return
  jumpingTo = undefined
  show(shown)
}

function show(index: number) {
  if (index === section.value) return
  section.value = index
  if (index !== plansIndex.value) snapOff.value = false
}

/** A jump's scroll has stopped, where it was going or wherever the beader took it: the box follows the page again. */
function onScrollEnd() {
  if (jumpingTo === undefined) return
  jumpingTo = undefined
  onPageScroll()
}

/** The beader takes the page over mid-jump (where a browser has no `scrollend`): the next scroll turns the box. */
function endJump() {
  jumpingTo = undefined
}

/** Back, Next and the steps: the page scrolls to the section and the box turns to it at once, however far it is. */
function goTo(index: number) {
  const page = pageEl.value
  if (!page || index === section.value) return
  if (!reducedMotion.value) jumpingTo = index
  page.scrollTo?.({ top: index * page.clientHeight, behavior: reducedMotion.value ? 'auto' : 'smooth' })
  show(index)
}

/** Where a section is drawn: the one shown, or the side it slid out to. */
function sectionState(index: number) {
  return index === section.value ? 'shown' : index < section.value ? 'before' : 'after'
}

// Keys scroll the page itself (Page Down, Space, the arrows), so it holds the focus until something in it takes it.
onMounted(() => pageEl.value?.focus({ preventScroll: true }))

// The free list (ticket 0742): scrolling past the plans grows No account's list, the plans scrolling up in their section
// as the page does, and the page reaches as far as the whole list needs. The page stops snapping once it grows, until
// it is back at the coffee.
const sectionEls = shallowReactive(new Map<string, HTMLElement>())
/** What each section shows, by its id: the plans' tiles are what the free list is measured in. */
const shownIn = shallowReactive(new Map<string, unknown>())
const plans = computed(() => shownIn.get('plans') as InstanceType<typeof PlanTiles> | undefined)
const plansSection = computed(() => sectionEls.get('plans'))
const snapOff = ref(false)
const freeGrowth = useFreeGrowth({
  section: plansSection,
  freeWindow: () => plans.value?.freeWindow,
  freeTile: () => plans.value?.freeTile,
  zoom: () => zoom.percent.value / 100,
})
const plansStyle = computed(() => (freeGrowth.offset.value ? { transform: `translateY(${-freeGrowth.offset.value}px)` } : undefined))
const remeasureFree = () => void nextTick(freeGrowth.remeasure)
onMounted(() => {
  remeasureFree()
  void document.fonts?.ready.then(remeasureFree)
})
watch([locale, zoom.percent, bodySize.width, bodySize.height, () => section.value === plansIndex.value], remeasureFree)

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
    :class="{ 'homepage-page--growing': snapOff }"
    tabindex="-1"
    data-testid="homepage-page"
    @scroll.passive="onPageScroll"
    @scrollend="onScrollEnd"
    @wheel.passive="endJump"
    @touchstart.passive="endJump"
    @keydown="endJump"
  >
    <div class="homepage-page__track" :style="{ '--free-room': `${freeGrowth.room.value}px`, '--sections': sections.length }">
      <div class="homepage-page__stage">
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
                  v-for="(entry, index) in sections"
                  :key="entry.id"
                  :ref="(el) => el ? sectionEls.set(entry.id, el as HTMLElement) : sectionEls.delete(entry.id)"
                  class="homepage__section"
                  :class="[`homepage__section--${sectionState(index)}`, `homepage__section--${entry.id}`, { 'homepage__section--centred': entry.centred }]"
                  :aria-labelledby="entry.title === 'above' ? `homepage-${entry.id}` : undefined"
                  :aria-label="entry.title === 'hidden' ? entry.heading : undefined"
                  :data-testid="`homepage-section-${entry.id}`"
                >
                  <h2 v-if="entry.title === 'above'" :id="`homepage-${entry.id}`" class="homepage__heading">{{ entry.heading }}</h2>
                  <component
                    :is="entry.shows"
                    v-bind="entry.with?.()"
                    :ref="(shown: unknown) => (shown ? shownIn.set(entry.id, shown) : shownIn.delete(entry.id))"
                  />
                </section>
              </div>
            </main>
          </div>
          <SectionBar :section="section" :sections="sections" @go="goTo" />
        </div>
      </div>
      <span
        v-for="(entry, index) in sections"
        :key="entry.id"
        class="homepage-page__snap"
        :class="{ 'homepage-page__snap--last': index === sections.length - 1 }"
        :style="{ top: `calc(${index} * (100% - var(--free-room)) / var(--sections))` }"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
/* The page (ticket 0739): the theme's own ground, a viewport of scroll per section, snapping to each; the stage holding
 * the box stays on screen while it scrolls. Past the plans the page reaches on as far as the free list grows (ticket
 * 0742), the stage still on screen, and stops snapping while it grows. */
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

.homepage-page--growing {
  scroll-snap-type: none;
}

.homepage-page__track {
  position: relative;
  height: calc(var(--sections) * 100% + var(--free-room));
}

.homepage-page__snap {
  position: absolute;
  left: 0;
  width: 1px;
  height: calc((100% - var(--free-room)) / var(--sections));
  scroll-snap-align: start;
  pointer-events: none;
}

/* The plans' snap area reaches as far as the free list grows: taller than the screen, so the page scrolls freely in it
 * from the first wheel turn on, before it stops snapping. */
.homepage-page__snap--last {
  height: calc((100% - var(--free-room)) / var(--sections) + var(--free-room));
}

.homepage-page__stage {
  position: sticky;
  top: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc((100% - var(--free-room)) / var(--sections));
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

/* The plans scroll with the page, never by themselves (ticket 0742). */
.homepage__section--plans {
  overflow: clip;
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
