import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PictureDropOverlay from './PictureDropOverlay.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

/** A drop on the window carrying these files, as a browser sends it. */
function drop(files: File[], prevented = false): Event {
  const event = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { files, items: [] } })
  if (prevented) event.preventDefault()
  window.dispatchEvent(event)
  return event
}

const png = new File(['x'], 'fox.png', { type: 'image/png' })

describe('PictureDropOverlay', () => {
  it('hands over a picture dropped on the app', () => {
    const wrapper = mount(PictureDropOverlay, { props: { disabled: false } })
    expect(drop([png]).defaultPrevented).toBe(true)
    expect(wrapper.emitted('picture')).toEqual([[png]])
  })

  it('leaves a Project file, a drop a control took, and any drop while a dialog shows alone', () => {
    const open = mount(PictureDropOverlay, { props: { disabled: false } })
    drop([new File(['{}'], 'library.json', { type: 'application/json' })])
    drop([png], true)
    expect(open.emitted('picture')).toBeUndefined()
    open.unmount()

    const dialog = mount(PictureDropOverlay, { props: { disabled: true } })
    drop([png])
    expect(dialog.emitted('picture')).toBeUndefined()
  })

  it('hands over a picture pasted on the app', () => {
    const wrapper = mount(PictureDropOverlay, { props: { disabled: false } })
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { files: [png] } })
    document.dispatchEvent(event)
    expect(wrapper.emitted('picture')).toEqual([[png]])
  })
})
