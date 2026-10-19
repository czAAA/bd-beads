import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SwitchTechniqueModal from './SwitchTechniqueModal.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const question = { technique: 'peyote' as const, lost: 4, drawn: true, asksNetSize: false, netSize: 3 }

describe('SwitchTechniqueModal', () => {
  it('says how many beads would be lost and that the picture may look different', () => {
    const wrapper = mount(SwitchTechniqueModal, { props: { question }, attachTo: document.body })
    const message = document.body.querySelector('[data-testid="confirm-modal-message"]')!.textContent
    expect(message).toContain('may look different')
    expect(message).toContain('removed: 4')
    expect(document.body.querySelector('[data-testid="switch-net-size"]')).toBeNull()
    wrapper.unmount()
  })

  it('asks for the Net size for Netting, and emits the confirmation', async () => {
    const wrapper = mount(SwitchTechniqueModal, { props: { question: { ...question, technique: 'netting' as const, asksNetSize: true } }, attachTo: document.body })
    expect(document.body.querySelector('[data-testid="switch-net-size"]')).not.toBeNull()
    ;(document.body.querySelector('[data-testid="switch-net-size-more"]') as HTMLElement).click()
    expect(wrapper.emitted('update:net-size')).toEqual([[5]])
    ;(document.body.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLElement).click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
  })
})
