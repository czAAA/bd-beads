import { starterProject, type Starter, type StarterChoice } from '../../domain/starters'
import { createProject, type CreateProjectInput } from '../../domain/createProject'
import type { Project } from '../../domain/project'

/** What creating a Project needs from the app shell: the library's add. */
export interface NewProjectFlowDeps {
  addProject: (project: Project) => void
}

/** New-Project creation, blank or from a Starter (tickets 196, 0596; ADR 0020); Convert image is its own flow
 * (useConvertImageFlow). */
export function useNewProjectFlow(deps: NewProjectFlowDeps) {
  function onCreateProject(payload: CreateProjectInput) {
    deps.addProject(createProject(payload))
  }

  /** Create Project in a Starter's setup (ticket 0596): a new Project with the Starter's Frame, its design or empty. */
  function onCreateFromStarter(starter: Starter, choice: StarterChoice & { name: string; beadId: string }) {
    deps.addProject(starterProject(starter, choice))
  }

  return { onCreateProject, onCreateFromStarter }
}
