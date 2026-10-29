import { starterProject, type Starter, type StarterProjectChoice } from '../../domain/starters'
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

  /** Create Project in a Starter's setup (tickets 0596, 0671): a new Project with the Starter's Frame, its design or
   * empty, in the setup's Layer settings, which the Canvas copies. */
  function onCreateFromStarter(starter: Starter, choice: StarterProjectChoice) {
    deps.addProject(starterProject(starter, choice))
  }

  return { onCreateProject, onCreateFromStarter }
}
