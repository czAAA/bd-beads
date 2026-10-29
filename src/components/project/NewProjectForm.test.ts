import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import NewProjectForm from './NewProjectForm.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'
import { BEAD_CATALOG, beadLabel } from '../../domain/beads'
import { chooseBeadInSection } from '../../testUtils/beadPicker'
import { choosePanelOption, panelOptionShown } from '../../testUtils/choosePanelOption'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import { IMAGE_MAX_MEGABYTES, IMAGE_MAX_MEGAPIXELS, formatImageLimits } from '../../domain/imageConversion'
import { ru } from '../../i18n/ru'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

describe('NewProjectForm', () => {
  it('starts on the default Bead in the shared bead section (tickets 535, 568)', () => {
    const wrapper = mount(NewProjectForm)

    expect(panelOptionShown(wrapper, 'bead-brand')).toBe(BEAD_CATALOG[0]!.brand.name)
    expect(panelOptionShown(wrapper, 'bead-size')).toBe(BEAD_CATALOG[0]!.size)
  })

  it('opens with the Open canvas title and its subtitle, then the three accent buttons in order (ticket 568)', () => {
    const wrapper = mount(NewProjectForm)

    expect(wrapper.get('[data-testid="open-canvas-title"]').text()).toBe(ru.form.openCanvasTitle)
    expect(wrapper.text()).toContain(ru.form.openCanvasSubtitle)
    const buttons = [...wrapper.element.querySelectorAll('[data-testid="create-project"], [data-testid="convert-image"], [data-testid="pick-starter"]')]
    expect(buttons.map((button) => button.getAttribute('data-testid'))).toEqual(['create-project', 'convert-image', 'pick-starter'])
  })

  it('opens the Starter gallery one level deeper from Pick a starter, focus to come back to it (ticket 0596)', async () => {
    const openSub = vi.fn()
    const wrapper = mount(NewProjectForm, { global: { provide: { [PANEL_CONTEXT as symbol]: { itemRole: ref(undefined), close: vi.fn(), openSub } } } })
    expect(wrapper.find('[data-testid="starter-gallery"]').exists()).toBe(false)
    await wrapper.get('[data-testid="pick-starter"]').trigger('click')
    expect(openSub).toHaveBeenCalledWith(ru.starters.title, { opener: 'pick-starter' })
  })

  it('focuses and selects the Name input as soon as the form opens (ticket 181)', () => {
    const wrapper = mount(NewProjectForm, { attachTo: document.body })
    const input = wrapper.find('[data-testid="name-input"]').element as HTMLInputElement

    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)

    wrapper.unmount()
  })

  it('leaves the Name unfocused on a touch device until it is tapped, so the keyboard stays down (ticket 515)', async () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(pointer: coarse)': true }).matchMedia)
    const wrapper = mount(NewProjectForm, { attachTo: document.body })
    const input = wrapper.find('[data-testid="name-input"]')

    expect(document.activeElement).not.toBe(input.element)
    await input.trigger('pointerdown')
    wrapper.vm.focusName()
    expect(document.activeElement).toBe(input.element)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('has no Frame, Unit, Width or Height fields: the size is set afterwards in the Frame section (ticket 342)', () => {
    const wrapper = mount(NewProjectForm)

    for (const id of ['width-input', 'height-input', 'unit-select', 'new-project-frame-heading', 'size-conversion']) {
      expect(wrapper.find(`[data-testid="${id}"]`).exists()).toBe(false)
    }
    expect(wrapper.find('[data-testid="new-project-estimate-info"]').exists()).toBe(false)
  })

  it('emits submit with the chosen bead and technique, and no size: a new Project is a Canvas', async () => {
    const wrapper = mount(NewProjectForm)

    await chooseBeadInSection(wrapper, BEAD_CATALOG[1]!.id)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([
      [{ name: '', technique: 'loom', beadId: BEAD_CATALOG[1]!.id, makerName: '' }],
    ])
  })

  it('shows the selected bead label as the name placeholder', async () => {
    const wrapper = mount(NewProjectForm)

    await chooseBeadInSection(wrapper, BEAD_CATALOG[1]!.id)

    expect(wrapper.find('[data-testid="name-input"]').attributes('placeholder')).toBe(
      beadLabel(BEAD_CATALOG[1]!, ru.formFactors),
    )
  })

  it('emits the trimmed custom name when one is typed', async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.find('[data-testid="name-input"]').setValue('  My Bracelet  ')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ name: 'My Bracelet' })
  })

  it('lists Peyote, Brick stitch and Square stitch alongside Loom, and nothing else (tickets 0644, 0635)', async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.get('[data-testid="new-project-technique"] button[aria-haspopup]').trigger('click')
    const options = wrapper.findAll('[data-testid="new-project-technique"] [role="menuitemradio"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['loom', 'peyote', 'brick', 'square'])
  })

  it('emits the chosen technique when Peyote or Brick stitch is selected', async () => {
    const wrapper = mount(NewProjectForm)

    await choosePanelOption(wrapper, 'new-project-technique', 'peyote')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ technique: 'peyote' })
  })

  it('offers Symmetric and Real, starts Symmetric and sends Real only when it is chosen (ticket 508)', async () => {
    const wrapper = mount(NewProjectForm)

    const options = wrapper.findAll('[data-testid="bead-shape"] [role="radio"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['symmetric', 'real'])
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')![0]![0]).not.toHaveProperty('beadShape')

    await wrapper.find('[data-testid="bead-shape"] [data-value="real"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')![1]![0]).toMatchObject({ beadShape: 'real' })
    expect(wrapper.emitted('draft')!.at(-1)![0]).toMatchObject({ beadShape: 'real' })
  })

  it('starts on the device\'s Background and sends one only when it is picked, for both layers (ticket 0670)', async () => {
    const wrapper = mount(NewProjectForm, { attachTo: document.body })

    expect(wrapper.find('[data-testid="canvas-section"]').exists()).toBe(true)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')![0]![0]).not.toHaveProperty('background')

    await wrapper.get('[data-testid="background-color-linen"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')![1]![0]).toMatchObject({ background: 2 })
    expect(wrapper.emitted('draft')!.at(-1)![0]).toMatchObject({ background: 2 })
    wrapper.unmount()
  })

  it("emits the trimmed maker's name when one is typed, keeping it apart from the device-wide one (ticket 182)", async () => {
    const wrapper = mount(NewProjectForm)

    await wrapper.find('[data-testid="maker-name-input"]').setValue('  Bead Master  ')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('submit')
    expect(events![0]![0]).toMatchObject({ makerName: 'Bead Master' })
  })

  it("leaves the maker's name blank by default", () => {
    const wrapper = mount(NewProjectForm)

    expect((wrapper.find('[data-testid="maker-name-input"]').element as HTMLInputElement).value).toBe('')
  })
})

describe('NewProjectForm draft (ticket 58)', () => {
  it('reports its values straight away, so Convert image has a frame before anything is touched', () => {
    const wrapper = mount(NewProjectForm)

    expect(wrapper.emitted('draft')![0]![0]).toEqual({
      name: '',
      technique: 'loom',
      beadId: BEAD_CATALOG[0]!.id,
      makerName: '',
    })
  })

  it('reports every later change, so the frame follows the fields as they are edited', async () => {
    const wrapper = mount(NewProjectForm)

    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    await chooseBeadInSection(wrapper, BEAD_CATALOG[2]!.id)

    expect(wrapper.emitted('draft')!.at(-1)![0]).toEqual({
      name: '',
      technique: 'brick',
      techniqueSettings: { brickDrop: 1 },
      beadId: BEAD_CATALOG[2]!.id,
      makerName: '',
    })
  })
})

describe('NewProjectForm Drop (tickets 477, 0691)', () => {
  const field = '[data-testid="new-project-brick-drop"]'
  const peyoteField = '[data-testid="new-project-peyote-drop"]'

  it('shows brick stitch\'s stepper only for brick stitch and peyote\'s only for peyote', async () => {
    const wrapper = mount(NewProjectForm)
    expect(wrapper.find(field).exists()).toBe(false)
    expect(wrapper.find(peyoteField).exists()).toBe(false)

    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    expect(wrapper.find(field).exists()).toBe(true)
    expect(wrapper.find('[data-testid="new-project-brick-drop-value"]').text()).toBe('1')

    await choosePanelOption(wrapper, 'new-project-technique', 'peyote')
    expect(wrapper.find(field).exists()).toBe(false)
    expect(wrapper.find(peyoteField).exists()).toBe(true)
    expect(wrapper.find('[data-testid="new-project-peyote-drop-value"]').text()).toBe('1')
  })

  it('steps from 1 to 20, and sends the number with the draft and the submit', async () => {
    const wrapper = mount(NewProjectForm)
    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    expect(wrapper.find('[data-testid="new-project-brick-drop-less"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="new-project-brick-drop-more"]').trigger('pointerdown')
    await wrapper.find('[data-testid="new-project-brick-drop-more"]').trigger('pointerup')
    expect(wrapper.emitted('draft')!.at(-1)![0]).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 2 } })

    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 2 } })
  })

  it('keeps each Technique\'s own number while another is chosen, and sends only the chosen one\'s', async () => {
    const wrapper = mount(NewProjectForm)
    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    await wrapper.find('[data-testid="new-project-brick-drop-more"]').trigger('pointerdown')
    await wrapper.find('[data-testid="new-project-brick-drop-more"]').trigger('pointerup')

    await choosePanelOption(wrapper, 'new-project-technique', 'peyote')
    expect(wrapper.emitted('draft')!.at(-1)![0]).toMatchObject({ technique: 'peyote', techniqueSettings: { peyoteDrop: 1 } })
    await wrapper.find('[data-testid="new-project-peyote-drop-more"]').trigger('pointerdown')
    await wrapper.find('[data-testid="new-project-peyote-drop-more"]').trigger('pointerup')
    await wrapper.find('[data-testid="new-project-peyote-drop-more"]').trigger('pointerdown')
    await wrapper.find('[data-testid="new-project-peyote-drop-more"]').trigger('pointerup')
    expect((wrapper.emitted('draft')!.at(-1)![0] as { techniqueSettings: unknown }).techniqueSettings).toEqual({ peyoteDrop: 3 })

    await choosePanelOption(wrapper, 'new-project-technique', 'loom')
    expect(wrapper.emitted('draft')!.at(-1)![0]).not.toHaveProperty('techniqueSettings')

    await choosePanelOption(wrapper, 'new-project-technique', 'brick')
    expect(wrapper.find('[data-testid="new-project-brick-drop-value"]').text()).toBe('2')
    await choosePanelOption(wrapper, 'new-project-technique', 'peyote')
    expect(wrapper.find('[data-testid="new-project-peyote-drop-value"]').text()).toBe('3')
  })
})

describe('NewProjectForm Convert image (spec 0645)', () => {
  it('advertises the limits as visible helper text and from the shared constants', () => {
    const wrapper = mount(NewProjectForm)
    const expected = formatImageLimits(ru.convertImage.limitsHint)

    expect(expected).toContain('PNG')
    expect(expected).toContain(String(IMAGE_MAX_MEGABYTES))
    expect(expected).toContain(String(IMAGE_MAX_MEGAPIXELS))
    expect(wrapper.find('[data-testid="convert-image-limits"]').text()).toBe(expected)
  })

  it('opens Convert image on the form’s values, which never carry a size', async () => {
    const wrapper = mount(NewProjectForm)
    await wrapper.find('[data-testid="name-input"]').setValue('Fox')
    await choosePanelOption(wrapper, 'new-project-technique', 'peyote')

    await wrapper.find('[data-testid="convert-image"]').trigger('click')

    const [values] = wrapper.emitted('convert-image')![0]! as [Record<string, unknown>]
    expect(values).toMatchObject({ name: 'Fox', technique: 'peyote', beadId: BEAD_CATALOG[0]!.id })
    expect(values).not.toHaveProperty('size')
  })
})
