import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppDialogs from './AppDialogs.vue'
import AppPanels from './AppPanels.vue'
import CanvasStrip from '../canvas/CanvasStrip.vue'
import { changeFrame } from '../../domain/changeFrame'
import { createProject } from '../../domain/createProject'
import { withColors } from '../../domain/canvas'
import { findBead } from '../../domain/beads'
import { loadProjects, saveProjects } from '../../services/libraryStore'
import { en } from '../../i18n/en'
import { mountShellParts, mountShellPartsOn } from '../../testUtils/shellHost'
import { choosePanelOption } from '../../testUtils/choosePanelOption'
import { memoryAccount } from '../../services/memoryAccount'
import { refuseStorageWrites } from '../../testUtils/storageWrites'
import { backgroundOf, canvasOf, frameOf, layerOf, withFrameSheet } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'
import { moveToRow, rowProgressStarted } from '../../domain/rowProgress'
import { newReferenceImage, withReferenceImage } from '../../domain/referenceImage'
import { projectFileNameOf } from '../../domain/projectFile'
import { downloadFile } from '../../services/fileDownload'
import { hasOpenLayer } from '../../composables/ui/useOverlayLayer'

vi.mock('../../services/fileDownload', () => ({ downloadFile: vi.fn() }))

/** Menu, Project and the Frame panel reach their flows and dialogs without the canvas (tickets 232, 443, 0618), one
 * test per control → flow. What the panels hold is in MenuPanel and ProjectPanel, Back, Escape and focus in AppPanel
 * and useOverlayLayer, the rules in the flows, and a strip button opening its panel in the App tests. */

const moth = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 10, height: 10, unit: 'beads' } })
const other = () => (withLayers(moth(), { id: 'other', name: 'Other' }))

beforeEach(() => {
  saveProjects([moth()])
  // This Project starts folded (ticket 0971): these tests press its rows.
  localStorage.setItem('openbeads:panel-sections-opened', 'project:this')
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

  it('shows every button\'s name from Help\'s What the buttons do, the Menu closed, until Escape (ticket 0927)', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('menu')
    await click(mounted, 'menu-item-button-names')
    expect(mounted.wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(hasOpenLayer()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(hasOpenLayer()).toBe(false)
    mounted.wrapper.unmount()
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

  it('opens on its root list over the converter, even with an empty library, so leaving asks first (ticket 0861)', async () => {
    saveProjects([])
    const mounted = mountPanels()
    mounted.panels.onOpenConvertImage()
    await flushPromises()
    await mounted.openPanel('menu')
    expect(mounted.wrapper.find('[data-testid="menu-new-project"]').exists()).toBe(true)
    expect(mounted.wrapper.find('[data-testid="create-project"]').exists()).toBe(false)
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

  it('asks Delete all naming how many, whose Save all Projects to a Project file saves them and leaves the question open (ticket 0984)', async () => {
    saveProjects([moth(), other()])
    const mounted = mountPanels()
    await openSavedProjects(mounted)
    await click(mounted, 'menu-delete-all')

    expect(text(mounted, 'delete-all-projects-modal')).toContain('Delete all 2 Projects?')
    expect(text(mounted, 'confirm-modal-extra')).toBe(en.transfer.exportLibraryButton)
    await click(mounted, 'confirm-modal-extra')
    await vi.waitFor(() => expect(downloadFile).toHaveBeenCalledWith(expect.stringMatching(/\.openbeads$/), expect.any(Uint8Array), 'application/json'))
    expect(mounted.wrapper.find('[data-testid="delete-all-projects-modal"]').exists()).toBe(true)
    expect(names()).toEqual(['Moth', 'Other'])
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

  it('deletes a Project from the Projects library after the Delete question naming it, whose Save Project file saves that Project (tickets 232, 0842)', async () => {
    saveProjects([moth(), other()])
    const mounted = mountPanels()
    await openSavedProjects(mounted)
    await click(mounted, 'remove-project-other')

    expect(text(mounted, 'delete-project-modal')).toContain('Delete “Other”?')
    expect(mounted.wrapper.get('[data-testid="confirm-modal-confirm"]').classes().join(' ')).toContain('danger')
    await click(mounted, 'confirm-modal-extra')
    await vi.waitFor(() => expect(downloadFile).toHaveBeenCalledWith(projectFileNameOf('Other'), expect.any(Uint8Array), 'application/json'))
    expect(names()).toEqual(['Moth', 'Other'])

    await click(mounted, 'confirm-modal-confirm')
    expect(names()).toEqual(['Moth'])
  })

  it('opens a picked Project at once and puts the library away, asking nothing (tickets 232, 0860)', async () => {
    saveProjects([other(), moth()])
    const mounted = mountPanels()
    const open = mounted.panels.activeProject.value!
    const picked = open.id === 'other' ? moth() : other()
    await openSavedProjects(mounted)
    await click(mounted, `select-project-${picked.id}`)

    expect(mounted.wrapper.find('[data-testid="switch-project-modal"]').exists()).toBe(false)
    expect(mounted.wrapper.find('[data-testid="panel-body"]').exists()).toBe(false)
    expect(mounted.panels.activeProject.value!.id).toBe(picked.id)
  })

  it('asks first only when the open Project is not saved, offering Save first and Switch anyway (tickets 232, 0860)', async () => {
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

describe('Keep Projects (tickets 0839, 0936)', () => {
  const persist = vi.fn(async () => false)
  beforeEach(() => {
    persist.mockClear()
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => false, persist } })
  })
  afterEach(() => void delete (navigator as { storage?: unknown }).storage)

  it('wires Save Project file to the browser\'s ask, and the Menu row shows its no', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('project')
    await click(mounted, 'save-project-file')
    await vi.waitFor(() => expect(persist).toHaveBeenCalledOnce())

    await mounted.openPanel('menu')
    await flushPromises()
    expect(text(mounted, 'menu-keep-projects')).toContain(en.panels.menu.keepProjectsOff)
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

  it('says the Frame stays after the Canvas takes another Technique; its actions reach the Frame panel\'s change and open it on its settings (ticket 0935)', async () => {
    const mounted = mountPanels()
    await mounted.openPanel('project')
    await choose(mounted, 'canvas-technique', 'brick')
    const toast = () => mounted.canvas.toasts.value.find((each) => each.id === 'frame-stays')
    expect(toast()).toBeDefined()
    toast()!.action!.run()
    await flushPromises()
    expect(layerOf(loadProjects()[0]!, 'frame')).toMatchObject({ weave: { technique: 'brick' } })

    await choose(mounted, 'canvas-technique', 'peyote')
    toast()!.secondAction!.run()
    await flushPromises()
    expect(mounted.panels.framePanelShown.value).toBe(true)
    expect(mounted.wrapper.find('[data-panel-entry] [data-testid="frame-layer-settings"]').exists()).toBe(true)
  })

  it('removes the reference image after a confirmation, saved with no Undo step (ticket 0790)', async () => {
    saveProjects([withReferenceImage(moth(), newReferenceImage({ name: 'rose.webp', type: 'image/webp', width: 40, height: 20, bytes: 9 }, { x: 0, y: 0, width: 100, height: 100 }))])
    const mounted = mountPanels()
    await mounted.openPanel('project')
    await click(mounted, 'reference-image-remove')
    expect(mounted.wrapper.find('[data-testid="remove-reference-image-modal"]').exists()).toBe(true)
    await click(mounted, 'confirm-modal-confirm')
    await flushPromises()
    expect(loadProjects()[0]!.referenceImage).toBeUndefined()
    expect(mounted.canvas.canUndo.value).toBe(false)
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

  it('deletes the open Project after the same Delete question, and the other Project opens; Cancel keeps it (ticket 0842)', async () => {
    saveProjects([moth(), other()])
    const mounted = mountPanels()
    await mounted.openPanel('project')
    const open = text(mounted, 'project-name')
    await click(mounted, 'project-delete')
    expect(text(mounted, 'delete-project-modal')).toContain(`Delete “${open}”?`)
    await click(mounted, 'confirm-modal-cancel')
    expect(loadProjects()).toHaveLength(2)

    await mounted.openPanel('project')
    await click(mounted, 'project-delete')
    await click(mounted, 'confirm-modal-confirm')

    expect(loadProjects().map((project) => canvasOf(project).name)).toEqual([open === 'Moth' ? 'Other' : 'Moth'])
    expect(mounted.panels.activeProject.value?.id).toBe(loadProjects()[0]!.id)
  })

  it('gives focus to the Project button when a question its row asked is answered Cancel or Escape, starting on Cancel (ticket 0939)', async () => {
    const stripButton = document.createElement('button')
    stripButton.dataset.testid = 'strip-project'
    document.body.append(stripButton)
    const mounted = mountPanels()
    for (const [row, close] of [['project-delete', 'cancel'], ['project-clear', 'escape'], ['project-duplicate', 'escape']] as const) {
      await mounted.openPanel('project')
      const opener = mounted.wrapper.get(`[data-testid="${row}"]`)
      ;(opener.element as HTMLElement).focus()
      await click(mounted, row)
      if (row !== 'project-duplicate') expect(document.activeElement).toBe(mounted.wrapper.get('[data-testid="confirm-modal-cancel"]').element)
      if (close === 'cancel') await click(mounted, 'confirm-modal-cancel')
      else {
        document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await flushPromises()
      }
      expect(mounted.wrapper.find('.app-modal').exists()).toBe(false)
      expect(document.activeElement).toBe(stripButton)
    }
    stripButton.remove()
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

  it('resets progress from the line under the held size, after the Reset progress question (ticket 0848)', async () => {
    saveProjects([moveToRow(moth(), 2)])
    const mounted = mountPanels()
    await mounted.openPanel('frame')
    await click(mounted, 'frame-size-locked-reset')
    await click(mounted, 'confirm-modal-confirm')
    expect(rowProgressStarted(loadProjects()[0]!)).toBe(false)
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
    await click(mounted, 'background-color-stone')
    expect(backgroundOf(loadProjects()[0], 'canvas')).toBe(2)

    await mounted.openPanel('frame')
    await click(mounted, 'background-color-pebble')
    expect(backgroundOf(loadProjects()[0], 'frame')).toBe(3)
    expect(backgroundOf(loadProjects()[0], 'canvas')).toBe(2)
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
    expect([backgroundOf(star, 'canvas'), backgroundOf(star, 'frame')]).toEqual([2, 2])
  })
})

describe('The Export panel', () => {
  it('is not opened by the Project panel\'s Export row, which unfolds the rows in Project and saves nothing (ticket 1058)', async () => {
    vi.mocked(downloadFile).mockClear()
    const mounted = mountPanels()
    await mounted.openPanel('project')
    await click(mounted, 'project-export')
    await nextTick()

    expect(mounted.wrapper.find('[data-testid="project-panel"]').exists()).toBe(true)
    expect(mounted.wrapper.find('[data-testid="export-panel"]').exists()).toBe(false)
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('fits a frame from the Project panel\'s unfolded rows, which then show the exports with Project still open (ticket 1058)', async () => {
    const open = withFrameSheet(moth(), undefined)
    saveProjects([withLayers(open, { beads: withColors({}, [{ row: 2, column: 2, color: '#ff0000' }, { row: 4, column: 5, color: '#00ff00' }]) })])
    const mounted = mountPanels()
    await mounted.openPanel('project')
    await click(mounted, 'project-export')
    await click(mounted, 'export-fit')

    expect(frameOf(loadProjects()[0])).toBeDefined()
    expect(mounted.wrapper.find('[data-testid="project-panel"]').exists()).toBe(true)
    expect(mounted.wrapper.find('[data-testid="project-export-rows"] [data-testid="export-png"]').exists()).toBe(true)
  })

  it('opens on its first row, Picture, from its strip button (ticket 0939)', async () => {
    saveProjects([withLayers(moth(), { beads: withColors({}, [{ row: 2, column: 2, color: '#ff0000' }]) })])
    const mounted = mountPanels()
    await mounted.openPanel('export')
    await flushPromises()
    expect(document.activeElement).toBe(mounted.wrapper.get('[data-testid="export-png"]').element)
  })

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

describe('Account (ticket 0078)', () => {
  const ann = { email: 'ann@example.com', plan: 'free' } as const
  const mountOn = (account: ReturnType<typeof memoryAccount>) => mountShellPartsOn({ account }, AppPanels, AppDialogs)

  it('opens the Sign in Subpanel from the Menu’s Sign in, and Continue with Google starts the sign-in with the check’s token', async () => {
    const account = memoryAccount()
    const mounted = mountOn(account)
    await mounted.openPanel('menu')
    await click(mounted, 'menu-sign-in')
    expect(text(mounted, 'panel-sub-title')).toBe(en.account.signIn)
    expect(document.activeElement).toBe(mounted.wrapper.get('[data-testid="sign-in-google"]').element)
    await click(mounted, 'sign-in-google')
    expect(account.state.started).toEqual(['memory-token'])
    expect(text(mounted, 'sign-in-google')).toBe(en.account.openingGoogle)
  })

  it('opens nothing and shows the toast when the backend can’t be reached, the row still enabled', async () => {
    const mounted = mountOn(memoryAccount({ backend: { ok: false, reason: 'unavailable', retryAfterSeconds: 900 } }))
    await mounted.openPanel('menu')
    await click(mounted, 'menu-sign-in')
    expect(mounted.wrapper.find('[data-testid="sign-in-panel"]').exists()).toBe(false)
    expect(mounted.wrapper.get('[data-testid="menu-sign-in"]').attributes('aria-disabled')).toBeUndefined()
    expect(mounted.canvas.toasts.value.map((toast) => [toast.text, toast.tone])).toEqual([['Signing in is temporarily unavailable. Try again in 15 min.', 'warning']])
  })

  it('opens the Menu on its Account section back from Google signed in, with no toast, also when the section was folded and the library is empty', async () => {
    saveProjects([])
    localStorage.setItem('openbeads:panel-sections-closed', 'menu:account')
    const mounted = mountOn(memoryAccount({ returned: 'signed-in', session: ann }))
    await flushPromises()
    expect(mounted.panels.openPanel.value).toBe('menu')
    expect(text(mounted, 'menu-account-email')).toBe('ann@example.com')
    expect(mounted.wrapper.find('[data-testid="create-project"]').exists()).toBe(false)
    expect(mounted.canvas.toasts.value).toEqual([])
  })

  it('opens the Menu on the Sign in Subpanel back from Google refused, with the reason, and forgets it once the Subpanel is left', async () => {
    const mounted = mountOn(memoryAccount({ returned: 'paused' }))
    await flushPromises()
    expect(text(mounted, 'panel-sub-title')).toBe(en.account.signIn)
    expect(text(mounted, 'sign-in-refusal')).toBe(en.account.paused)
    await click(mounted, 'panel-back')
    await click(mounted, 'menu-sign-in')
    expect(mounted.wrapper.find('[data-testid="sign-in-refusal"]').exists()).toBe(false)
  })

  it('deletes the account from the Menu once “Delete your account?” is confirmed, and the Menu shows the Guest’s Sign in (ticket 0082)', async () => {
    const account = memoryAccount({ remembered: ann, session: ann })
    const mounted = mountOn(account)
    await mounted.openPanel('menu')
    await click(mounted, 'menu-delete-account')
    expect(text(mounted, 'delete-account-modal')).toContain(en.account.deleteTitle)
    await click(mounted, 'confirm-modal-cancel')
    expect(account.state.session).toEqual(ann)
    await mounted.openPanel('menu')
    await click(mounted, 'menu-delete-account')
    await click(mounted, 'confirm-modal-confirm')
    expect(account.state.session).toBeUndefined()
    await mounted.openPanel('menu')
    expect(mounted.wrapper.find('[data-testid="menu-sign-in"]').exists()).toBe(true)
  })

  it('links About to the privacy policy, in a new tab (ticket 0082)', async () => {
    const mounted = mountOn(memoryAccount())
    await mounted.openPanel('menu')
    const row = mounted.wrapper.get('[data-testid="menu-item-privacy"]')
    expect(row.attributes('href')).toBe('/privacy/')
    expect(row.attributes('target')).toBe('_blank')
  })

  it('signs out from the Menu, which then shows the Guest’s Sign in, and New Project still opens its own subpanel', async () => {
    const account = memoryAccount({ remembered: ann, session: ann })
    const mounted = mountOn(account)
    await mounted.openPanel('menu')
    await click(mounted, 'menu-sign-out')
    expect(account.state.session).toBeUndefined()
    expect(mounted.wrapper.find('[data-testid="menu-account"]').exists()).toBe(false)
    await click(mounted, 'menu-sign-in')
    await click(mounted, 'panel-back')
    await click(mounted, 'menu-new-project')
    expect(text(mounted, 'panel-sub-title')).toBe(en.projects.newProjectButton)
  })

  it('starts the Feedback sheet’s Email as the account’s, with its hint, until the address is changed', async () => {
    const mounted = mountOn(memoryAccount({ remembered: ann, session: ann }))
    await mounted.openPanel('menu')
    await click(mounted, 'menu-item-feedback')
    const email = mounted.wrapper.get('[data-testid="feedback-email"]')
    expect((email.element as HTMLInputElement).value).toBe('ann@example.com')
    expect(mounted.wrapper.text()).toContain(en.feedback.emailHintAccount)
    await email.setValue('')
    expect(mounted.wrapper.text()).not.toContain(en.feedback.emailHintAccount)
    expect(mounted.wrapper.text()).toContain(en.feedback.emailHint)
  })

  describe('the Settings kept in step (ticket 1086)', () => {
    const KEYS = ['openbeads:locale', 'openbeads:theme', 'openbeads:lifted-pieces']
    afterEach(() => {
      for (const key of KEYS) localStorage.removeItem(key)
      for (const name of ['lang', 'data-theme', 'style']) document.documentElement.removeAttribute(name)
    })

    it('takes the account’s language, theme and Lifted pieces as the app opens, the way the Menu and the strip set them', async () => {
      const at = Date.now() - 1000
      const settings = { language: { value: 'ru', changedAt: at }, theme: { value: 'dark', changedAt: at }, liftedPieces: { value: 'off', changedAt: at } } as const
      const account = memoryAccount({ remembered: ann, session: ann, settings })
      const mounted = mountOn(account)
      await flushPromises()
      expect(document.documentElement.lang).toBe('ru')
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(KEYS.map((key) => localStorage.getItem(key))).toEqual(['ru', 'dark', 'off'])
      await mounted.openPanel('menu')
      expect(document.documentElement.lang).toBe('ru')
      expect(mounted.wrapper.get('[data-testid="menu-lifted-pieces"]').attributes('aria-checked')).toBe('false')
      expect(account.state.sent).toEqual([])
      expect(mounted.canvas.toasts.value).toEqual([])
    })

    it('sends a signed-in person’s pick in the Menu and the strip at once', async () => {
      const at = Date.now() - 1000
      const settings = { language: { value: 'en', changedAt: at }, theme: { value: 'device', changedAt: at }, liftedPieces: { value: 'on', changedAt: at } } as const
      const account = memoryAccount({ remembered: ann, session: ann, settings })
      const mounted = mountShellPartsOn({ account }, AppPanels, AppDialogs, CanvasStrip)
      await flushPromises()
      await mounted.openPanel('menu')
      await choosePanelOption(mounted.wrapper, 'theme-picker', 'dark')
      await click(mounted, 'menu-lifted-pieces')
      await choosePanelOption(mounted.wrapper, 'language-switcher', 'pl')
      await flushPromises()
      expect(account.state.settings).toMatchObject({ language: { value: 'pl' }, theme: { value: 'dark' }, liftedPieces: { value: 'off' } })
      expect(account.state.waiting).toEqual({})
    })
  })
})
