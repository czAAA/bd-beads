import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../App.vue'
import { createProject } from '../domain/project'
import { saveProjects } from '../services/libraryStore'
import { openNewProject } from './pill'

/** Saves a Loom Project of Toho Cube 1.5mm beads, sized in mm like the New Project form, to start without driving
 * the form. */
export function seedProject(widthMm: number, heightMm: number) {
  const project = createProject({
    technique: 'loom',
    beadId: 'toho-cube-1.5mm',
    size: { width: widthMm, height: heightMm, unit: 'mm' },
  })
  saveProjects([project])
  return project
}

/** Mounts the App on a freshly seeded Project, as if it had been created and then the page reloaded. */
export async function mountWithProject(widthMm: number, heightMm: number, options: Parameters<typeof mount>[1] = {}) {
  seedProject(widthMm, heightMm)
  const wrapper = mount(App, options)
  await nextTick()
  return wrapper
}

/** Raises the New Project form if needed, then submits Toho Cube 1.5mm beads. The form states no size (ticket 342). */
export async function createProjectViaForm(wrapper: ReturnType<typeof mount>, name?: string) {
  await openNewProject(wrapper)
  const sheet = wrapper.get('[data-testid="panel-body"]')
  if (name !== undefined) {
    await sheet.get('[data-testid="name-input"]').setValue(name)
  }
  await sheet.get('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
  await sheet.get('form').trigger('submit')
  await nextTick()
}
