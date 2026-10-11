import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../App.vue'
import { createProject } from '../domain/project'
import { saveProjects } from '../services/libraryStore'

/**
 * Saves a Loom Project of Toho Cube 1.5mm beads, sized in mm like the New Project form's
 * first fields, so a test can start from an existing Project without driving the form.
 * The form itself keeps its own flow test.
 */
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

/** Fills in and submits the New Project form: Toho Cube 1.5mm beads. The form states no size (ticket 342), so this makes an open canvas. */
export async function createProjectViaForm(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
  await wrapper.find('form').trigger('submit')
}
