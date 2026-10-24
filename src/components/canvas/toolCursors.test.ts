import { describe, expect, it } from 'vitest'
import { toolPointer, toolPointerImage } from './toolCursors'

const svgOf = (value: string) => decodeURIComponent(/data:image\/svg\+xml,([^"]+)/.exec(value)![1])

describe('toolPointer', () => {
  it('is the tool’s file with its hot spot and the system cursor as fallback', () => {
    expect(toolPointer('select')).toMatch(/^url\("data:image\/svg\+xml,.+"\) 4 3, default$/)
    expect(toolPointer('hand')).toMatch(/ 11 12, grab$/)
    expect(toolPointer('paint', { color: '#ff0000' })).toMatch(/ 5 19, crosshair$/)
  })

  it('writes the current colour into the bead of Paint and Fill', () => {
    expect(svgOf(toolPointer('paint', { color: '#ff0000' }))).toContain('fill="#ff0000"')
    expect(svgOf(toolPointer('fill', { color: '#00ff00' }))).toContain('fill="#00ff00"')
  })

  it('leaves the bead out when no colour is chosen, or the colour is not a hex', () => {
    for (const color of [null, undefined, 'red"><script>']) {
      const svg = svgOf(toolPointer('paint', { color }))
      expect(svg).not.toContain('<rect')
      expect(svg).not.toContain('currentColor')
    }
  })

  it('shows the closed hand only for Hand while it drags', () => {
    expect(toolPointer('hand', { dragging: true })).toMatch(/ 11 12, grabbing$/)
    expect(toolPointer('hand', { dragging: true })).not.toBe(toolPointer('hand'))
    expect(toolPointer('select', { dragging: true })).toBe(toolPointer('select'))
  })
})

describe('toolPointerImage', () => {
  it('is the same file and hot spot as the CSS value, as a plain image', () => {
    const { url, hotSpot } = toolPointerImage('paint', { color: '#ff0000' })
    expect(hotSpot).toEqual([5, 19])
    expect(toolPointer('paint', { color: '#ff0000' })).toContain(`url("${url}") 5 19`)
  })
})
