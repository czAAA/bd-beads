import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadPicker from './BeadPicker.vue'
import { BEAD_CATALOG, beadCopy, beadLabel, type Bead } from '../../domain/beads'
import { chooseBead } from '../../testUtils/beadPicker'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const [cube, round, delica] = BEAD_CATALOG as [Bead, Bead, Bead]

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(BeadPicker, { props: { modelValue: cube.id, beads: BEAD_CATALOG, ...props } })
}

const open = (wrapper: ReturnType<typeof mountPicker>) => wrapper.get('[data-testid="bead-picker-toggle"]').trigger('click')
const items = (wrapper: ReturnType<typeof mountPicker>) => wrapper.findAll('[role="menuitem"]').map((item) => item.text())

describe('BeadPicker', () => {
  it('is collapsed to the current Bead and a hint, with a way to change it', () => {
    const wrapper = mountPicker()

    expect(wrapper.get('[data-testid="bead-picker-current"]').text()).toBe(beadLabel(cube))
    expect(wrapper.text()).toContain(en.form.beadPicker.hint)
    expect(wrapper.find('[data-testid="bead-picker-steps"]').exists()).toBe(false)
  })

  it('opens to Brand, Form factor and Bead size, and closes again', async () => {
    const wrapper = mountPicker()

    await open(wrapper)
    expect(wrapper.get('[data-testid="bead-picker-brand"]').text()).toBe('TOHO')
    expect(wrapper.get('[data-testid="bead-picker-form-factor"]').text()).toBe('Cube')
    expect(wrapper.get('[data-testid="bead-picker-size"]').text()).toBe('1.5mm')

    await open(wrapper)
    expect(wrapper.find('[data-testid="bead-picker-steps"]').exists()).toBe(false)
  })

  it('lists only the Brands, then the Form factors of the Brand, then its sizes', async () => {
    const wrapper = mountPicker()
    await open(wrapper)

    await wrapper.get('[data-testid="bead-picker-brand"]').trigger('click')
    expect(items(wrapper)).toEqual(['TOHO', 'Miyuki'])
    await wrapper.get('[data-testid="bead-picker-brand-toho"]').trigger('click')

    await wrapper.get('[data-testid="bead-picker-form-factor"]').trigger('click')
    expect(items(wrapper)).toEqual(['Cube', 'Round'])
  })

  it('picks nothing until a whole Bead is known, then reports its id', async () => {
    const roundNine: Bead = { ...round, id: 'toho/round/9-0', size: '9/0' }
    const wrapper = mountPicker({ beads: [cube, round, roundNine] })
    await open(wrapper)

    await wrapper.get('[data-testid="bead-picker-brand"]').trigger('click')
    await wrapper.get('[data-testid="bead-picker-brand-toho"]').trigger('click')
    await wrapper.get('[data-testid="bead-picker-form-factor"]').trigger('click')
    await wrapper.get('[data-testid="bead-picker-form-factor-round"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.get('[data-testid="bead-picker-size"]').text()).toBe(en.form.beadPicker.choose)

    await wrapper.get('[data-testid="bead-picker-size"]').trigger('click')
    await wrapper.get(`[data-testid="bead-picker-size-${roundNine.id}"]`).trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[roundNine.id]])
  })

  it('takes a step that has one choice by itself', async () => {
    const wrapper = mountPicker()

    await chooseBead(wrapper, delica.id)

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([delica.id])
  })

  it('offers only the Beads it is given', async () => {
    const wrapper = mountPicker({ beads: [cube, round] })
    await open(wrapper)

    await wrapper.get('[data-testid="bead-picker-brand"]').trigger('click')

    expect(items(wrapper)).toEqual(['TOHO'])
  })

  describe('standing on a Project\'s own Bead', () => {
    it('shows the Bead outside the offered list as the current one and does not offer it again', async () => {
      const wrapper = mountPicker({ modelValue: cube.id, beads: [round, delica], current: cube })
      await open(wrapper)

      expect(wrapper.get('[data-testid="bead-picker-size"]').text()).toBe('1.5mm')
      await wrapper.get('[data-testid="bead-picker-size"]').trigger('click')
      await wrapper.get(`[data-testid="bead-picker-size-${cube.id}"]`).trigger('click')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('lists the saved copy with the postfix beside the catalog\'s current Bead, and lets that one be picked', async () => {
      const saved = beadCopy({ ...cube, widthMm: 1.4 })
      const wrapper = mountPicker({ modelValue: cube.id, beads: BEAD_CATALOG, current: saved, outdated: true, closeOnPick: true })
      await open(wrapper)

      await wrapper.get('[data-testid="bead-picker-size"]').trigger('click')
      expect(items(wrapper)).toEqual([`1.5mm ${en.replaceBead.outdatedPostfix}`, '1.5mm'])
      expect(wrapper.get('[data-testid="bead-picker-saved"]').attributes('disabled')).toBeDefined()

      await wrapper.get(`[data-testid="bead-picker-size-${cube.id}"]`).trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([[cube.id]])
      expect(wrapper.find('[data-testid="bead-picker-steps"]').exists()).toBe(false)
    })

    it('leaves out the name when the caller shows it', () => {
      expect(mountPicker({ compact: true }).find('[data-testid="bead-picker-current"]').exists()).toBe(false)
    })
  })
})
