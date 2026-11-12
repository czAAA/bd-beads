import { afterEach, describe, expect, it } from 'vitest'
import { watchOnly } from './watchOnly'

/** A box like the demo's: a strip with a few controls and Expand among them, a drawing area and a panel. */
function demoBox(): HTMLElement {
  const box = document.createElement('div')
  box.innerHTML = `
    <div class="shell">
      <div class="strip">
        <button class="menu">Menu</button>
        <div class="controls"><button class="expand">Expand</button><button class="undo">Undo</button></div>
      </div>
      <div class="area"><canvas></canvas></div>
    </div>
    <div class="panel"><button>Close</button></div>`
  document.body.append(box)
  return box
}

/** Whether an element is inert, by its own attribute or a box it lies in. */
const isInert = (element: Element) => element.closest('[inert]') !== null
const inert = (box: HTMLElement, selector: string) => isInert(box.querySelector(selector)!)

let stop: (() => void) | undefined
afterEach(() => {
  stop?.()
  document.body.innerHTML = ''
})

describe("What's inside's demo is only to watch (ticket 0879)", () => {
  it('makes everything in it inert but the kept control and the boxes it lies in', () => {
    const box = demoBox()
    stop = watchOnly(box, '.expand')
    for (const selector of ['.menu', '.undo', '.area', '.panel']) expect(inert(box, selector), selector).toBe(true)
    for (const selector of ['.shell', '.strip', '.controls', '.expand']) expect(inert(box, selector), selector).toBe(false)
  })

  it('makes it all inert with nothing kept', () => {
    const box = demoBox()
    box.querySelector('.expand')!.remove()
    stop = watchOnly(box, '.expand')
    expect(inert(box, '.shell')).toBe(true)
    expect(inert(box, '.panel')).toBe(true)
  })

  it('keeps up as the ghost opens things in it and the kept control comes and goes', async () => {
    const box = demoBox()
    stop = watchOnly(box, '.expand')
    const popover = document.createElement('div')
    box.append(popover)
    const tooltip = document.createElement('span')
    box.querySelector('.controls')!.append(tooltip)
    const expand = box.querySelector('.expand')!
    expand.remove()
    await Promise.resolve()
    expect(isInert(popover)).toBe(true)
    expect(isInert(tooltip)).toBe(true)
    expect(inert(box, '.shell')).toBe(true)

    box.querySelector('.controls')!.prepend(expand)
    await Promise.resolve()
    expect(inert(box, '.shell')).toBe(false)
    expect(inert(box, '.expand')).toBe(false)
    expect(inert(box, '.undo')).toBe(true)
  })
})
