import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { createProject } from '../domain/createProject'
import { projectNameOf } from '../domain/layerRecord'
import { MIRROR_OFF } from '../domain/mirror'
import { newReferenceImage } from '../domain/referenceImage'
import { useProjectLibrary } from '../composables/project/useProjectLibrary'
import { browserLibraryStore, loadProjects } from '../services/libraryStore'
import { paintAt } from '../testUtils/layers'
import { memoryPictureStore } from '../testUtils/pictureStore'
import { keepDemoCopy } from './demoCopy'

/** The demo's Ring as the tour leaves it: a bead drawn, its Mirror on and a reference image laid on it. */
function demoRing() {
  const ring = paintAt(createProject({ name: 'Ring', technique: 'peyote', beadId: 'miyuki/delica/11-0', size: { unit: 'beads', width: 7, height: 36 } }), [{ row: 2, column: 3 }], '#e63746')
  const referenceImage = newReferenceImage({ name: 'feather.webp', type: 'image/webp', width: 40, height: 20, bytes: 7 }, { x: 0, y: 0, width: 400, height: 200 })
  const mirror = { ...MIRROR_OFF, mode: 'repeat' as const, axes: { leftRight: true, topBottom: false, radial: false }, counts: { leftRight: 3, topBottom: 1 }, place: { layer: 'frame' as const } }
  return { ...ring, mirror, referenceImage }
}

function library() {
  return effectScope().run(() => useProjectLibrary(browserLibraryStore))!
}

beforeEach(() => localStorage.clear())

describe("What's inside's Open editor from here keeps a copy of the demo's Project (ticket 0879)", () => {
  it("saves it as the beader's first Project, under a new id, with its layers, Mirror and the reference image's picture", async () => {
    const ring = demoRing()
    const pictures = memoryPictureStore()
    const picture = new Blob(['picture'], { type: 'image/webp' })

    const id = await keepDemoCopy({ project: ring, picture }, { library: library(), pictures })

    const [kept] = loadProjects()
    expect(loadProjects()).toHaveLength(1)
    expect(kept!.id).toBe(id)
    expect(id).not.toBe(ring.id)
    expect(projectNameOf(kept!)).toBe('Ring')
    expect(kept!.layers).toEqual(ring.layers)
    expect(kept!.palette).toEqual(ring.palette)
    expect(kept!.mirror).toEqual(ring.mirror)
    expect(kept!.referenceImage).toEqual(ring.referenceImage)
    expect(pictures.kept.get(id)).toBe(picture)
    expect(pictures.kept.has(ring.id)).toBe(false)
  })

  it('gives it a free name beside the Projects the beader has, and leaves theirs as they are', async () => {
    const own = library()
    own.addProject(createProject({ name: 'Ring', technique: 'loom', beadId: 'miyuki/delica/11-0' }))
    const before = loadProjects()

    const id = await keepDemoCopy({ project: demoRing() }, { library: own, pictures: memoryPictureStore() })

    const after = loadProjects()
    expect(after).toHaveLength(2)
    expect(projectNameOf(after.find((project) => project.id === id)!)).toBe('Ring 2')
    expect(after.find((project) => project.id === before[0]!.id)).toEqual(before[0])
  })

  it('keeps no picture for a Project without one', async () => {
    const { referenceImage: _none, ...plain } = demoRing()
    const pictures = memoryPictureStore()
    await keepDemoCopy({ project: plain, picture: new Blob(['stale']) }, { library: library(), pictures })
    expect(pictures.kept.size).toBe(0)
  })
})
