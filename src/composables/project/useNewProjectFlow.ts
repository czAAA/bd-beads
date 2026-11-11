import { starterProject, type Starter, type StarterProjectChoice } from '../../domain/starters'
import { NEW_PROJECT_DEFAULTS, createProject, type CreateProjectInput } from '../../domain/createProject'
import { fillBlanks } from '../../domain/fillBlanks'
import type { Project } from '../../domain/project'
import { freeName } from '../../domain/projectName'
import type { Translations } from '../../i18n/translations'

/** What creating a Project needs from the app shell: the library's add, the names it holds, and the words. */
export interface NewProjectFlowDeps {
  addProject: (project: Project) => void
  /** Every name the library holds, sealed Projects' too, so an unnamed Project takes a number none of them has. */
  projectNames: () => readonly string[]
  messages: () => Translations
}

/** New-Project creation, blank or from a Starter (tickets 196, 0596; ADR 0020); Convert image is its own flow
 * (useConvertImageFlow). */
export function useNewProjectFlow(deps: NewProjectFlowDeps) {
  /** What a Project left unnamed is called (ticket 0866): "Project 1", then the next free number; the form's placeholder. */
  function unnamedName(): string {
    return freeName(fillBlanks(deps.messages().form.unnamedProject, { number: 1 }), deps.projectNames())
  }

  function onCreateProject(payload: CreateProjectInput) {
    deps.addProject(createProject({ ...payload, name: payload.name?.trim() || unnamedName() }))
  }

  /** The first Project (ticket 0866): Create Project on the form's presets, made without showing the form. */
  function onCreateFirstProject() {
    onCreateProject(NEW_PROJECT_DEFAULTS)
  }

  /** Create Project in a Starter's setup (tickets 0596, 0671): a new Project with the Starter's Frame, its design or
   * empty, in the setup's Layer settings, which the Canvas copies. */
  function onCreateFromStarter(starter: Starter, choice: StarterProjectChoice) {
    deps.addProject(starterProject(starter, choice))
  }

  return { onCreateProject, onCreateFirstProject, onCreateFromStarter, unnamedName }
}
