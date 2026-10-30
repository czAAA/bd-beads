import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppDialogs from './AppDialogs.vue'
import AppPanels from './AppPanels.vue'
import { changeFrame } from '../../domain/changeFrame'
import { createProject } from '../../domain/createProject'
import { withColors } from '../../domain/canvas'
import { findBead } from '../../domain/beads'
import { loadProjects, saveProjects } from '../../services/libraryStore'
import { en } from '../../i18n/en'
import { mountShellParts } from '../../testUtils/shellHost'
import { refuseStorageWrites } from '../../testUtils/storageWrites'
import { backgroundOf, canvasOf, frameOf, layerOf, withFrameSheet } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'

/** Menu, Project and the Frame panel reach their flows and dialogs without the canvas (tickets 232, 443, 0618), one
 * test per control → flow. What the panels hold is in MenuPanel and ProjectPanel, Back, Escape and focus in AppPanel
 * and useOverlayLayer, the rules in the flows, and a strip button opening its panel in the App tests. */

const moth = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 10, height: 10, unit: 'beads' } })
const other = () => (withLayers(moth(), { id: 'other', name: 'Other' }))

beforeEach(() => {
  saveProjects([moth()])
})

afterEach(() => vi.restoreAllMocks())

const mountPanels = () => mountShellParts(AppPanels, AppDialogs)
type Mounted = ReturnType<typeof mountPanels>

const names = () => loadProjects().map((project) => canvasOf(project).name).sort()
const text = ({ wrapper }: Mounted, testId: string) => wrapper.get(`[data-testid="${testId}"]`).text()
const click = async ({ wrapper }: Mounted, testId: string) => {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await flushPromises()
}
/** Picks a value in a PanelPicker's menu or a SegmentedControl. */
const choose = async ({ wrapper }: Mounted, testId: string, value: string) => {
  const opener = wrapper.find(`[data-testid="${testId}"] button[aria-haspopup]`)
  if (opener.exists()) await opener.trigger('click')
  await wrapper.get(`[data-testid="${testId}"] [data-value="${value}"]`).trigger('click')
  await flushPromises()
}

/** Menu's Projects library, as its row opens it. */
async function openSavedProjects(mounted: Mounted) {
  await mounted.openPanel('menu')
  await click(mounted, 'menu-saved-projects')
}

describe('Menu', () => {
  it('closes on Escape', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('menu')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(mounted.wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('opens the Projects library and New Project as its subpanels, each under its own title', async () => {
    const mounted = mountPanels()
    await openSavedProjects(mounted)
    expect(text(mounted, 'panel-sub-title')).toBe(en.projects.heading)

    await click(mounted, 'panel-back')
    await click(mounted, 'menu-new-project')
    expect(text(mounted, 'panel-sub-title')).toBe(en.projects.newProjectButton)
    expect(mounted.wrapper.find('[data-testid="bead-section"]').exists()).toBe(true)
  })

  it('deletes every Project after a confirmation, leaving none open; Cancel keeps them', async () => {
    saveProjects([moth(), other()])
    const mounted = mountPanels()
    await openSavedProjects(mounted)
    await click(mounted, 'menu-delete-all')
    await click(mounted, 'confirm-modal-cancel')
    expect(mounted.wrapper.find('[data-testid="delete-all-projects-modal"]').exists()).toBe(false)
    expect(loadProjects()).toHaveLength(2)

    await openSavedProjects(mounted)
    await click(mounted, 'menu-delete-all')
    await click(mounted, 'confirm-modal-confirm')

    expect(loadProjects()).toEqual([])
    expect(mounted.panels.activeProject.value).toBeUndefined()
  })

  it('starts a Project from a Starter: a category, an option, and Create puts it in place and closes the panel (ticket 0596)', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('menu')
    await click(mounted, 'menu-new-project')
    await click(mounted, 'pick-starter')
    await click(mounted, 'starter-category-shapes')
    await click(mounted, 'starter-card-star')
    await click(mounted, 'create-starter-project')

    expect(frameOf(loadProjects().find((project) => canvasOf(project).name === en.frame.shapes.star))).toMatchObject({ shape: 'star' })
    expect(mounted.wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('removes a Project from the Projects library after a danger confirmation naming it (ticket 232)', async () => {
    saveProjects([moth(), other()])
    const mounted = mountPanels()
    await openSavedProjects(mounted)
    await click(mounted, 'remove-project-other')

    expect(text(mounted, 'remove-project-modal')).toContain('“Other”')
    expect(mounted.wrapper.get('[data-testid="confirm-modal-confirm"]').classes().join(' ')).toContain('danger')
    expect(names()).toEqual(['Moth', 'Other'])

    await click(mounted, 'confirm-modal-confirm')
    expect(names()).toEqual(['Moth'])
  })

  it('switches to a picked Project only once confirmed, naming both, and puts the library away (ticket 232)', async () => {
    saveProjects([other(), moth()])
    const mounted = mountPanels()
    const open = mounted.panels.activeProject.value!
    const picked = open.id === 'other' ? moth() : other()
    await openSavedProjects(mounted)
    await click(mounted, `select-project-${picked.id}`)

    const modal = text(mounted, 'switch-project-modal')
    expect(modal).toContain(`“${canvasOf(open).name}”`)
    expect(modal).toContain(`“${canvasOf(picked).name}”`)
    expect(text(mounted, 'confirm-modal-confirm')).toBe(en.switchProject.confirmButton)
    expect(mounted.panels.activeProject.value!.id).toBe(open.id)

    await click(mounted, 'confirm-modal-confirm')
    expect(mounted.wrapper.find('[data-testid="switch-project-modal"]').exists()).toBe(false)
    expect(mounted.wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(mounted.panels.activeProject.value!.id).toBe(picked.id)
  })

  it('offers Save first and Switch anyway when the open Project is not saved (ticket 232)', async () => {
    saveProjects([other(), moth()])
    const mounted = mountPanels()
    const picked = mounted.panels.activeProject.value!.id === 'other' ? moth() : other()
    refuseStorageWrites('openbeads:patterns')
    mounted.panels.onRenameProject('Current')
    await openSavedProjects(mounted)
    await click(mounted, `select-project-${picked.id}`)

    expect(text(mounted, 'switch-project-modal')).toContain('“Current” is not saved')
    expect(text(mounted, 'confirm-modal-extra')).toBe(en.switchProject.saveButton)
    expect(text(mounted, 'confirm-modal-confirm')).toBe(en.importSwitch.switchAnywayButton)

    await click(mounted, 'confirm-modal-extra')
    expect(text(mounted, 'switch-project-save-failed')).toBe(en.storage.saveFailedMessage)

    await click(mounted, 'confirm-modal-confirm')
    expect(mounted.panels.activeProject.value!.id).toBe(picked.id)
  })
})

describe('Project', () => {
  it('sets the Canvas from its Layer settings: Technique and its settings as Undo steps (ticket 0670)', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('project')
    await choose(mounted, 'canvas-technique', 'brick')
    await click(mounted, 'canvas-brick-drop-more')
    const saved = () => loadProjects()[0]
    expect(layerOf(saved(), 'canvas')).toMatchObject({ weave: { technique: 'brick', techniqueSettings: { brickDrop: 2 } } })
    expect(layerOf(saved(), 'frame')).toMatchObject({ weave: { technique: 'loom' } })

    mounted.canvas.onUndo()
    mounted.canvas.onUndo()
    expect(layerOf(saved(), 'canvas')).toMatchObject({ weave: { technique: 'loom' } })
  })

  it('renames from the pencil, and Try again saves what a full storage refused', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('project')
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await click(mounted, 'project-name-edit')
    await mounted.wrapper.get<HTMLInputElement>('[data-testid="project-name-input"]').setValue('Owl')
    await mounted.wrapper.get('[data-testid="project-name-form"]').trigger('submit')
    await flushPromises()
    expect(names()).toEqual(['Moth'])

    setItem.mockRestore()
    await click(mounted, 'save-try-again')
    expect(names()).toEqual(['Owl'])
    expect(text(mounted, 'save-state')).toBe(en.panels.project.savedLocal)
  })

  it('duplicates through the popup and opens the copy; Cancel changes nothing', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('project')
    await click(mounted, 'project-duplicate')
    await click(mounted, 'duplicate-cancel')
    expect(names()).toEqual(['Moth'])

    await mounted.openPanel('project')
    await click(mounted, 'project-duplicate')
    await click(mounted, 'duplicate-confirm')

    expect(names()).toEqual(['Moth', 'Moth 2'])
    expect(canvasOf(mounted.panels.activeProject.value!).name).toBe('Moth 2')
  })

  it('deletes after a confirmation naming the Project, leaving none open; Cancel keeps it', async () => {
    saveProjects([moth(), other()])
    const mounted = mountPanels()
    await mounted.openPanel('project')
    const open = text(mounted, 'project-name')
    await click(mounted, 'project-delete')
    expect(text(mounted, 'delete-project-modal')).toContain(`Delete ${open}?`)
    await click(mounted, 'confirm-modal-cancel')
    expect(loadProjects()).toHaveLength(2)

    await mounted.openPanel('project')
    await click(mounted, 'project-delete')
    await click(mounted, 'confirm-modal-confirm')

    expect(loadProjects()).toHaveLength(1)
    expect(mounted.panels.activeProject.value).toBeUndefined()
  })

  it('replaces the Canvas\'s Bead after a confirmation, the Frame keeping its own; Cancel keeps it (tickets 48, 0665, 0670)', async () => {
    const mounted = mountPanels()
    const pickReplacement = async () => {
      await mounted.openPanel('project')
      await choose(mounted, 'bead-type', findBead('toho/round/11-0')!.formFactor.id)
    }
    await pickReplacement()
    expect(mounted.wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(true)
    await click(mounted, 'confirm-modal-cancel')
    expect(mounted.wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(false)
    expect(canvasOf(loadProjects()[0]).beadId).toBe('toho/cube/1.5mm')

    await pickReplacement()
    await click(mounted, 'confirm-modal-confirm')
    expect(canvasOf(loadProjects()[0]).beadId).toBe('toho/round/11-0')
    expect(frameOf(loadProjects()[0])!.beadId).toBe('toho/cube/1.5mm')
  })
})

describe('The Frame panel', () => {
  it('sets the Frame from its Layer settings: Technique, its settings and Bead as Undo steps (ticket 0670)', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('frame')
    await choose(mounted, 'frame-technique', 'brick')
    await click(mounted, 'frame-brick-drop-more')
    await choose(mounted, 'bead-type', findBead('toho/round/11-0')!.formFactor.id)
    await click(mounted, 'confirm-modal-confirm')
    const saved = () => loadProjects()[0]
    expect(layerOf(saved(), 'frame')).toMatchObject({ weave: { technique: 'brick', techniqueSettings: { brickDrop: 2 } }, beadId: 'toho/round/11-0' })
    expect(layerOf(saved(), 'canvas')).toMatchObject({ weave: { technique: 'loom' }, beadId: 'toho/cube/1.5mm' })

    mounted.canvas.onUndo()
    expect(layerOf(saved(), 'frame')).toMatchObject({ weave: { technique: 'brick' }, beadId: 'toho/cube/1.5mm' })
  })

  it('puts a Starter on the open Project, and closes the panel (tickets 555, 0596)', async () => {
    const open = withFrameSheet(moth(), undefined)
    saveProjects([open])
    const mounted = mountPanels()
    await mounted.openPanel('frame')
    await click(mounted, 'frame-from-starter')
    await click(mounted, 'starter-category-shapes')
    await click(mounted, 'starter-card-triangle')
    await click(mounted, 'create-starter-project')

    expect(frameOf(loadProjects()[0])).toMatchObject({ shape: 'triangle' })
    expect(mounted.wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
  })

  it('saves each press of a Custom frame\'s stepper at once, and they are one Undo step once the panel closes (ticket 0640)', async () => {
    const placed = changeFrame(moth(), { custom: { shape: 'triangle', size: 6, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error(placed.kind)
    saveProjects([placed.project])
    const mounted = mountPanels()
    await mounted.openPanel('frame')
    await click(mounted, 'frame-setting-rounds-less')
    await click(mounted, 'frame-setting-rounds-less')
    expect(frameOf(loadProjects()[0])!.settings).toEqual({ rounds: 4 })
    mounted.panels.openPanel.value = null
    await nextTick()
    mounted.canvas.onUndo()
    expect(frameOf(loadProjects()[0])!.settings).toEqual({ rounds: 6 })
  })
})

describe('Backgrounds (ticket 0666)', () => {
  it('saves the Canvas\'s from the Project panel and the Frame\'s from the Frame panel, each on its own', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('project')
    await click(mounted, 'background-color-fog')
    expect(backgroundOf(loadProjects()[0], 'canvas')).toBe(4)

    await mounted.openPanel('frame')
    await click(mounted, 'background-color-pebble')
    expect(backgroundOf(loadProjects()[0], 'frame')).toBe(5)
    expect(backgroundOf(loadProjects()[0], 'canvas')).toBe(4)
  })

  it('starts a new Project\'s layers on the last one picked', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('frame')
    await click(mounted, 'background-color-stone')
    await mounted.openPanel('menu')
    await click(mounted, 'menu-new-project')
    await click(mounted, 'pick-starter')
    await click(mounted, 'starter-category-shapes')
    await click(mounted, 'starter-card-star')
    await click(mounted, 'create-starter-project')

    const star = loadProjects().find((project) => canvasOf(project).name === en.frame.shapes.star)!
    expect([backgroundOf(star, 'canvas'), backgroundOf(star, 'frame')]).toEqual([3, 3])
  })
})

describe('The Export panel', () => {
  it('fits a frame to the drawing from the no-Frame view, then shows the exports (ticket 0652)', async () => {
    const open = withFrameSheet(moth(), undefined)
    saveProjects([withLayers(open, { beads: withColors({}, [{ row: 2, column: 2, color: '#ff0000' }, { row: 4, column: 5, color: '#00ff00' }]) })])
    const mounted = mountPanels()
    await mounted.openPanel('export')
    expect(mounted.wrapper.find('[data-testid="export-png"]').exists()).toBe(false)

    await click(mounted, 'export-fit')

    expect(frameOf(loadProjects()[0])).toBeDefined()
    expect(mounted.wrapper.find('[data-testid="export-png"]').exists()).toBe(true)
  })
})
