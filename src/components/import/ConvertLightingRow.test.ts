import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, effectScope, h } from 'vue'
import ConvertImageWizard from './ConvertImageWizard.vue'
import { useConvertImageWizard, type ConvertImageWizard as Wizard } from '../../composables/import/useConvertImageWizard'
import { photoPicture } from '../../testUtils/samplerPictures'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))
afterEach(() => {
  document.body.innerHTML = ''
})

const Page = defineComponent({
  props: { wizard: { type: Object as () => Wizard, required: true } },
  setup: (props) => () => h(ConvertImageWizard, { wizard: props.wizard, readClipboardImage: async () => undefined }),
})

function page() {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => photoPicture(),
      loadCatalog: () => Promise.reject(new Error('no catalog')),
    }),
  )!
  const wrapper = mount(Page, { props: { wizard }, attachTo: document.body })
  return { wrapper, wizard }
}

describe('Auto-fix lighting on the converter page (ticket 0907, DS-3)', () => {
  it('is a row of the picture section once a picture is read, its switch off and named by the row', async () => {
    const { wrapper, wizard } = page()
    expect(wrapper.find('[data-testid="convert-lighting"]').exists()).toBe(false)
    await wizard.setFile(new File(['x'], 'night.png', { type: 'image/png' }))
    await flushPromises()

    const row = wrapper.get('[data-testid="convert-picture"] [data-testid="convert-lighting"]')
    expect(row.get('[id]').text()).toBe('Auto-fix lighting')
    const toggle = row.get('[data-testid="convert-lighting-switch"]')
    expect(toggle.attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`#${toggle.attributes('aria-labelledby')}`).text()).toBe('Auto-fix lighting')
  })

  it('turns the lighting on and off with its switch', async () => {
    const { wrapper, wizard } = page()
    await wizard.setFile(new File(['x'], 'night.png', { type: 'image/png' }))
    await flushPromises()
    await wrapper.get('[data-testid="convert-lighting-switch"]').trigger('click')
    expect(wizard.lighting.on.value).toBe(true)
    expect(wrapper.get('[data-testid="convert-lighting-switch"]').attributes('aria-checked')).toBe('true')
    await wrapper.get('[data-testid="convert-lighting-switch"]').trigger('click')
    expect(wizard.lighting.on.value).toBe(false)
  })

  it('opens the Lighting popover from the sun button, its three sliders at 0 with their resets off, and closes on Escape (ticket 0908)', async () => {
    const { wrapper, wizard } = page()
    await wizard.setFile(new File(['x'], 'night.png', { type: 'image/png' }))
    await flushPromises()
    const sun = wrapper.get('[data-testid="convert-lighting"] [data-testid="convert-lighting-more"]')
    expect(sun.attributes('aria-label')).toBe('More for the lighting')
    await sun.trigger('click')
    await flushPromises()
    const popover = wrapper.get('[data-testid="convert-lighting-popover"]')
    expect(popover.attributes('aria-label')).toBe('Lighting')
    expect(sun.attributes('aria-expanded')).toBe('true')
    for (const name of ['Brightness', 'Contrast', 'Saturation']) {
      const slug = name.toLowerCase()
      expect(popover.get(`[data-testid="convert-lighting-${slug}-range"]`).attributes()).toMatchObject({ 'aria-label': name, 'aria-valuetext': '0' })
      const reset = popover.get(`[data-testid="convert-lighting-${slug}-reset"]`)
      expect(reset.attributes()).toMatchObject({ 'aria-label': `Reset ${name}`, 'aria-disabled': 'true' })
    }
    expect(popover.text()).toContain('darker')
    expect(popover.text()).toContain('brighter colors')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('[data-testid="convert-lighting-popover"]').exists()).toBe(false)
    expect(document.activeElement).toBe(sun.element)
  })

  it('moves a slider by its keys, names the moved ones under the row, and a reset puts back its own, focus staying on it', async () => {
    const { wrapper, wizard } = page()
    await wizard.setFile(new File(['x'], 'night.png', { type: 'image/png' }))
    await flushPromises()
    await wrapper.get('[data-testid="convert-lighting-more"]').trigger('click')
    await flushPromises()
    const range = (name: string) => wrapper.get(`[data-testid="convert-lighting-${name}-range"]`)
    expect(wrapper.find('[data-testid="convert-lighting-moved"]').exists()).toBe(false)

    await range('brightness').trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    await range('contrast').trigger('keydown', { key: 'PageDown' })
    expect(range('brightness').attributes('aria-valuetext')).toBe('+10')
    expect(wrapper.get('[data-testid="convert-lighting-moved"]').text()).toBe('brightness +10 · contrast \u221210')

    const reset = wrapper.get('[data-testid="convert-lighting-brightness-reset"]')
    expect(reset.attributes('aria-disabled')).toBeUndefined()
    ;(reset.element as HTMLElement).focus()
    await reset.trigger('click')
    expect(wizard.lighting.sliders.value).toEqual({ brightness: 0, contrast: -10, saturation: 0 })
    expect(reset.attributes('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(reset.element)
    expect(wrapper.get('[data-testid="convert-lighting-moved"]').text()).toBe('contrast \u221210')
  })
})
