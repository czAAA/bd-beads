import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadCatalog from './BeadCatalog.vue'
import { BEAD_CATALOG, type Bead } from '../domain/beads'
import { ru } from '../i18n/ru'

function customBead(overrides: Partial<Bead> = {}): Bead {
  return {
    id: 'custom-1',
    brand: 'Acme',
    name: 'Fancy',
    size: '8/0',
    formFactor: 'round',
    color: '#e63746',
    widthMm: 3,
    heightMm: 3,
    ...overrides,
  }
}

describe('BeadCatalog', () => {
  it('lists the seeded catalog', () => {
    const wrapper = mount(BeadCatalog, { props: { seededBeads: BEAD_CATALOG, customBeads: [] } })

    const items = wrapper.findAll('[data-testid="catalog-seeded-item"]')
    expect(items).toHaveLength(BEAD_CATALOG.length)
    expect(items[0]!.text()).toContain('TOHO')
  })

  it('lists custom beads with edit and remove controls, unlike seeded ones', () => {
    const bead = customBead()
    const wrapper = mount(BeadCatalog, { props: { seededBeads: BEAD_CATALOG, customBeads: [bead] } })

    const seededItem = wrapper.find('[data-testid="catalog-seeded-item"]')
    const customItem = wrapper.find('[data-testid="catalog-custom-item"]')

    expect(seededItem.find('button').exists()).toBe(false)
    expect(customItem.find(`[data-testid="catalog-edit-${bead.id}"]`).exists()).toBe(true)
    expect(customItem.find(`[data-testid="catalog-remove-${bead.id}"]`).exists()).toBe(true)
  })

  it('emits add with a new bead built from the form', async () => {
    const wrapper = mount(BeadCatalog, { props: { seededBeads: BEAD_CATALOG, customBeads: [] } })

    await wrapper.find('[data-testid="catalog-brand-input"]').setValue('Acme')
    await wrapper.find('[data-testid="catalog-name-input"]').setValue('Fancy')
    await wrapper.find('[data-testid="catalog-size-input"]').setValue('8/0')
    await wrapper.find('[data-testid="catalog-form-factor-select"]').setValue('cube')
    await wrapper.find('[data-testid="catalog-width-input"]').setValue('3')
    await wrapper.find('[data-testid="catalog-height-input"]').setValue('3')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('add')
    expect(events).toHaveLength(1)
    expect(events![0]![0]).toMatchObject({
      brand: 'Acme',
      name: 'Fancy',
      size: '8/0',
      formFactor: 'cube',
      color: '#e63746',
      widthMm: 3,
      heightMm: 3,
    })
  })

  it('does not emit add while the form is incomplete', async () => {
    const wrapper = mount(BeadCatalog, { props: { seededBeads: BEAD_CATALOG, customBeads: [] } })

    await wrapper.find('[data-testid="catalog-brand-input"]').setValue('Acme')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('add')).toBeUndefined()
  })

  it('pre-fills the form and emits edit when Edit is clicked and saved', async () => {
    const bead = customBead()
    const wrapper = mount(BeadCatalog, { props: { seededBeads: BEAD_CATALOG, customBeads: [bead] } })

    await wrapper.find(`[data-testid="catalog-edit-${bead.id}"]`).trigger('click')

    expect(wrapper.find<HTMLInputElement>('[data-testid="catalog-brand-input"]').element.value).toBe(
      'Acme',
    )
    expect(wrapper.find('[data-testid="catalog-submit"]').text()).toBe(ru.catalog.saveButton)

    await wrapper.find('[data-testid="catalog-name-input"]').setValue('Renamed')
    await wrapper.find('form').trigger('submit')

    const events = wrapper.emitted('edit')
    expect(events).toHaveLength(1)
    expect(events![0]![0]).toMatchObject({ id: bead.id, name: 'Renamed' })
  })

  it('cancels an in-progress edit without emitting', async () => {
    const bead = customBead()
    const wrapper = mount(BeadCatalog, { props: { seededBeads: BEAD_CATALOG, customBeads: [bead] } })

    await wrapper.find(`[data-testid="catalog-edit-${bead.id}"]`).trigger('click')
    await wrapper.find('[data-testid="catalog-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="catalog-submit"]').text()).toBe(ru.catalog.addButton)
    expect(wrapper.find<HTMLInputElement>('[data-testid="catalog-brand-input"]').element.value).toBe('')
  })

  it('emits remove with the bead id', async () => {
    const bead = customBead()
    const wrapper = mount(BeadCatalog, { props: { seededBeads: BEAD_CATALOG, customBeads: [bead] } })

    await wrapper.find(`[data-testid="catalog-remove-${bead.id}"]`).trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[bead.id]])
  })
})
