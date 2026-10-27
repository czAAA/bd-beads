import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StarterSetup from './StarterSetup.vue'
import { createProject, type Project } from '../../domain/project'
import { starterById, type StarterId } from '../../domain/starters'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const mountSetup = (id: StarterId, project?: Project) => mount(StarterSetup, { props: { starter: starterById(id), ...(project ? { project } : {}) }, attachTo: document.body })
type Setup = ReturnType<typeof mountSetup>
const text = (wrapper: Setup, testId: string) => wrapper.get(`[data-testid="${testId}"]`).text()
const design = (wrapper: Setup) => wrapper.get('[data-testid="starter-design"] [aria-checked="true"]').text()

describe('the Starter setup', () => {
  it('opens on the design at its own size: the picture named for it, Name, Bead, the size and its Estimated size', () => {
    const wrapper = mountSetup('triangle')
    expect(wrapper.get('[data-testid="starter-setup-picture"]').attributes()).toMatchObject({ role: 'img', 'aria-label': 'Triangle, with design' })
    expect(wrapper.get('[data-testid="starter-name-input"]').attributes('placeholder')).toBe('Triangle')
    expect(wrapper.find('[data-testid="starter-bead-picker"]').exists()).toBe(true)
    expect(design(wrapper)).toBe(en.starters.useDesign)
    expect(text(wrapper, 'starter-size-value')).toBe('10')
    expect(text(wrapper, 'starter-size-label')).toContain('Rounds')
    expect(text(wrapper, 'starter-size-label')).toContain('from the centre')
    expect(wrapper.get('[data-testid="starter-size-preset-10"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="starter-size-preset-10"]').text()).toContain(en.starters.designSize)
    expect(wrapper.find('[data-testid="starter-size-preset-8"]').text()).not.toContain(en.starters.designSize)
    expect(text(wrapper, 'starter-estimate')).toMatch(/cm|mm/)
    expect(text(wrapper, 'starter-count')).toBe('165 beads')
    expect(wrapper.find('[data-testid="starter-design-note"]').exists()).toBe(false)
  })

  it('turns Use design off when the size changes, naming the design\'s size, and on again when it is set back', async () => {
    const wrapper = mountSetup('triangle')
    await wrapper.get('[data-testid="starter-size-preset-12"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.startEmpty)
    expect(text(wrapper, 'starter-design-note')).toBe('The design is made for 10 rounds. Set it back to turn the design on.')
    expect(wrapper.get('[data-testid="starter-setup-picture"]').attributes('aria-label')).toBe('Triangle, empty shape with seams')
    expect(text(wrapper, 'starter-count')).toBe('234 beads')
    await wrapper.get('[data-testid="starter-size-decrease"]').trigger('click')
    await wrapper.get('[data-testid="starter-size-decrease"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.useDesign)
    expect(wrapper.find('[data-testid="starter-design-note"]').exists()).toBe(false)
  })

  it('keeps Start empty when chosen, saying what it leaves, and puts back the design\'s size on Use design', async () => {
    const wrapper = mountSetup('star')
    await wrapper.get('[data-testid="starter-design"] [role="radio"]:last-child').trigger('click')
    expect(text(wrapper, 'starter-design-note')).toBe(en.starters.emptyNote)
    await wrapper.get('[data-testid="starter-size-preset-7"]').trigger('click')
    expect(text(wrapper, 'starter-design-note')).toBe(en.starters.emptyNote)
    await wrapper.get('[data-testid="starter-size-preset-5"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.startEmpty)
    await wrapper.get('[data-testid="starter-size-preset-9"]').trigger('click')
    await wrapper.get('[data-testid="starter-design"] [role="radio"]:first-child').trigger('click')
    expect(text(wrapper, 'starter-size-value')).toBe('5')
    expect(design(wrapper)).toBe(en.starters.useDesign)
  })

  it('asks for the Starter, its size and design, the name typed or else the Starter\'s, and the Bead chosen', async () => {
    const wrapper = mountSetup('kite')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('[data-testid="starter-name-input"]').setValue('  Wings ')
    await wrapper.get('[data-testid="starter-size-increase"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([
      [{ size: 21, useDesign: true, name: 'Kite', beadId: expect.any(String) }],
      [{ size: 22, useDesign: false, name: 'Wings', beadId: expect.any(String) }],
    ])
  })

  it('on an open Project asks no Name or Bead, and measures with the Project\'s own Bead', () => {
    const project = createProject({ technique: 'loom', beadId: 'miyuki/delica/11-0', name: 'Open' })
    const wrapper = mountSetup('warpedSquare', project)
    expect(wrapper.find('[data-testid="starter-name-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="starter-bead-picker"]').exists()).toBe(false)
    expect(text(wrapper, 'starter-estimate')).toMatch(/cm|mm/)
    expect(text(wrapper, 'starter-count')).toBe('144 beads')
  })
})
