import type { ProjectLibrary } from '../composables/project/useProjectLibrary'
import { projectNameOf } from '../domain/layerRecord'
import type { OpeningView } from '../domain/openingAddress'
import type { Project } from '../domain/project'
import { duplicateProject } from '../domain/projectName'
import type { PictureStore } from '../services/pictureStore'

// What's inside's Open editor from here (Homepage card, ticket 0879): the Project on the demo's Canvas becomes the
// beader's own, a copy in their library, and the editor opens on it as the demo showed it.

/** What Open editor from here takes from the demo at the press: the Project on its Canvas, its reference image's
 * picture (kept beside the demo's library, not in the Project), and the view the editor opens at. */
export interface DemoSnapshot {
  project: Project
  picture?: Blob
  view?: OpeningView
}

/** Where the copy is kept: the beader's library and the pictures beside it. */
export interface DemoCopyDeps {
  library: Pick<ProjectLibrary, 'addProjects'>
  pictures: PictureStore
}

/** Keeps a copy of the demo's Project in the beader's library under a new id, named after it (made free beside theirs,
 * as an import's is), its picture beside it; gives the copy's id. */
export async function keepDemoCopy(snapshot: Pick<DemoSnapshot, 'project' | 'picture'>, deps: DemoCopyDeps): Promise<string> {
  const { project, picture } = snapshot
  const [copy] = deps.library.addProjects([duplicateProject(project, projectNameOf(project))])
  if (picture && copy!.referenceImage) await deps.pictures.put(copy!.id, picture)
  return copy!.id
}
