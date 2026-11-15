import { afterEach, describe, expect, it } from 'vitest'
import { createProject } from '../../domain/createProject'
import { mountAt, type Mounted } from '../../testUtils/browserFit'
import ProjectsLibrary from './ProjectsLibrary.vue'

// A library row's long name wraps to two lines rather than being cut at one (ticket 0982): the audit's 85-character
// name, at the library's width on an iPad, where one line held about 60% of it. The thumbnail is drawn at 44px.
const name = 'Grandmother’s cornflower bracelet for the summer fair, second try with a wider rim v2'
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name, size: { width: 24, height: 14, unit: 'beads' } })

let mounted: Mounted | undefined
afterEach(() => mounted?.unmount())

describe('ProjectsLibrary rows (ticket 0982)', () => {
  it('shows an 85-character name whole, on two lines, beside a 44px thumbnail', async () => {
    mounted = await mountAt(ProjectsLibrary, { projects: [project] }, { locale: 'en', width: 440 })
    const shown = mounted.root.querySelector<HTMLElement>('.panel-list-row__name')!
    const lineHeight = parseFloat(getComputedStyle(shown).lineHeight)
    expect(Math.round(shown.getBoundingClientRect().height / lineHeight)).toBe(2)
    expect(shown.scrollHeight).toBeLessThanOrEqual(shown.clientHeight + 1)
    const thumbnail = mounted.root.querySelector('.project-thumbnail')!.getBoundingClientRect()
    expect([thumbnail.width, thumbnail.height]).toEqual([44, 44])
  })
})
