import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { effectScope } from 'vue'
import ConvertStepBar from './ConvertStepBar.vue'
import { useConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import type { PixelData } from '../../domain/imageConversion'
import { en } from '../../i18n/en'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))

const picture = (): PixelData => ({ width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(200) })

async function bar(withPicture = true) {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({
      start: { technique: 'loom', beadId: 'toho/cube/1.5mm', name: '', makerName: '' },
      decodeImage: async () => picture(),
      loadCatalog: () => Promise.reject(new Error('none')),
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
    expect(dots(wrapper).map((dot) => dot.text())).toEqual(['picture & bead', 'background', 'size', 'colors', 'review'])
    expect(wrapper.get('[data-testid="convert-counter"]').text()).toBe('1/5')
    expect(wrapper.get('[data-testid="convert-track"]').attributes('aria-label')).toBe(en.convertImage.wizard.railLabel)
    expect(wrapper.get('[data-testid="convert-back"]').text()).toBe(en.convertImage.wizard.stepBack)
    expect(wrapper.get('[data-testid="convert-next"]').text()).toBe(en.convertImage.wizard.stepNext)
    expect(wrapper.get('[data-testid="convert-back"]').attributes('aria-disabled')).toBe('true')
    expect(dots(wrapper)[0]!.attributes('aria-current')).toBe('step')
    // The steps run along the bar, so Back and Next point left and right (ticket 0780).
    expect(wrapper.get('[data-testid="convert-back"] [data-icon]').attributes('data-icon')).toBe('arrow-left')
    expect(wrapper.get('[data-testid="convert-next"] [data-icon]').attributes('data-icon')).toBe('arrow-right')
  })

  it('follows the pane’s scroll: the fill between the dots, the nearest step current (ticket 0780)', async () => {
    const { wrapper, wizard } = await bar()
    wizard.setScroll(2.25)
    await flushPromises()
    expect(wrapper.get('[data-testid="convert-track"] .progress-track__fill').attributes('style')).toContain('translateX(-43.75%)')
    expect(wrapper.get('[data-testid="convert-counter"]').text()).toBe('3/5')
    expect(dots(wrapper)[2]!.attributes('aria-current')).toBe('step')
  })

  it('marks the track as following the scroll, whose fill then moves with no ease, so Safari does not flicker it (ticket 0786)', async () => {
    const { wrapper } = await bar()
    expect(wrapper.get('[data-testid="convert-track"]').classes()).toContain('progress-track--following')
  })

  it('asks the pane to scroll to a dot’s step, and Back and Next to the steps either side of the one in view', async () => {
    const { wrapper, wizard } = await bar()
    await wrapper.get('[data-testid="convert-step-colors"]').trigger('click')
    expect(wizard.scrollRequest.value).toEqual({ step: 'colors' })

    wizard.setScroll(3)
    await flushPromises()
    await wrapper.get('[data-testid="convert-back"]').trigger('click')
    expect(wizard.scrollRequest.value).toEqual({ step: 'size' })
    await wrapper.get('[data-testid="convert-next"]').trigger('click')
    expect(wizard.scrollRequest.value).toEqual({ step: 'review' })
  })

  it('makes Next into Create Project on Review, which asks to create', async () => {
    const { wrapper, wizard } = await bar()
    wizard.setScroll(4)
    await flushPromises()
    expect(wrapper.find('[data-testid="convert-next"]').exists()).toBe(false)
    const create = wrapper.get('[data-testid="convert-image-create"]')
    expect(create.text()).toBe(en.convertImage.createButton)
    expect(create.classes()).toContain('app-button--primary')

    await create.trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('keeps every step after Picture & bead shut until a picture is set, saying so', async () => {
    const { wrapper, wizard } = await bar(false)
    for (const dot of dots(wrapper).slice(1)) expect(dot.attributes('aria-disabled')).toBe('true')
    await wrapper.get('[data-testid="convert-step-size"]').trigger('click')
    await wrapper.get('[data-testid="convert-next"]').trigger('click')
    expect(wizard.scrollRequest.value).toBeUndefined()
    expect(wrapper.get('[data-testid="convert-next"]').attributes('aria-disabled')).toBe('true')
  })
})
