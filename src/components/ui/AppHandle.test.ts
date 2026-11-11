import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppHandle from './AppHandle.vue'

describe('AppHandle (Handle card, ticket 0867)', () => {
  it('is a button named by its caller, its bracket or bar turned to its corner or edge, with its resize cursor', () => {
    const corner = mount(AppHandle, { props: { place: 'bottom-right' }, attrs: { 'aria-label': 'Crop: bottom-right corner' } })
    const edge = mount(AppHandle, { props: { place: 'left' } })

    expect(corner.element.tagName).toBe('BUTTON')
    expect(corner.attributes('type')).toBe('button')
    expect(corner.attributes('aria-label')).toBe('Crop: bottom-right corner')
    expect(corner.classes()).toContain('app-handle--corner')
    expect(corner.attributes('style')).toContain('--handle-turn: 180deg')
    expect(corner.attributes('style')).toContain('cursor: nwse-resize')
    expect(edge.classes()).toContain('app-handle--edge')
    expect(edge.attributes('style')).toContain('--handle-turn: 270deg')
    expect(edge.attributes('style')).toContain('cursor: ew-resize')
  })

  it('is drawn hot while dragged, and keeps its reach under the limit it is given', () => {
    const wrapper = mount(AppHandle, { props: { place: 'top-left', hot: true, limit: 9 } })

    expect(wrapper.classes()).toContain('app-handle--hot')
    expect(wrapper.attributes('style')).toContain('--handle-limit: 9px')
  })
})
