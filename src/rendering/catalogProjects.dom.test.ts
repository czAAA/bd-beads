import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, beadCopy, gramsPerBead } from '../domain/beads'
import { createProject } from '../domain/createProject'
import { replaceBead } from '../domain/projectBead'
import { parseProjectsFile, serializeProject } from '../domain/projectFile'
import { recordingContext } from '../testUtils/recordingContext'
import { renderProject } from './projectRenderer'
import { spaceOf } from './space'

// Ticket 539: the catalog is data, so one pass over all of it stands in for a test per Bead.
describe('every Bead in the catalog', () => {
  it('makes a Project that is drawn, saved and read back, and replaced to and from every other Bead', () => {
    for (const bead of BEAD_CATALOG) {
      const project = createProject({ technique: 'loom', beadId: bead.id, size: { width: 6, height: 4, unit: 'beads' } })
      expect(project.frame!.columns).toBeGreaterThan(0)
      const painted = { ...project, frame: { ...project.frame!, beads: { 0: { 0: '#ff0000' } } } }

      const { context, calls } = recordingContext()
      const region = { x: 0, y: 0, width: 200, height: 200 }
      renderProject(context, { project: painted, space: spaceOf(painted, false), region, zoom: 1, showFinished: false, rowMarks: false })
      expect(calls.length).toBeGreaterThan(0)

      const [reopened] = parseProjectsFile(serializeProject(painted)).projects
      expect(reopened!.beadId).toBe(bead.id)
      expect(reopened!.bead).toEqual(beadCopy(bead))
      expect(gramsPerBead(bead) !== undefined).toBe(bead.beadsPerKg !== undefined)

      for (const other of BEAD_CATALOG) expect(replaceBead(painted, other).beadId).toBe(other.id)
    }
  })
})
