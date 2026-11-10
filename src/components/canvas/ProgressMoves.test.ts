import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressMoves from './ProgressMoves.vue'
import ProgressBar from './ProgressBar.vue'
import StepBar from './StepBar.vue'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'

const pair = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.progress-moves .app-button').map((button) => button.classes())

describe('ProgressMoves (ticket 0788)', () => {
  it('is a quiet 32px back and a primary 32px forward, each with its arrow and label', async () => {
    const wrapper = mount(ProgressMoves, {
      props: {
        back: { label: 'Back', icon: 'arrow-up', testid: 'back' },
        forward: { label: 'Next', trailingIcon: 'arrow-down', testid: 'next' },
      },
    })
    const back = wrapper.get('[data-testid="back"]')
    const next = wrapper.get('[data-testid="next"]')
    expect(back.classes()).toEqual(expect.arrayContaining(['app-button--text', 'app-button--sm']))
    expect(next.classes()).toEqual(expect.arrayContaining(['app-button--primary', 'app-button--sm']))
    expect(back.text()).toBe('Back')
    expect(next.text()).toBe('Next')
    expect(back.find('svg').exists()).toBe(true)
    expect(next.find('svg').exists()).toBe(true)

    await back.trigger('click')
    await next.trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
    expect(wrapper.emitted('forward')).toHaveLength(1)
  })

  it('draws the forward button secondary where the page has another primary button (ticket 0830)', () => {
    const wrapper = mount(ProgressMoves, {
      props: { back: { label: 'Back', testid: 'back' }, forward: { label: 'Next', variant: 'secondary', testid: 'next' } },
    })
    const next = wrapper.get('[data-testid="next"]').classes()
    expect(next).toContain('app-button--secondary')
    expect(next).not.toContain('app-button--primary')
  })

  it('is the one pair in the editor bar and in a bar of steps, so the two look the same', () => {
    // A row in, so both of the editor's buttons are on, as both of the step bar's are on its middle step.
    const project = moveToRow(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 15, height: 30, unit: 'mm' } }), 1)
    const editor = mount(ProgressBar, { props: { project } })
    const steps = mount(StepBar, {
      props: {
        step: 1,
        steps: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }, { id: 'c', label: 'c' }],
        trackLabel: 'Steps',
        goTo: (label: string) => label,
        backLabel: 'Back',
        nextLabel: 'Next',
        firstBody: 'First',
        testid: 'steps',
      },
    })
    expect(pair(editor)).toEqual(pair(steps))
    expect(pair(editor)).toHaveLength(2)
  })
})
