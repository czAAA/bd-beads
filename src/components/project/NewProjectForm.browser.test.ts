import { describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import NewProjectForm from './NewProjectForm.vue'

// The form's three ways out are one size (ticket 0679): Convert image has a Tooltip, so AppButton wraps it, and the
// form's rules must still reach the button inside.
describe('NewProjectForm buttons', () => {
  it('draws Create Project, Convert image and Pick a starter at one width and height', async () => {
    const { root } = await mountAt(NewProjectForm, {}, { locale: 'en', width: 360 })
    const size = (testid: string) => {
      const box = root.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect()
      return { width: box.width, height: box.height }
    }
    const create = size('create-project')
    expect({ convert: size('convert-image'), starter: size('pick-starter') }).toEqual({ convert: create, starter: create })
  })
})
