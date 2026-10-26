import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { en } from '../../i18n/en'
import SwitchTechniqueModal from './SwitchTechniqueModal.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const question = { technique: 'peyote' as const, lost: 4, drawn: true, keeps: false, asksNetSize: false, netSize: 3, asksBrickBlock: false, brickBlock: 1 }

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

  it('asks for the Brick block for brick stitch, and emits the one chosen', () => {
    const wrapper = mount(SwitchTechniqueModal, { props: { question: { ...question, technique: 'brick' as const, drawn: false, asksBrickBlock: true } }, attachTo: document.body })
    expect(document.body.querySelector('[data-testid="confirm-modal-message"]')!.textContent).toBe(en.frame.switchSettingsMessage)
    ;(document.body.querySelector('[data-testid="switch-brick-block-more"]') as HTMLElement).click()
    expect(wrapper.emitted('update:brick-block')).toEqual([[2]])
    wrapper.unmount()
  })

  it('titles a Net size change inside Netting for what it is and counts what it would remove', () => {
    const wrapper = mount(SwitchTechniqueModal, {
      props: { question: { ...question, technique: 'netting' as const, keeps: true, asksNetSize: true } },
      attachTo: document.body,
    })
    expect(document.body.textContent).toContain(en.frame.switchNetSizeTitle)
    expect(document.body.querySelector('[data-testid="confirm-modal-message"]')!.textContent).toBe(en.frame.switchNetSizeMessage.replace('{count}', '4'))
    wrapper.unmount()
  })
})
