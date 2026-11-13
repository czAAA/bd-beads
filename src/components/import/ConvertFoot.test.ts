import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, effectScope, h } from 'vue'
import ConvertFoot from './ConvertFoot.vue'
import { provideConvertImageWizard, useConvertImageWizard, type ConvertImageWizard } from '../../composables/import/useConvertImageWizard'
import type { CreateProjectInput } from '../../domain/createProject'
import type { PixelData } from '../../domain/imageConversion'
import { en } from '../../i18n/en'

// The converter column's foot (ConvertImage card DS-1, ticket 0897): the project line, the result and Create Project.

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

/** An 8 × 4 picture: the left half red, the right half white, so 8 × 4 beads of two colors at its least Width. */
async function redAndWhite(): Promise<PixelData> {
  const data: number[] = []
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 8; x += 1) data.push(...(x < 4 ? [230, 55, 70, 255] : [255, 255, 255, 255]))
  return { width: 8, height: 4, data: new Uint8ClampedArray(data) }
}

const draft: CreateProjectInput = { technique: 'loom', beadId: 'miyuki/delica/11-0', name: 'Tabby', makerName: 'Olga' }

function open(options: { start?: CreateProjectInput; addsToCanvas?: boolean } = {}) {
  const wizard = effectScope().run(() =>
    useConvertImageWizard({ start: options.start ?? draft, decodeImage: redAndWhite, loadCatalog: () => Promise.reject(new Error('none')), addsToCanvas: options.addsToCanvas }),
  )!
  const Host = defineComponent({
    emits: ['create'],
    setup(_, { emit }) {
      provideConvertImageWizard(wizard)
      return () => h(ConvertFoot, { onCreate: () => emit('create') })
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wizard, wrapper }
}

async function withPicture(wizard: ConvertImageWizard, name = 'cat.png') {
  await wizard.setFile(new File(['x'], name, { type: 'image/png' }))
  await flushPromises()
}

const text = (wrapper: ReturnType<typeof open>['wrapper'], testid: string) => wrapper.get(`[data-testid="${testid}"]`).text()

describe('ConvertFoot before a picture', () => {
  it('says there is no picture yet in place of the project line and the result, Create Project off with its reason', () => {
    const { wrapper } = open()
    expect(text(wrapper, 'convert-result-none')).toBe(en.convertImage.wizard.bandEmpty)
    expect(wrapper.find('[data-testid="convert-project-line"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="convert-result"]').exists()).toBe(false)
    const button = wrapper.get('[data-testid="convert-image-create"]')
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('says the picture is being read, the button still off, while one is read', async () => {
    const { wizard, wrapper } = open()
    const reading = wizard.setFile(new File(['x'], 'cat.png', { type: 'image/png' }))
    await wrapper.vm.$nextTick()
    expect(text(wrapper, 'convert-result-none')).toBe(en.convertImage.wizard.readingLine)
    expect(wrapper.get('[data-testid="convert-image-create"]').attributes('aria-disabled')).toBe('true')
    await reading
  })

  it('makes nothing when the off button is pressed', async () => {
    const { wrapper } = open()
    await wrapper.get('[data-testid="convert-image-create"]').trigger('click')
    expect(wrapper.emitted('create')).toBeUndefined()
  })
})

describe('ConvertFoot with a picture', () => {
  it('names the Project the form named, then the size, the colors and the beads needed over Create Project', async () => {
    const { wizard, wrapper } = open()
    await withPicture(wizard)
    expect(text(wrapper, 'convert-project-line')).toBe('project Tabby')
    expect(text(wrapper, 'convert-result-size')).toMatch(/^8×4 beads · [\d.]+ × [\d.]+ (mm|cm)$/)
    expect(text(wrapper, 'convert-result-colors')).toBe('2 colors')
    // 32 beads of a Delica 11/0 at about 0.005 g each.
    expect(text(wrapper, 'convert-result-beads')).toMatch(/^beads needed 32 · ≈ 0\.\d\d g$/)
    expect(wrapper.find('[data-testid="convert-result-goes-where"]').exists()).toBe(false)

    const button = wrapper.get('[data-testid="convert-image-create"]')
    expect(button.text()).toBe(en.convertImage.createButton)
    expect(button.attributes('aria-disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('names the Project after the picture’s file when no form named it', async () => {
    const { wizard, wrapper } = open({ start: { ...draft, name: '', makerName: '' } })
    await withPicture(wizard, 'spring cat.jpeg')
    expect(text(wrapper, 'convert-project-line')).toBe('project spring cat')
  })

  it('counts only the kept beads, and says what the part was kept from', async () => {
    const { wizard, wrapper } = open()
    await withPicture(wizard)
    wizard.setTool('select')
    wizard.setKept({ row: 0, column: 0, rows: 2, columns: 3 })
    await flushPromises()
    expect(text(wrapper, 'convert-result-size')).toMatch(/^3×2 beads/)
    expect(text(wrapper, 'convert-result-colors')).toMatch(/ · kept from 8×4$/)
    expect(text(wrapper, 'convert-result-beads')).toMatch(/^beads needed 6 · ≈/)
  })

  it('opened from a reference image, adds to the open Project where the picture lies, with Add to Canvas', async () => {
    const { wizard, wrapper } = open({ start: { ...draft, name: 'Spring bracelet' }, addsToCanvas: true })
    await withPicture(wizard)
    expect(text(wrapper, 'convert-project-line')).toBe('adds to Spring bracelet')
    expect(text(wrapper, 'convert-result-goes-where')).toBe(en.convertImage.wizard.resultGoesWhere)
    expect(wrapper.get('[data-testid="convert-image-create"]').text()).toBe(en.convertImage.addToCanvas)
  })

  it('lets a screen reader hear the result once, after a change settles', async () => {
    vi.useFakeTimers()
    const { wizard, wrapper } = open()
    await withPicture(wizard)
    const heard = () => wrapper.get('[data-testid="convert-result-heard"]')
    expect(heard().attributes('role')).toBe('status')
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(heard().text()).toContain('8×4 beads')

    wizard.setWidth(12)
    await flushPromises()
    vi.advanceTimersByTime(100)
    wizard.setWidth(16)
    await flushPromises()
    vi.advanceTimersByTime(100)
    await flushPromises()
    // Still moving: what is heard is the last settled result.
    expect(heard().text()).toContain('8×4 beads')
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(heard().text()).toContain('16×8 beads')
    // The lines on screen are not read a second time.
    expect(wrapper.get('[data-testid="convert-result"]').attributes('aria-hidden')).toBe('true')
  })
})
