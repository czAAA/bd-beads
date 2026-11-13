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
    expect(row.text()).toBe('Auto-fix lighting')
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
})
