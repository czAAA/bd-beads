import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import ProjectsLibrary from './ProjectsLibrary.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import { createProject } from '../../domain/createProject'
import { summarizeProject } from '../../domain/projectLibrary'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { withLayers } from '../../testUtils/layerFields'
import { countingBeads } from '../../testUtils/countingBeads'
import { PIECE_WALK_LIMIT } from '../../domain/openingLimits'
import type { SealedProject } from '../../domain/sealedProject'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const make = (name: string, extra: Partial<Parameters<typeof createProject>[0]> = {}) =>
  createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name, size: { width: 4, height: 4, unit: 'beads' }, ...extra })
const first = make('Moth', { makerName: 'Ada' })
const second = make('Fern')
const noFrame = (project: Project): Project => (withLayers(project, { frame: undefined }))

function mountLibrary(props: Record<string, unknown> = {}) {
  return mount(ProjectsLibrary, { props: { projects: [first, second], ...props }, global: { stubs: { ProjectThumbnail: true } } })
}

describe('ProjectsLibrary (ticket 0553)', () => {
  it('lists each project with its name, maker and Pieces count, newest first', () => {
    const rows = mountLibrary().findAll('[data-testid="project-item"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Moth')
    expect(rows[0]!.text()).toContain('Ada')
    expect(rows[0]!.get('[data-testid="project-pieces"]').text()).toBe('0')
    expect(rows[1]!.text()).not.toContain('Ada')
  })

  it('marks the framed projects and rings the open one', () => {
    const wrapper = mountLibrary({ projects: [first, noFrame(second)], activeProjectId: first.id })
    const rows = wrapper.findAll('[data-testid="project-item"]')
    expect(rows[0]!.find('[data-testid="project-framed"]').exists()).toBe(true)
    expect(rows[1]!.find('[data-testid="project-framed"]').exists()).toBe(false)
    expect(rows[0]!.get('.panel-list-row').classes()).toContain('panel-list-row--active')
    expect(rows[1]!.get('.panel-list-row').classes()).not.toContain('panel-list-row--active')
  })

  it('opens a project on a press and asks to remove it from its ×', async () => {
    const wrapper = mountLibrary()
    const button = wrapper.get(`[data-testid="select-project-${first.id}"]`)
    expect(button.attributes('aria-label')).toBe(summarizeProject(first))
    await button.trigger('click')
    await wrapper.get(`[data-testid="remove-project-${first.id}"]`).trigger('click')
    expect(wrapper.emitted('select')).toEqual([[first.id]])
    expect(wrapper.emitted('remove')).toEqual([[first.id]])
  })

  it('exports all and takes an import, each naming .openbeads', async () => {
    const wrapper = mountLibrary()
    expect(wrapper.get('[data-testid="menu-import"]').text()).toContain('.openbeads')
    await wrapper.get('[data-testid="menu-export-all"]').trigger('click')
    expect(wrapper.get('[data-testid="menu-export-all"]').text()).toContain('.openbeads')
    expect(wrapper.emitted('exportAll')).toHaveLength(1)
  })

  it('says there are none yet, and cannot export', () => {
    const wrapper = mountLibrary({ projects: [] })
    expect(wrapper.get('[data-testid="project-list-empty"]').text()).toContain(en.projects.emptyTitle)
    expect(wrapper.get('[data-testid="project-list-empty"]').text()).toContain('.openbeads')
    expect(wrapper.get('[data-testid="menu-export-all"]').attributes('aria-disabled')).toBe('true')
  })
})

describe('ProjectsLibrary with a huge Project (ticket 0716)', () => {
  // The idle walks share one queue across tests: each test runs on fake timers and leaves none waiting.
  beforeEach(() => void vi.useFakeTimers())
  afterEach(async () => {
    await vi.runAllTimersAsync()
    vi.useRealTimers()
  })

  /** Mounted from a host, so the mount itself reads nothing of the Projects it is handed. */
  function mountHosted(props: Record<string, unknown>) {
    return mount(defineComponent({ setup: () => () => h(ProjectsLibrary, props as never) }), { global: { stubs: { ProjectThumbnail: true } } })
  }

  /** `rows` solid rows of 1 000 beads on the Canvas, behind a counter of what is read. */
  function huge(rows: number, name = 'Huge') {
    const solid = Object.fromEntries(Array.from({ length: rows }, (_row, row) => [row, Object.fromEntries(Array.from({ length: 1000 }, (_cell, column) => [column, '#1a1a1a']))]))
    const counted = countingBeads(solid)
    return { project: withLayers(make(name), { beads: counted.beads }), reads: counted.reads }
  }

  it('walks no Piece on mount for a layer over 250 000 beads: the count waits for idle time behind a placeholder', () => {
    // Seeing it is over the walk limit and under the size gate lists the layer's beads at most twice; a walk reads
    // each bead and its eight neighbours.
    const { project, reads } = huge(260)
    reads.beads = 0

    const row = mountHosted({ projects: [project] }).get('[data-testid="project-item"]')

    expect(row.get('[data-testid="project-pieces"]').text()).toBe('…')
    expect(reads.beads).toBeLessThanOrEqual(PIECE_WALK_LIMIT + 1000 + 260_000)
  })

  it('shows the count once the idle walk is in', async () => {
    const { project } = huge(260)
    const wrapper = mountHosted({ projects: [project] })
    await vi.runAllTimersAsync()
    await nextTick()
    expect(wrapper.get('[data-testid="project-pieces"]').text()).toBe('1')
  })

  it('lists a sealed Project by its name, dates and bead count, with no thumbnail and no Piece count, among the rest by last save', async () => {
    const sealed: SealedProject = { id: 'big', name: 'Black fill', createdAt: Date.UTC(2026, 9, 1, 12), updatedAt: Date.UTC(2026, 9, 30, 12), savedAt: Date.UTC(2026, 9, 30, 12), layerBeads: [31_771_024, 440], beads: 31_771_464, stored: '{}' }
    const older = { ...first, savedAt: 1 }

    const wrapper = mountLibrary({ projects: [older], sealed: [sealed] })
    const [row] = wrapper.findAll('[data-testid="project-item"]')

    expect(row!.text()).toContain('Black fill')
    expect(row!.text()).toContain('31\u00a0771\u00a0464 beads')
    expect(row!.get('[data-testid="project-saved-on"]').text()).toBe('Oct 30')
    expect((row!.getComponent(AppTooltip).props() as { name: string }).name).toBe('made Oct 1, 2026 · saved Oct 30, 2026')
    expect(row!.find('[data-testid="project-pieces"]').exists()).toBe(false)
    expect(row!.find('[data-testid="project-sealed"]').exists()).toBe(true)
    await row!.get('[data-testid="select-project-big"]').trigger('click')
    await row!.get('[data-testid="remove-project-big"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['big']])
    expect(wrapper.emitted('remove')).toEqual([['big']])
  })
})
