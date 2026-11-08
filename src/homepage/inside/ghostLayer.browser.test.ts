import { afterEach, describe, expect, it } from 'vitest'
import { keepAboveMenus } from './ghostLayer'

// The ghost above the demo editor's menus and pickers (ticket 0820): they open in the top layer, and so does it, last.

/** A box at the page's corner with a ghost layer over it and a menu that opens over the layer. */
function demoBox() {
  const box = document.createElement('div')
  Object.assign(box.style, { position: 'absolute', left: '40px', top: '30px', width: '200px', height: '120px', contain: 'layout paint' })
  // As the ghost's own layer is drawn, except that it takes presses, so the point test finds what paints on top.
  const sheet = document.createElement('style')
  sheet.textContent = `.layer { position: absolute; inset: 0; display: block; width: auto; height: auto; margin: 0; padding: 0;
    border: 0; background: none } .layer:popover-open { position: fixed; inset: auto }`
  const layer = document.createElement('div')
  layer.className = 'layer'
  layer.setAttribute('popover', 'manual')
  const menu = document.createElement('div')
  menu.setAttribute('popover', 'manual')
  Object.assign(menu.style, { inset: 'auto', left: '60px', top: '50px', width: '80px', height: '60px', margin: '0' })
  box.append(menu, layer)
  document.body.append(sheet, box)
  return { box, layer, menu, stop: keepAboveMenus(layer, box) }
}

/** What paints on top at a point of the menu. */
const onTop = () => document.elementFromPoint(100, 80)

/** Whether the layer is in the top layer, polled: a popover's `toggle` comes a task after it opens or closes. */
const raised = (layer: HTMLElement) => expect.poll(() => layer.matches(':popover-open'))

afterEach(() => {
  document.body.innerHTML = ''
})

describe("What's inside's ghost above the editor's menus (ticket 0820)", () => {
  it('stays in the box, under nothing, while no menu is open', () => {
    const { layer } = demoBox()
    expect(layer.matches(':popover-open')).toBe(false)
    expect(layer.getBoundingClientRect()).toMatchObject({ left: 40, top: 30, width: 200, height: 120 })
  })

  it('joins an opened menu in the top layer, over it and over the box, and leaves once it closes', async () => {
    const { layer, menu } = demoBox()
    menu.showPopover()
    await raised(layer).toBe(true)
    expect(onTop()).toBe(layer)
    expect(layer.getBoundingClientRect()).toMatchObject({ left: 40, top: 30, width: 200, height: 120 })
    menu.hidePopover()
    await raised(layer).toBe(false)
    expect(layer.getBoundingClientRect()).toMatchObject({ left: 40, top: 30, width: 200, height: 120 })
  })

  it('leaves the top layer once the menu is taken out of the page, which closes it without a toggle', async () => {
    const { layer, menu } = demoBox()
    menu.showPopover()
    await raised(layer).toBe(true)
    menu.remove()
    await raised(layer).toBe(false)
  })

  it('goes back over a second menu that opens over it', async () => {
    const { box, layer, menu } = demoBox()
    menu.showPopover()
    await raised(layer).toBe(true)
    const picker = menu.cloneNode() as HTMLElement
    box.append(picker)
    picker.showPopover()
    await expect.poll(onTop).toBe(layer)
  })
})
