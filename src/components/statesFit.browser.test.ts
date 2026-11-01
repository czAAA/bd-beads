import { defineComponent, h, onMounted, ref, type Component } from 'vue'
import { describeFits, type FitCase } from '../testUtils/browserFit'
import ColorPopover from './tools/ColorPopover.vue'
import { MIRROR_OFF, type MirrorSetting } from '../domain/mirror'
import ToastRegion from './ui/ToastRegion.vue'
import AppMessage from './ui/AppMessage.vue'
import AppButton from './ui/AppButton.vue'
import { useI18n } from '../i18n/useI18n'
import { fillBlanks } from '../domain/fillBlanks'
import BeadColorList from './palette/BeadColorList.vue'
import ProjectsLibrary from './project/ProjectsLibrary.vue'
import StarterGallery from './project/StarterGallery.vue'
import StarterSetup from './project/StarterSetup.vue'
import PictureDropOverlay from './import/PictureDropOverlay.vue'
import EmptyCanvas from './canvas/EmptyCanvas.vue'
import CanvasHint from './canvas/CanvasHint.vue'
import FirstRunHints from './canvas/FirstRunHints.vue'
import MarginColorPopover from './canvas/MarginColorPopover.vue'
import ContextBar from './tools/ContextBar.vue'
import SchemaTags from './canvas/SchemaTags.vue'
import { withPieceName } from '../domain/pieceNames'
import { BEAD_CATALOG } from '../domain/beads'
import { createProject } from '../domain/createProject'
import { paintAt } from '../testUtils/layers'
import { marginSheetHost } from '../testUtils/marginSheetHost'
import { armSelectionBar } from '../testUtils/pill'
import ConvertPageHost from '../testUtils/ConvertPageHost.vue'
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

/** The Mirror bar (ticket 0750, ContextBar card): both straight Axes on with their counts, the widest it gets in one
 * row, over a Canvas Area; it takes two rows where the canvas box is too narrow for that. */
const mirrorBoth: MirrorSetting = { ...MIRROR_OFF, axes: { leftRight: true, topBottom: true, radial: false }, counts: { leftRight: 2, topBottom: 3 }, place: { layer: 'canvas', area: { row: 0, column: 0, rows: 10, columns: 12 } } }
const mirrorBar = (setting: MirrorSetting) => ({
  project: painted,
  pasteArmed: false,
  canRemoveLine: false,
  mirror: { setting, summary: '12×10 ≈ 1.8 × 1.5 cm', rect: { row: 0, column: 0, rows: 10, columns: 12 } },
  mirrorAnchor: { box: { left: 40, top: 160, width: 100, height: 60 }, viewport: { width: 360, height: 640 } },
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

/** The notice of a Project that didn't open last time, with its Remove and Export (ticket 0716). */
const MissedProjectNotice = defineComponent({
  setup() {
    const { t } = useI18n()
    return () =>
      h(AppMessage, { tone: 'warning', placement: 'notice' }, () => [
        h('span', fillBlanks(t.value.opening.didNotOpen, { name: 'Panel with a logo' })),
        h('span', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' } }, [
          h(AppButton, { variant: 'in-box', size: 'sm', icon: 'delete' }, () => t.value.opening.removeButton),
          h(AppButton, { variant: 'in-box', size: 'sm', icon: 'export' }, () => t.value.opening.exportButton),
        ]),
      ])
  },
})

/** A sealed Project's row and one whose Pieces are still being counted, among the rest (ticket 0716). */
const hugeRows = Object.fromEntries(Array.from({ length: 251 }, (_r, row) => [row, Object.fromEntries(Array.from({ length: 1000 }, (_c, column) => [column, '#1a1a1a']))]))
const sealedProject = { id: 'sealed', name: 'Black fill', createdAt: Date.UTC(2026, 9, 1), updatedAt: Date.UTC(2026, 9, 30), savedAt: Date.UTC(2026, 9, 30), layerBeads: [31_771_024, 440], beads: 31_771_464, stored: '{}' }

/** The Bead's Color catalog as its list reads it (a stand-in for `useBeadColors`). */
function beadColors(state: 'ready' | 'failed') {
  const finishes = ['metallic', 'matte', 'opaque'] as const
  const swatches = ['Blue', 'Gray', 'Green'].map((family, i) => ({ code: `DB${i + 1}`, family, finish: finishes[i]!, hex: '#123456', approximate: true, discontinued: i === 1, taken: false }))
  // With `report`, so the foot row that opens a color Report (ticket 0700) is measured too.
  return { available: ref(true), state: ref(state), swatches: ref(swatches), bead: ref(BEAD_CATALOG[2]), catalog: ref(undefined), load: () => {}, add: () => 'added' as const, report: () => {} }
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

/** Two unframed Schemas with their tags in a phone-sized canvas box (tickets 0721, 0733): "Owl" and "Butterfly", which
 * opens into the paper tag. */
const schemaTagsHost = defineComponent({
  setup() {
    const colors = createPalette(defaultPaletteIds()).colors.map((color) => color.hex)
    const drawn = paintAt(paintAt(withLayers(empty, { frame: undefined }), [0, 1, 2].map((column) => ({ row: 0, column })), colors[0]!), [{ row: 6, column: 0 }, { row: 6, column: 1 }], colors[1]!)
    const project = withPieceName(withPieceName(drawn, { row: 0, column: 0 }, 'Owl'), { row: 6, column: 0 }, 'Butterfly')
    const anchors = {
      schemas: [
        { name: 'Owl', anchor: { row: 0, column: 0 }, piece: { row: 0, column: 0, rows: 1, columns: 3 }, box: { left: 24, top: 48, width: 64, height: 24 } },
        { name: 'Butterfly', anchor: { row: 6, column: 0 }, piece: { row: 6, column: 0, rows: 1, columns: 2 }, box: { left: 200, top: 120, width: 44, height: 24 } },
      ],
      viewport: { width: 300, height: 420 },
    }
    return () => h('div', { style: { position: 'relative', width: '300px', height: '420px' } }, [h(SchemaTags, { project, anchors })])
  },
})
const openSchemaTag = (root: HTMLElement) => root.querySelector<HTMLElement>('[aria-label^="Butterfly"]')?.click()

/** The first-run hints (ticket 0725) in a canvas box like the app's: the strip's four buttons above the drawing area,
 * the Tool pill docked at its foot with the tiles the notes point at. */
const firstRunHintsHost = defineComponent({
  setup() {
    const box = ref<HTMLElement>()
    const button = (hint: string, width: number) => h('button', { type: 'button', 'data-hint': hint, style: { width: `${width}px`, height: '30px' } })
    const tile = (hint?: string) => h('button', { type: 'button', 'data-hint': hint, style: { width: '40px', height: '40px', flex: 'none' } })
    return () =>
      h('div', { ref: box, style: { display: 'flex', flexDirection: 'column', width: '100%', height: '640px' } }, [
        h('div', { style: { display: 'flex', gap: '4px', height: '32px', alignItems: 'center' } }, [
          button('menu', 60), button('project', 70), button('frame', 60), h('span', { style: { flex: 1 } }), button('export', 30),
        ]),
        h('div', { style: { position: 'relative', flex: 1 } }, [
          box.value ? h(FirstRunHints, { scope: box.value, pillPosition: 'bottom', pillRect: undefined, background: undefined }) : null,
          h('div', { 'data-hint-obstacle': '', style: { position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '2px', padding: '4px' } }, [
            tile(), tile(), tile('select'), tile(), tile(), tile(), tile('mirror'), tile('color'),
          ]),
        ]),
      ])
  },
})

const CASES: FitCase[] = [
  ['ColorPopover', ColorPopoverHost as Component, {}],
  ['ToastRegion', Toasts, {}],
  ['Save failed notice', SaveFailedNotice, {}],
  ['Missed Project notice', MissedProjectNotice, {}],
  ['ProjectsLibrary (sealed and counting)', ProjectsLibrary, { projects: [withLayers(empty, { id: 'h', name: 'Counting', beads: hugeRows, updatedAt: 1, savedAt: 1 })], sealed: [sealedProject] }],
  ['ProjectsLibrary', ProjectsLibrary, { projects: [empty, withLayers(empty, { id: 'b', name: 'Fox' }), withLayers(empty, { id: 'c', name: 'Owl' }), withLayers(empty, { id: 'd', name: 'Hare' })], activeProjectId: empty.id }],
  ['EmptyCanvas', EmptyCanvas, {}],
  ['CanvasHint', CanvasHint, {}],
  ['FirstRunHints', firstRunHintsHost as Component, {}],
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
  ['Mirror bar', ContextBar, mirrorBar(mirrorBoth)],
  ['Mirror bar (Radial)', ContextBar, mirrorBar({ ...mirrorBoth, axes: { leftRight: false, topBottom: false, radial: true } })],
  ['Mirror bar (one bead wide)', ContextBar, { ...mirrorBar(mirrorBoth), mirror: { setting: mirrorBoth, summary: '1×10 ≈ 1.5 × 15 mm', rect: { row: 0, column: 0, rows: 10, columns: 1 } } }],
  ['Mirror bar (Custom frame)', ContextBar, { ...mirrorBar({ ...mirrorBoth, mode: 'repeat' }), mirror: { setting: { ...mirrorBoth, mode: 'repeat' }, summary: 'Fringe earring · 21×20 ≈ 3.2 × 3 cm', shape: { axes: { leftRight: true, topBottom: false, radial: false } } } }],
  ['SchemaTags', schemaTagsHost, {}],
  ['SchemaTags (open)', schemaTagsHost, {}, openSchemaTag],
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
  ['Convert image page (no picture)', ConvertPageHost, wizardProps(false)],
  ['PictureDropOverlay', PictureDragged, {}],
  [
    'Convert image page (remapping)',
    ConvertPageHost,
    wizardProps(true),
    async (root) => {
      await pictureSet(root)
      press(root, 'convert-step-colors')
      press(root, 'convert-color-by-color')
      press(root, 'found-color-remap')
    },
  ],
  [
    'Convert image page (a part, in mm)',
    ConvertPageHost,
    wizardProps(true),
    async (root) => {
      await pictureSet(root)
      root.querySelector<HTMLElement>('[data-testid="convert-weave"] [data-value="part"]')?.click()
      press(root, 'convert-step-size')
      await new Promise((done) => setTimeout(done, 20))
      root.querySelector<HTMLElement>('[data-testid="convert-size-unit"] [data-value="mm"]')?.click()
    },
  ],
  [
    'Convert image page (cut out Simple)',
    ConvertPageHost,
    wizardProps(true),
    async (root) => {
      await pictureSet(root)
      root.querySelector<HTMLElement>('[data-testid="convert-cut-out"] [data-value="simple"]')?.click()
      await new Promise((done) => setTimeout(done, 20))
    },
  ],
  [
    'Convert image page (Outline color)',
    ConvertPageHost,
    wizardProps(true),
    async (root) => {
      await pictureSet(root)
      press(root, 'convert-step-colors')
      press(root, 'convert-color-by-color')
      press(root, 'found-color-empty')
      await new Promise((done) => setTimeout(done, 20))
      press(root, 'convert-outline-switch')
      press(root, 'convert-outline-color')
    },
  ],
  [
    'Convert image page (Bead & Technique)',
    ConvertPageHost,
    wizardProps(true),
    async (root) => {
      await pictureSet(root)
      press(root, 'convert-step-bead')
    },
  ],
  [
    'Convert image page (Review)',
    ConvertPageHost,
    wizardProps(true),
    async (root) => {
      await pictureSet(root)
      press(root, 'convert-step-review')
    },
  ],
]

describeFits(CASES)
