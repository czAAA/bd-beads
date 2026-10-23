import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PanelHost from './PanelHost.vue'
import AppPanel from './AppPanel.vue'
import { PANELS, type PanelId } from './panels'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('PanelHost (ticket 511)', () => {
  // A panel added later is a descriptor in PANELS and its content: the host sets AppPanel up from the descriptor alone.
  it.each(Object.keys(PANELS) as PanelId[])('sets up the %s panel from its descriptor, with no placement of its own', (id) => {
    const wrapper = mount(PanelHost, { props: { open: id, only: [id] }, slots: { default: '<p>content</p>' }, attachTo: document.body })
    const shell = wrapper.getComponent(AppPanel)
    expect(shell.props()).toMatchObject({ anchor: PANELS[id].anchor, menu: PANELS[id].menu, skipsFields: PANELS[id].skipsFields, width: PANELS[id].width })
    expect(shell.text()).toContain('content')
  })

  it('shows nothing for a panel it is not given', () => {
    const wrapper = mount(PanelHost, { props: { open: 'frame', only: ['menu', 'project'] } })
    expect(wrapper.findComponent(AppPanel).exists()).toBe(false)
  })
})
