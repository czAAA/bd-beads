import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { effectScope } from 'vue'
import ConvertStepBar from './ConvertStepBar.vue'
import { useConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import type { PixelData } from '../../domain/imageConversion'
import { en } from '../../i18n/en'
import { unusedCutOutService } from '../../testUtils/fakeCutOutService'
import { fakeCutOutDevice } from '../../testUtils/fakeCutOutDevice'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))

const picture = (): PixelData => ({ width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(200) })

async function bar(withPicture = true) {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture(),
      loadCatalog: () => Promise.reject(new Error('none')),
      cutOutService: unusedCutOutService,
      cutOutDevice: fakeCutOutDevice().device,
    }),
  )!
  if (withPicture) await wizard.setFile(new File(['x'], 'art.png', { type: 'image/png' }))
  const wrapper = mount(ConvertStepBar, { props: { wizard } })
  return { wrapper, wizard }
}
const dots = (wrapper: Awaited<ReturnType<typeof bar>>['wrapper']) => wrapper.findAll('.step-dot')

describe('ConvertStepBar', () => {
  it('holds the five steps as named dots on the Progress bar, with a counter and Back and Next', async () => {
    const { wrapper } = await bar()
    expect(dots(wrapper).map((dot) => dot.text().toLowerCase())).toEqual(['picture', 'bead', 'size', 'colors', 'review'])
    expect(wrapper.get('[data-testid="convert-counter"]').text()).toBe('1/5')
    expect(wrapper.get('[data-testid="convert-track"]').attributes('aria-label')).toBe(en.convertImage.wizard.railLabel)
    expect(wrapper.get('[data-testid="convert-back"]').text()).toBe(en.convertImage.wizard.stepBack)
    expect(wrapper.get('[data-testid="convert-next"]').text()).toBe(en.convertImage.wizard.stepNext)
    expect(wrapper.get('[data-testid="convert-back"]').attributes('aria-disabled')).toBe('true')
    expect(dots(wrapper)[0]!.attributes('aria-current')).toBe('step')
  })

  it('jumps to a dot, and steps with Back and Next', async () => {
    const { wrapper, wizard } = await bar()
    await wrapper.get('[data-testid="convert-step-colors"]').trigger('click')
    expect(wizard.step.value).toBe('colors')
    expect(wrapper.get('[data-testid="convert-counter"]').text()).toBe('4/5')

    await wrapper.get('[data-testid="convert-back"]').trigger('click')
    expect(wizard.step.value).toBe('size')
    await wrapper.get('[data-testid="convert-next"]').trigger('click')
    await wrapper.get('[data-testid="convert-next"]').trigger('click')
    expect(wizard.step.value).toBe('review')
  })

  it('makes Next into Create Project on Review, which asks to create', async () => {
    const { wrapper, wizard } = await bar()
    wizard.goTo('review')
    await flushPromises()
    expect(wrapper.find('[data-testid="convert-next"]').exists()).toBe(false)
    const create = wrapper.get('[data-testid="convert-image-create"]')
    expect(create.text()).toBe(en.convertImage.createButton)
    expect(create.classes()).toContain('app-button--primary')

    await create.trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('keeps every step after Picture shut until a picture is set, saying so', async () => {
    const { wrapper, wizard } = await bar(false)
    for (const dot of dots(wrapper).slice(1)) expect(dot.attributes('aria-disabled')).toBe('true')
    await wrapper.get('[data-testid="convert-step-size"]').trigger('click')
    await wrapper.get('[data-testid="convert-next"]').trigger('click')
    expect(wizard.step.value).toBe('picture')
    expect(wrapper.get('[data-testid="convert-next"]').attributes('aria-disabled')).toBe('true')
  })
})
