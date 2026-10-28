import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { en } from '../../i18n/en'
import SwitchTechniqueModal from './SwitchTechniqueModal.vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { BRICK_BLOCK_SETTING, NET_SIZE_SETTING } from '../../domain/weave'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const question = { technique: 'peyote' as const, lost: 4, drawn: true, settings: [] }
const netting = { ...question, technique: 'netting' as const, settings: [{ setting: NET_SIZE_SETTING, value: 3 }] }

describe('SwitchTechniqueModal', () => {
  it('says how many beads would be lost and that the picture may look different', () => {
    const wrapper = mount(SwitchTechniqueModal, { props: { question }, attachTo: document.body })
    const message = document.body.querySelector('[data-testid="confirm-modal-message"]')!.textContent
    expect(message).toContain('may look different')
    expect(message).toContain('removed: 4')
    expect(document.body.querySelector('[data-testid="switch-net-size"]')).toBeNull()
    wrapper.unmount()
  })

  it('asks for each setting of the Technique, the Net size for Netting, and emits the confirmation', async () => {
    const wrapper = mount(SwitchTechniqueModal, { props: { question: netting }, attachTo: document.body })
    expect(document.body.querySelector('[data-testid="switch-net-size"]')).not.toBeNull()
    ;(document.body.querySelector('[data-testid="switch-net-size-more"]') as HTMLElement).click()
    expect(wrapper.emitted('set-setting')).toEqual([['netSize', 5]])
    ;(document.body.querySelector('[data-testid="confirm-modal-confirm"]') as HTMLElement).click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
  })

  it('asks for the Brick block for brick stitch, and emits the one chosen', () => {
    const brick = { ...question, technique: 'brick' as const, drawn: false, settings: [{ setting: BRICK_BLOCK_SETTING, value: 1 }] }
    const wrapper = mount(SwitchTechniqueModal, { props: { question: brick }, attachTo: document.body })
    expect(document.body.querySelector('[data-testid="confirm-modal-message"]')!.textContent).toBe(en.frame.switchSettingsMessage)
    ;(document.body.querySelector('[data-testid="switch-brick-block-more"]') as HTMLElement).click()
    expect(wrapper.emitted('set-setting')).toEqual([['brickBlock', 2]])
    wrapper.unmount()
  })

  it('titles a change of a setting that can lose beads by its own words, and counts what it would remove', () => {
    const wrapper = mount(SwitchTechniqueModal, { props: { question: { ...netting, changing: NET_SIZE_SETTING } }, attachTo: document.body })
    const loss = en.weaveSettings.netSize!.loss!
    expect(document.body.textContent).toContain(loss.title)
    expect(document.body.querySelector('[data-testid="confirm-modal-message"]')!.textContent).toBe(fillBlanks(loss.message, { count: 4 }))
    expect(document.body.querySelector('[data-testid="confirm-modal-confirm"]')!.textContent).toContain(loss.button)
    wrapper.unmount()
  })
})
