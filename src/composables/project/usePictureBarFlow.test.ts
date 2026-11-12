import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import type { PixelData } from '../../domain/imageConversion'
import { beadsOfLayer } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { withReferenceImage, type ReferencePlace } from '../../domain/referenceImage'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { bareProject } from '../../testUtils/layerFields'
import { usePictureBarFlow } from './usePictureBarFlow'

const RED = [255, 0, 0, 255]
const BLUE = [0, 0, 255, 255]
/** A 6 × 4 picture, its left half red and its right half blue. */
const halves: PixelData = { width: 6, height: 4, data: Array.from({ length: 24 }, (_pixel, at) => (at % 6 < 3 ? RED : BLUE)).flat() }
/** Over loom's 20 grid px beads, the picture at 120 × 80 covers columns 0 to 5 and rows 0 to 3. */
const place: ReferencePlace = { x: 60, y: 40, width: 120, angle: 0 }
const picture = { name: 'rose.png', type: 'image/png', width: 6, height: 4, bytes: 10 }

function setup(start: Project = bareProject({ technique: 'loom', beads: { 0: { 0: '#00ff00' } } })) {
  const harness = editHarness(withReferenceImage(start, { picture, place, opacity: 50, shown: true }))
  const at = ref(place)
  const blob = new Blob(['picture'])
  const deps = {
    currentProject: harness.currentProject,
    edit: harness.edit,
    onUndo: harness.history.onUndo,
    place: () => at.value,
    picture: () => blob,
    decodePixels: vi.fn(async () => halves),
    loadCatalog: vi.fn(),
    setShown: vi.fn((shown: boolean) => harness.replaceProject(withReferenceImage(harness.project, { ...harness.project.referenceImage!, shown }))),
    setFrameAround: vi.fn(),
    openAllSettings: vi.fn(),
    showToast: vi.fn(),
    announce: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
  }
  const flow = usePictureBarFlow(deps)
  return { harness, deps, flow, at }
}

describe('usePictureBarFlow (ReferenceImage card, ticket 0883)', () => {
  it('sizes the picture by the Canvas positions it covers, and follows a corner drag', () => {
    const { flow, at } = setup()
    expect(flow.box.value).toEqual({ row: 0, column: 0, rows: 4, columns: 6 })
    expect(flow.size.value?.grid).toBe('6×4')
    at.value = { x: 40, y: 40, width: 80, angle: 0 }
    expect(flow.size.value?.grid).toBe('4×2')
  })

  it('sets the Frame round the positions the picture covers', () => {
    const { flow, deps } = setup()
    flow.frameAround()
    expect(deps.setFrameAround).toHaveBeenCalledWith({ row: 0, column: 0, rows: 4, columns: 6 })
  })

  it('opens Convert to beads at Exact and every color, previewing the beads without changing the Project', async () => {
    const { flow, harness } = setup()
    flow.open()
    await flushPromises()
    expect(flow.source.value).toBe('exact')
    expect(flow.colors.value).toBe(2)
    expect(flow.conversion.value?.changes).toHaveLength(24)
    expect(flow.replacedLabel.value).toBe('Replaces 1 bead already there.')
    expect(flow.convertLabel.value).toBe('Convert 24 beads')
    expect(beadsOfLayer(flow.previewProject.value!, 'canvas')[0]).toMatchObject({ 0: '#ff0000', 5: '#0000ff' })
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual({ 0: { 0: '#00ff00' } })
  })

  it('converts as one Undo step, hides the picture, and the toast\'s Undo takes the beads back and shows it again', async () => {
    const { flow, harness, deps } = setup()
    flow.open()
    await flushPromises()
    flow.convert()
    expect(beadsOfLayer(harness.project, 'canvas')[3]).toMatchObject({ 0: '#ff0000', 2: '#ff0000', 3: '#0000ff' })
    expect(harness.project.referenceImage?.shown).toBe(false)
    expect(flow.converting.value).toBe(false)
    expect(deps.showToast).toHaveBeenCalledWith(
      'convert-to-beads',
      '24 beads made from the picture, 2 colors. The picture is hidden: show it from the Canvas strip.',
      'success',
      expect.objectContaining({ label: 'Undo' }),
    )
    const undo = deps.showToast.mock.calls[0]![3] as { run: () => void }
    undo.run()
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual({ 0: { 0: '#00ff00' } })
    expect(harness.project.referenceImage?.shown).toBe(true)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('keeps the picture shown with Hide the picture after off, and reduces to the Colors count', async () => {
    const { flow, harness } = setup()
    flow.open()
    await flushPromises()
    flow.hideAfter.value = false
    flow.setColors(1)
    flow.convert()
    expect(harness.project.referenceImage?.shown).toBe(true)
    expect(new Set(Object.values(beadsOfLayer(harness.project, 'canvas')[1]!)).size).toBe(1)
  })

  it('is off for a picture under 4 positions a side, and over 300', () => {
    const { flow, at } = setup()
    at.value = { x: 30, y: 30, width: 60, angle: 0 }
    expect(flow.convertOff.value).toBe('too-small')
    flow.open()
    expect(flow.converting.value).toBe(false)
    at.value = { x: 4000, y: 4000, width: 6200, angle: 0 }
    expect(flow.convertOff.value).toBe('too-big')
  })

  it('hands All settings the picture, its size, the match and the color count, and folds the popover away', async () => {
    const { flow, deps } = setup()
    flow.open()
    await flushPromises()
    flow.allSettings()
    expect(deps.openAllSettings).toHaveBeenCalledWith(expect.objectContaining({ box: { row: 0, column: 0, rows: 4, columns: 6 }, source: 'exact', colors: 2, hideAfter: true }))
    expect(flow.converting.value).toBe(false)
  })

  it('lays Convert image\'s Add to Canvas beads where the picture lay, as one Undo step with the same toast', () => {
    const { flow, harness, deps } = setup()
    const red = { color: '#ff0000' }
    const none = { color: null }
    flow.addGrid([[red, none], [red, red]], { picture: new Blob(), name: 'rose.png', box: { row: 5, column: 7, rows: 2, columns: 2 }, source: 'exact', colors: 1, hideAfter: false })
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual({ 0: { 0: '#00ff00' }, 5: { 7: '#ff0000' }, 6: { 7: '#ff0000', 8: '#ff0000' } })
    expect(deps.showToast).toHaveBeenCalledWith('convert-to-beads', '3 beads made from the picture, 1 color.', 'success', expect.anything())
    harness.history.onUndo()
    expect(beadsOfLayer(harness.project, 'canvas')).toEqual({ 0: { 0: '#00ff00' } })
  })

  it('opens with Hide the picture after on each time, and folds away when the picture is hidden', async () => {
    const { flow, harness } = setup()
    flow.open()
    flow.hideAfter.value = false
    flow.close()
    flow.open()
    expect(flow.hideAfter.value).toBe(true)
    harness.replaceProject(withReferenceImage(harness.project, { ...harness.project.referenceImage!, shown: false }))
    await flushPromises()
    expect(flow.converting.value).toBe(false)
  })

  it('sets the Frame from a row where one may start, on a Technique whose rows alternate', () => {
    const { flow, deps, at } = setup(bareProject({ technique: 'brick' }))
    at.value = { x: 60, y: 60, width: 120, angle: 0 }
    const box = flow.box.value!
    flow.frameAround()
    const set = deps.setFrameAround.mock.calls[0]![0]
    expect(set.row % 2).toBe(0)
    expect(set.row + set.rows).toBe(box.row + box.rows)
  })
})
