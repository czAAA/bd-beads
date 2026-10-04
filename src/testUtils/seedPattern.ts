import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../App.vue'
import { createPattern } from '../domain/pattern'
import { savePatterns } from '../services/libraryStore'

/**
 * Saves a Loom Pattern of Toho Cube 1.5mm beads, sized in mm like the New Pattern form's
 * first fields, so a test can start from an existing Pattern without driving the form.
 * The form itself keeps its own flow test.
 */
export function seedPattern(widthMm: number, heightMm: number) {
  const pattern = createPattern({
    technique: 'loom',
    beadId: 'toho-cube-1.5mm',
    size: { width: widthMm, height: heightMm, unit: 'mm' },
  })
  savePatterns([pattern])
  return pattern
}

/** Mounts the App on a freshly seeded Pattern, as if it had been created and then the page reloaded. */
export async function mountWithPattern(widthMm: number, heightMm: number, options: Parameters<typeof mount>[1] = {}) {
  seedPattern(widthMm, heightMm)
  const wrapper = mount(App, options)
  await nextTick()
  return wrapper
}

/** Fills in and submits the New Pattern form: Toho Cube 1.5mm beads, sized in mm. */
export async function createPatternViaForm(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
  await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
  await wrapper.find('form').trigger('submit')
}
