import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToastUpdate from './ToastUpdate.vue'

const mountWith = (update: InstanceType<typeof ToastUpdate>['$props']['update']) => mount(ToastUpdate, { props: { name: 'Update ready', update } })
const kinds = (wrapper: ReturnType<typeof mountWith>) => wrapper.findAll('[data-testid="kind-label"]').map((label) => label.attributes('data-kind'))

describe('ToastUpdate (ticket 1048)', () => {
  it.each(['new', 'changed', 'fixed'] as const)('names the waiting Version, then one %s note by its kind label and line', (kind) => {
    const wrapper = mountWith({ version: '2.2.0', note: { kind, line: 'Zoomed in, the title block names its Bead' } })
    expect(wrapper.get('.toast-update__name').text()).toBe('Update ready')
    expect(wrapper.get('[data-testid="update-version"]').text()).toBe('2.2.0')
    expect(kinds(wrapper)).toEqual([kind])
    expect(wrapper.get('[data-testid="update-note"]').text()).toContain('Zoomed in, the title block names its Bead')
    expect(wrapper.find('[data-testid="update-counts"]').exists()).toBe(false)
  })

  it('counts several by kind, as each kind label and its number, in the order given', () => {
    const wrapper = mountWith({ version: '2.1.7', counts: [{ kind: 'changed', count: 1 }, { kind: 'fixed', count: 3 }] })
    expect(kinds(wrapper)).toEqual(['changed', 'fixed'])
    expect(wrapper.findAll('[data-testid="update-count"]').map((count) => count.text())).toEqual(['Changed1', 'Fixed3'])
    expect(wrapper.find('[data-testid="update-note"]').exists()).toBe(false)
  })

  it('is the name alone when what waits is unknown, and the name and Version with no note', () => {
    const plain = mountWith({})
    expect(plain.text()).toBe('Update ready')
    expect(plain.find('[data-testid="update-version"]').exists()).toBe(false)
    const versionOnly = mountWith({ version: '3.0.0' })
    expect(versionOnly.text()).toBe('Update ready3.0.0')
    expect(kinds(versionOnly)).toEqual([])
  })
})
