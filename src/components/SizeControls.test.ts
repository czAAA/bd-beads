import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SizeControls from './SizeControls.vue'
import { findBead } from '../domain/beads'
import { createPattern, moveToRow, setRowProgressEnabled, toggleRotated, type Pattern, type Technique } from '../domain/pattern'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

function pattern(
  columns: number,
  rows: number,
  { bead = 'toho-cube-1.5mm', technique = 'loom' }: { bead?: string; technique?: Technique } = {},
): Pattern {
  return createPattern({ technique, beadId: bead, size: { width: columns, height: rows, unit: 'beads' } })
}

function mountControls(target: Pattern) {
  return mount(SizeControls, { props: { pattern: target } })
}

const estimate = (wrapper: ReturnType<typeof mountControls>) => wrapper.find('[data-testid="size-estimate"]').text()
const changeSizeButton = (wrapper: ReturnType<typeof mountControls>) =>
  wrapper.find<HTMLButtonElement>('[data-testid="size-change-size"]')

describe('SizeControls Estimated size (ticket 98)', () => {
  it('shows the estimate for TOHO Cube 1.5mm: columns x 1.5mm, rows x 1.5mm', () => {
    expect(estimate(mountControls(pattern(10, 20)))).toBe('≈ 1.5 × 3.0 cm')
  })

  it("shows the estimate for TOHO Round 11/0 with its 0.15mm width correction in every column", () => {
    // 9 columns x 1.65mm = 14.85mm, 14 rows x 2.2mm = 30.8mm. Without the correction it would read 1.4 (13.5mm).
    expect(estimate(mountControls(pattern(9, 14, { bead: 'toho-round-11-0' })))).toBe('≈ 1.5 × 3.1 cm')
  })

  it('shows the estimate for Miyuki Delica 11/0: wider than tall', () => {
    expect(estimate(mountControls(pattern(20, 10, { bead: 'miyuki-delica-11-0' })))).toBe('≈ 3.2 × 1.3 cm')
  })

  it('is not technique-aware: peyote and brick stitch read the same as loom (ADR 0017)', () => {
    const loom = estimate(mountControls(pattern(10, 20)))

    expect(estimate(mountControls(pattern(10, 20, { technique: 'peyote' })))).toBe(loom)
    expect(estimate(mountControls(pattern(10, 20, { technique: 'brick' })))).toBe(loom)
  })

  it('switches to mm as soon as either side is under 10mm', () => {
    expect(estimate(mountControls(pattern(6, 20)))).toBe('≈ 9 × 30 mm')
    expect(estimate(mountControls(pattern(20, 6)))).toBe('≈ 30 × 9 mm')
  })

  it('stays in cm at exactly 10mm, and a side just under it goes to mm', () => {
    // 20 Delica columns is 32mm; 10 rows at 1.3mm is 13mm; 7 rows is 9.1mm.
    expect(estimate(mountControls(pattern(20, 10, { bead: 'miyuki-delica-11-0' })))).toContain('cm')
    expect(estimate(mountControls(pattern(20, 7, { bead: 'miyuki-delica-11-0' })))).toBe('≈ 32 × 9.1 mm')
    // 10 cube rows is exactly 15mm; 7 columns is 10.5mm.
    expect(estimate(mountControls(pattern(7, 7)))).toBe('≈ 1.1 × 1.1 cm')
  })

  it('follows the rotated view: rotating swaps width and height', () => {
    const upright = pattern(10, 20)

    expect(estimate(mountControls(upright))).toBe('≈ 1.5 × 3.0 cm')
    expect(estimate(mountControls(toggleRotated(upright)))).toBe('≈ 3.0 × 1.5 cm')
  })

  it('follows the app language for the unit label and decimal sign (writing.md)', () => {
    localStorage.setItem('bd-beads:locale', 'ru')

    expect(estimate(mountControls(pattern(10, 20)))).toBe('≈ 1,5 × 3,0 см')
    expect(estimate(mountControls(pattern(6, 20)))).toBe('≈ 9 × 30 мм')
  })

  it('updates when the Pattern’s Bead changes', async () => {
    const wrapper = mountControls(pattern(10, 20))
    expect(estimate(wrapper)).toBe('≈ 1.5 × 3.0 cm')

    await wrapper.setProps({ pattern: { ...pattern(10, 20), beadId: 'toho-round-11-0' } })

    expect(estimate(wrapper)).toBe('≈ 1.7 × 4.4 cm')
  })

  it('shows no estimate for a Bead the catalog does not have, rather than guessing', () => {
    const wrapper = mountControls({ ...pattern(10, 20), beadId: 'from-another-device' })

    expect(wrapper.find('[data-testid="size-estimate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="size-estimate-info"]').exists()).toBe(false)
  })
})

describe('SizeControls warning tooltip (ticket 98)', () => {
  const info = (wrapper: ReturnType<typeof mountControls>) => wrapper.find('[data-testid="size-estimate-info"]')
  const tooltip = (wrapper: ReturnType<typeof mountControls>) => wrapper.find('[data-testid="size-estimate-tooltip"]')
  // Read off v-show's own inline style: the wrapper's isVisible() goes through jsdom's computed-style cache, which goes stale here.
  const open = (wrapper: ReturnType<typeof mountControls>) => !tooltip(wrapper).attributes('style')?.includes('display: none')

  it('is closed until asked for', () => {
    expect(open(mountControls(pattern(10, 20)))).toBe(false)
  })

  it('opens on hover and closes when the pointer leaves', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await info(wrapper).trigger('mouseenter')
    expect(open(wrapper)).toBe(true)

    await info(wrapper).trigger('mouseleave')
    expect(open(wrapper)).toBe(false)
  })

  it('also opens on keyboard focus, not on hover only, and closes on blur', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await info(wrapper).trigger('focus')
    expect(open(wrapper)).toBe(true)

    await info(wrapper).trigger('blur')
    expect(open(wrapper)).toBe(false)
  })

  it('closes on Escape while it has focus', async () => {
    const wrapper = mountControls(pattern(10, 20))
    await info(wrapper).trigger('focus')

    await info(wrapper).trigger('keydown', { key: 'Escape' })

    expect(open(wrapper)).toBe(false)
  })

  it('is described to assistive technology by the icon it belongs to', () => {
    const wrapper = mountControls(pattern(10, 20))

    expect(info(wrapper).attributes('aria-describedby')).toBe(tooltip(wrapper).attributes('id'))
    expect(tooltip(wrapper).attributes('role')).toBe('tooltip')
    expect(info(wrapper).attributes('aria-label')).toBe(en.size.estimateInfoButton)
    expect(info(wrapper).element.tagName).toBe('BUTTON')
  })

  it('says it is an estimate, in both languages', () => {
    const wrapper = mountControls(pattern(10, 20))
    expect(tooltip(wrapper).text()).toBe(en.size.estimateWarning)
    expect(en.size.estimateWarning).toContain('These sizes are an estimate.')

    localStorage.setItem('bd-beads:locale', 'ru')
    expect(tooltip(mountControls(pattern(10, 20))).text()).toBe(ru.size.estimateWarning)
  })
})

describe('SizeControls Change size button (ticket 172)', () => {
  it('has no stepper controls left, only the button that opens Change size', () => {
    const wrapper = mountControls(pattern(10, 20))

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.findAll('button').map((button) => button.attributes('data-testid'))).toEqual([
      'size-estimate-info',
      'size-change-size',
    ])
  })

  it('has an ellipsis-free, verb-based label naming both size and unit', () => {
    const wrapper = mountControls(pattern(10, 20))

    expect(changeSizeButton(wrapper).text()).toBe(en.changeSize.button)
    expect(en.changeSize.button).not.toContain('…')
  })

  it('emits change-size when clicked', async () => {
    const wrapper = mountControls(pattern(10, 20))

    await changeSizeButton(wrapper).trigger('click')

    expect(wrapper.emitted('change-size')).toHaveLength(1)
  })

  it('is disabled (via aria-disabled, to stay reachable) while Row progress is on, with the reason on hover and focus', () => {
    const wrapper = mountControls(setRowProgressEnabled(moveToRow(pattern(10, 20), 3), true))

    expect(changeSizeButton(wrapper).attributes('aria-disabled')).toBe('true')
    expect(changeSizeButton(wrapper).attributes('title')).toBe(en.size.lockedReason)
    expect(wrapper.find('[data-testid="size-change-size-locked"]').text()).toBe(en.size.lockedReason)
  })

  it('does not emit change-size while locked', async () => {
    const wrapper = mountControls(setRowProgressEnabled(moveToRow(pattern(10, 20), 3), true))

    await changeSizeButton(wrapper).trigger('click')

    expect(wrapper.emitted('change-size')).toBeUndefined()
  })

  it('re-enables once Row progress is off, with no reason shown', async () => {
    const woven = setRowProgressEnabled(moveToRow(pattern(10, 20), 3), true)
    const wrapper = mountControls(woven)

    await wrapper.setProps({ pattern: setRowProgressEnabled(woven, false) })

    expect(changeSizeButton(wrapper).attributes('aria-disabled')).toBe('false')
    expect(wrapper.find('[data-testid="size-change-size-locked"]').exists()).toBe(false)
  })
})

describe('the bead catalog', () => {
  it('has the three Beads the estimate tests above lean on', () => {
    for (const id of ['toho-cube-1.5mm', 'toho-round-11-0', 'miyuki-delica-11-0']) {
      expect(findBead(id)).toBeDefined()
    }
  })
})
