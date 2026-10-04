import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, frameGrid, type CreateProjectInput, type Project } from '../../domain/project'
import { TOUR_STEPS, afterStep, gridsEqual } from '../../domain/tour'
import { en } from '../../i18n/en'
import type { TourProgress, TourStatus, TourStore } from '../../services/tourStore'
import { useTour } from './useTour'

vi.mock('../../features', () => ({ TOUR_ENABLED: true }))

function setup(initial: { status?: TourStatus; progress?: TourProgress; projects?: Project[]; open?: Project } = {}) {
  const saved = { status: initial.status ?? 'running', progress: initial.progress ?? { done: [] } }
  const store: TourStore = {
    loadStatus: () => saved.status,
    saveStatus: (status) => void (saved.status = status),
    loadProgress: () => saved.progress,
    saveProgress: (progress) => void (saved.progress = progress),
  }
  const library = ref<Project[]>(initial.projects ?? (initial.open ? [initial.open] : []))
  const openId = ref<string | undefined>(initial.open?.id)
  const current = () => library.value.find((project) => project.id === openId.value)
  const replace = (project: Project) => void (library.value = library.value.map((entry) => (entry.id === project.id ? project : entry)))
  const tool = ref<'paint' | 'fill' | 'select' | 'erase'>('paint')
  const showToast = vi.fn()
  const undo = vi.fn()
  const tour = useTour({
    store,
    currentProject: current,
    hasProject: (id) => library.value.some((project) => project.id === id),
    openProject: (id) => void (openId.value = id),
    openNewProjectForm: () => void (openId.value = undefined),
    activeTool: () => tool.value,
    selectedColorId: () => undefined,
    selection: () => undefined,
    pasteArmed: () => false,
    commitGridChange: (_project, updated) => replace(updated),
    replaceProject: replace,
    undo,
    clearSelection: () => undefined,
    draftName: () => 'Rushnik',
    createProject: (input: CreateProjectInput) => {
      const project = createProject(input)
      library.value = [...library.value, project]
      openId.value = project.id
    },
    showToast,
    messages: () => en,
  })
  return { tour, saved, library, openId, showToast, undo, current }
}

const tourProject = () =>
  createProject({ technique: 'loom', beadId: BEAD_CATALOG[0]!.id, size: { width: 10, height: 75, unit: 'beads' }, name: 'Rushnik' })

describe('useTour', () => {
  it('starts at step 1 and sets an open Project aside for the New Project form', () => {
    const { tour, openId } = setup({ open: tourProject() })
    expect(tour.step.value).toBe('create')
    expect(openId.value).toBeUndefined()
  })

  it('does nothing on a device that has not started it', () => {
    const { tour } = setup({ status: 'untouched' })
    expect(tour.active.value).toBe(false)
  })

  it('makes every Project created in step 1 the Tour Project, keeping the Name', () => {
    const { tour } = setup()
    const input = { name: 'Mine', technique: 'peyote', beadId: BEAD_CATALOG[1]!.id, size: { width: 30, height: 30, unit: 'beads' } } as const
    expect(tour.normalizeCreate(input)).toMatchObject({ name: 'Mine', technique: 'loom', beadId: BEAD_CATALOG[0]!.id, size: { width: 10, height: 75, unit: 'beads' } })
  })

  it('moves on from Create once a Project exists, and remembers it', async () => {
    const { tour, saved, current } = setup()
    tour.next()
    await nextTick()
    expect(current()?.name).toBe('Rushnik')
    expect(tour.step.value).toBe('fill')
    expect(saved.progress).toEqual({ done: ['create'], projectId: current()!.id })
  })

  it('Next does the step, as one change that leaves the Project whole', async () => {
    const { tour, current } = setup()
    tour.next()
    await nextTick()
    tour.next()
    await nextTick()
    expect(gridsEqual(frameGrid(current()!), afterStep(2))).toBe(true)
    expect(tour.step.value).toBe('outline')
  })

  it('carries through to the last card, finished', async () => {
    const { tour, saved, current } = setup()
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      tour.next()
      await nextTick()
    }
    expect(saved.status).toBe('finished')
    expect(tour.finalCard.value).toBe(true)
    expect(gridsEqual(frameGrid(current()!), afterStep(8))).toBe(true)
    expect(current()!.rowProgress).toMatchObject({ enabled: true, currentRow: 2 })
    tour.keepEditing()
    expect(tour.active.value).toBe(false)
  })

  it('Skip turns it off for good and says it can be started again', () => {
    const { tour, saved, showToast } = setup()
    tour.skip()
    expect(saved.status).toBe('off')
    expect(tour.active.value).toBe(false)
    expect(showToast).toHaveBeenCalledWith('tour-off', en.tour.skipToast, 'info')
  })

  it('starts again from step 1 at any time', () => {
    const project = tourProject()
    const { tour, saved, openId } = setup({ status: 'finished', progress: { done: [...TOUR_STEPS], projectId: project.id }, open: project })
    expect(tour.active.value).toBe(false)
    tour.start()
    expect(saved.status).toBe('running')
    expect(saved.progress).toEqual({ done: [] })
    expect(tour.step.value).toBe('create')
    expect(openId.value).toBeUndefined()
  })

  it('resumes at the first step not done, in the Tour Project', async () => {
    const project = tourProject()
    const other = createProject({ technique: 'loom', beadId: BEAD_CATALOG[0]!.id, size: { width: 5, height: 5, unit: 'beads' } })
    const { tour, openId } = setup({ progress: { done: ['create', 'fill'], projectId: project.id }, projects: [other, project], open: other })
    await nextTick()
    expect(tour.step.value).toBe('outline')
    expect(openId.value).toBe(project.id)
  })

  it('starts over when the Project it was building is gone', async () => {
    const { tour, saved } = setup({ progress: { done: ['create', 'fill'], projectId: 'gone' }, projects: [] })
    await nextTick()
    expect(saved.progress).toEqual({ done: [] })
    expect(tour.step.value).toBe('create')
  })

  it('lets the Project be drawn on only while the step is about drawing', async () => {
    const { tour } = setup()
    tour.next()
    await nextTick()
    expect(tour.canvasLocked.value).toBe(true)
  })
})
