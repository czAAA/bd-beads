import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, effectScope, h } from 'vue'
import ConvertImageWizard from './ConvertImageWizard.vue'
import { useConvertImageWizard, type ConvertImageWizard as Wizard } from '../../composables/import/useConvertImageWizard'
import type { PixelData } from '../../domain/imageConversion'
import { photoPicture, pixelArtPicture } from '../../testUtils/samplerPictures'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))
afterEach(() => {
  document.body.innerHTML = ''
})

const Page = defineComponent({
  props: { wizard: { type: Object as () => Wizard, required: true } },
  setup: (props) => () => h(ConvertImageWizard, { wizard: props.wizard, readClipboardImage: async () => undefined }),
})

/** The page with a picture opened, matched Exact (no catalog to wait for). */
async function opened(picture: PixelData) {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture,
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  await wizard.setFile(new File(['x'], 'picture.png', { type: 'image/png' }))
  wizard.setSource('exact')
  const wrapper = mount(Page, { props: { wizard }, attachTo: document.body })
  await flushPromises()
  return { wrapper, wizard }
}

describe('Clean up on the converter page (ticket 0906, DS-3)', () => {
  it('says what it cleaned on its button under Colors, named by those words and then Clean up (ticket 0940)', async () => {
    const { wrapper, wizard } = await opened(photoPicture())
    const button = wrapper.get('[data-testid="convert-clean-up-button"]')
    const cleaned = wizard.cleanUp.cleaned.value
    expect(button.get('[data-testid="convert-clean-up-first"]').text()).toBe(`${cleaned} stray beads cleaned`)
    expect(button.attributes('aria-label')).toBeUndefined()
    expect(button.text().replace(/\s+/g, ' ')).toBe(`${cleaned} stray beads cleaned ${button.get('[data-testid="convert-clean-up-second"]').text()} Clean up`)
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('opens its popover in one press: the switch off brings the speckles back, and the steps say why they are off', async () => {
    const { wrapper, wizard } = await opened(photoPicture())
    await wrapper.get('[data-testid="convert-clean-up-button"]').trigger('click')
    const popover = wrapper.get('[data-testid="convert-clean-up-popover"]')
    expect(wrapper.get('[data-testid="convert-clean-up-button"]').attributes('aria-expanded')).toBe('true')
    expect(popover.get('[data-testid="convert-clean-up-strength"] [aria-checked="true"]').text()).toBe('Medium')

    await popover.get('[data-value="strong"]').trigger('click')
    expect(wizard.cleanUp.strength.value).toBe('strong')

    await popover.get('[data-testid="convert-clean-up-switch"]').trigger('click')
    const lone = wizard.cleanUp.lone.value
    expect(popover.get('[data-testid="convert-clean-up-count"]').text()).toBe(`${lone} stray beads left`)
    expect(wrapper.get('[data-testid="convert-clean-up-first"]').text()).toBe('Off')
    expect(wrapper.get('[data-testid="convert-clean-up-second"]').text()).toBe(`${lone} stray beads left`)
    expect(popover.get('[data-value="light"]').attributes('aria-disabled')).toBe('true')
    await popover.get('[data-value="light"]').trigger('click')
    expect(wizard.cleanUp.strength.value).toBe('strong')
  })

  it('steps Small colors join, its lowest step showing "off"', async () => {
    const { wrapper, wizard } = await opened(photoPicture())
    await wrapper.get('[data-testid="convert-clean-up-button"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-small-colors-value"]').text()).toBe('10')
    await wrapper.get('[data-testid="convert-small-colors-fewer"]').trigger('click', { shiftKey: true })
    expect(wizard.cleanUp.leastBeads.value).toBe(1)
    expect(wrapper.get('[data-testid="convert-small-colors-value"]').text()).toBe('off')
    expect(wrapper.get('[data-testid="convert-small-colors-joined"]').text()).toBe('every color stays')
  })

  it('says why it is off for pixel art, on the button and in the popover', async () => {
    const { wrapper } = await opened(pixelArtPicture(48))
    expect(wrapper.get('[data-testid="convert-clean-up-first"]').text()).toBe('Off for pixel art')
    expect(wrapper.get('[data-testid="convert-clean-up-second"]').text()).toBe('every pixel stays a bead')
    await wrapper.get('[data-testid="convert-clean-up-button"]').trigger('click')
    expect(wrapper.get('[data-testid="convert-clean-up-pixel-art"]').text()).toBe('pixel art · every pixel stays a bead')
    expect(wrapper.get('[data-testid="convert-clean-up-count"]').text()).toMatch(/^\d+ single beads? kept$/)
    expect(wrapper.get('[data-testid="convert-small-colors-value"]').text()).toBe('off')
  })
})
