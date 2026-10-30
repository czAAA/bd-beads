import { defineComponent, h, onMounted, ref, type Component } from 'vue'
import { describeFits, type FitCase } from '../testUtils/browserFit'
import ColorPopover from './tools/ColorPopover.vue'
import ToastRegion from './ui/ToastRegion.vue'
import AppMessage from './ui/AppMessage.vue'
import BeadColorList from './palette/BeadColorList.vue'
import ProjectsLibrary from './project/ProjectsLibrary.vue'
import StarterGallery from './project/StarterGallery.vue'
import StarterSetup from './project/StarterSetup.vue'
import ConvertImageWizard from './import/ConvertImageWizard.vue'
import PictureDropOverlay from './import/PictureDropOverlay.vue'
import EmptyCanvas from './canvas/EmptyCanvas.vue'
import CanvasHint from './canvas/CanvasHint.vue'
import MarginColorPopover from './canvas/MarginColorPopover.vue'
import ContextBar from './tools/ContextBar.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createProject } from '../domain/createProject'
import { paintAt } from '../testUtils/layers'
import { marginSheetHost } from '../testUtils/marginSheetHost'
import { armSelectionBar } from '../testUtils/pill'
import { flatColorsPicture, pictureSet } from '../testUtils/convertPicture'
import { createPalette, defaultPaletteIds } from '../domain/palette'
import { starterById } from '../domain/starters'
import type { ColorCatalog } from '../domain/colorCatalog'
import { withLayers } from '../testUtils/layerFields'

// The states of the app a person reaches by acting, not by loading: the colour popover, toasts and the save-failed
// notice, the notes, panels expanded, the Convert image wizard, the empty library (ticket 552).
const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const empty = createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
/** Six colours: more rows than the panel's summary shows, so that it can be expanded. */
const painted = createPalette(defaultPaletteIds()).colors.slice(0, 6).map((color) => color.hex).reduce((project, color, column) => paintAt(project, [{ row: 0, column }], color), empty)

/** A component with the elements the colour popover is placed against: the pill and its colour tile. */
const ColorPopoverHost = defineComponent({
  setup() {
    const tile = ref<HTMLElement>()
    const pill = ref<HTMLElement>()
    return () =>
      h('div', { style: { position: 'fixed', left: '8px', bottom: '8px' }, ref: pill }, [
        h('button', { ref: tile, type: 'button' }, 'Color'),
        h(ColorPopover, { tile: tile.value, pill: pill.value, position: 'bottom', colorHex: '#e63746', colorName: 'Red', selectedColorId: 'red' }),
      ])
  },
})

/** The app's drop look, a picture being dragged over it. */
const PictureDragged = defineComponent({
  setup() {
    onMounted(() => {
      const transfer = new DataTransfer()
      transfer.items.add(new File(['x'], 'fox.png', { type: 'image/png' }))
      window.dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }))
    })
    return () => h(PictureDropOverlay, { disabled: false })
  },
})

/** Toasts of each tone, with an action, as the stack shows them. */
const Toasts = defineComponent({
  setup: () => () =>
    h(ToastRegion, {
      toasts: [
        { id: 'import-error', text: 'That file is not a Project or a library of Projects.', tone: 'danger', stamp: 1 },
        { id: 'undo', text: 'The frame was removed.', tone: 'success', stamp: 2, action: { label: 'Undo', run: () => {} } },
      ],
    }),
})

/** The library-wide notice for a failed write to this device's storage (ticket 55, ADR 0012). */
const SaveFailedNotice = defineComponent({
  setup: () => () => h(AppMessage, { tone: 'danger', placement: 'notice' }, () => 'This device could not save your Project. Download it to keep it.'),
})

/** The Bead's Color catalog as its list reads it (a stand-in for `useBeadColors`). */
function beadColors(state: 'ready' | 'failed') {
  const finishes = ['metallic', 'matte', 'opaque'] as const
  const swatches = ['Blue', 'Gray', 'Green'].map((family, i) => ({ code: `DB${i + 1}`, family, finish: finishes[i]!, hex: '#123456', approximate: true, discontinued: i === 1, taken: false }))
  return { available: ref(true), state: ref(state), swatches: ref(swatches), bead: ref(BEAD_CATALOG[2]), catalog: ref(undefined), load: () => {}, add: () => 'added' as const }
}

/** A Delica catalog of a few codes, so Bead colors is offered and matched to. */
const catalog: ColorCatalog = {
  id: 'miyuki-delica',
  codes: [
    { code: 'DB723', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: 'DB726', family: ['Blue'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: 'DB721', family: ['Yellow'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
  ],
}

/** The wizard as the app opens it, with or without a picture set. */
function wizardProps(withPicture: boolean) {
  return {
    start: {
      draft: { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: '', makerName: '' },
      ...(withPicture ? { file: new File(['x'], 'sunflower-in-a-long-file-name.png', { type: 'image/png' }) } : {}),
    },
    decodeImage: async () => flatColorsPicture(),
    loadCatalog: async () => catalog,
    readClipboardImage: async () => undefined,
  }
}

const press = (root: HTMLElement, testid: string) => root.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.click()

const framed = withLayers(empty, { frame: { row: 2, column: 3, rows: 4, columns: 5, technique: 'loom' as const, beads: {} } })

/** The Margin color popover, hung from a button at the screen's right edge as the sheet's tools are. */
const MarginColorPopoverHost = defineComponent({
  setup() {
    const button = ref<HTMLElement>()
    const shown = ref(false)
    onMounted(() => (shown.value = true))
    return () =>
      h('div', { style: { position: 'fixed', right: '8px', top: '8px' } }, [
        h('button', { ref: button, type: 'button' }, 'Margin'),
        shown.value ? h(MarginColorPopover, { anchor: button.value, project: framed }) : null,
      ])
  },
})

const CASES: FitCase[] = [
  ['ColorPopover', ColorPopoverHost as Component, {}],
  ['ToastRegion', Toasts, {}],
  ['Save failed notice', SaveFailedNotice, {}],
  ['ProjectsLibrary', ProjectsLibrary, { projects: [empty, withLayers(empty, { id: 'b', name: 'Fox' }), withLayers(empty, { id: 'c', name: 'Owl' }), withLayers(empty, { id: 'd', name: 'Hare' })], activeProjectId: empty.id }],
  ['EmptyCanvas', EmptyCanvas, {}],
  ['CanvasHint', CanvasHint, {}],
  ['MarginSheet', marginSheetHost(1), {}],
  ['MarginSheet (compact)', marginSheetHost(0.66), {}],
  ['MarginSheet (folded)', marginSheetHost(0.4), {}],
  ['MarginSheet (bare)', marginSheetHost(0.25), {}],
  ['MarginColorPopover', MarginColorPopoverHost as Component, {}],
  [
    'ContextBar',
    ContextBar,
    { project: painted, selection: { top: 0, left: 0, rows: 2, columns: 2 }, selectionSummary: '2×2 ≈ 3 × 3 mm', pasteArmed: false, canRemoveLine: true, canNamePiece: true, hasClipboard: true, anchor: { box: { left: 40, top: 160, width: 100, height: 60 }, viewport: { width: 360, height: 640 } } },
    async () => void (await armSelectionBar()),
  ],
  ['StarterGallery', StarterGallery, {}],
  ['StarterGallery (Shapes)', StarterGallery, { category: 'shapes' }],
  ['StarterSetup', StarterSetup, { starter: starterById('kaleidocycle') }],
  ['StarterSetup (on a Project)', StarterSetup, { starter: starterById('warpedSquare'), project: framed }],
  ['StarterGallery (Earrings)', StarterGallery, { category: 'earrings' }],
  ['StarterGallery (Rings)', StarterGallery, { category: 'rings' }],
  ['StarterGallery (Bands)', StarterGallery, { category: 'bands' }],
  ['StarterSetup (V fringe)', StarterSetup, { starter: starterById('vFringe') }],
  ['StarterSetup (Ring)', StarterSetup, { starter: starterById('ringDiamonds'), project: framed }],
  ['StarterSetup (Band)', StarterSetup, { starter: starterById('bandPlaid') }],
  ['BeadColorList', BeadColorList, { colors: beadColors('ready') }],
  ['BeadColorList failed', BeadColorList, { colors: beadColors('failed') }],
  ['ConvertImageWizard (no picture)', ConvertImageWizard, wizardProps(false)],
  ['PictureDropOverlay', PictureDragged, {}],
  [
    'ConvertImageWizard (remapping)',
    ConvertImageWizard,
    wizardProps(true),
    async (root) => {
      await pictureSet(root)
      press(root, 'ratio-custom')
      press(root, 'found-color-remap')
    },
  ],
  [
    'ConvertImageWizard (by size)',
    ConvertImageWizard,
    wizardProps(true),
    async (root) => {
      await pictureSet(root)
      root.querySelector<HTMLElement>('[data-testid="convert-size-mode"] [data-value="size"]')?.click()
    },
  ],
]

describeFits(CASES)
