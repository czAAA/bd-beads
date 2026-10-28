import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StarterSetup from './StarterSetup.vue'
import { createProject, type Project } from '../../domain/project'
import { starterById, type StarterId } from '../../domain/starters'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const mountSetup = (id: StarterId, project?: Project) => mount(StarterSetup, { props: { starter: starterById(id), ...(project ? { project } : {}) }, attachTo: document.body })
type Setup = ReturnType<typeof mountSetup>
const text = (wrapper: Setup, testId: string) => wrapper.get(`[data-testid="${testId}"]`).text()
const design = (wrapper: Setup) => wrapper.get('[data-testid="starter-design"] [aria-checked="true"]').text()

describe('the Starter setup', () => {
  it('opens on the design at its own size: the picture named for it, Name, Bead, the size and its Estimated size', () => {
    const wrapper = mountSetup('triangle')
    expect(wrapper.get('[data-testid="starter-setup-picture"]').attributes()).toMatchObject({ role: 'img', 'aria-label': 'Triangle, with design' })
    expect(wrapper.get('[data-testid="starter-name-input"]').attributes('placeholder')).toBe('Triangle')
    expect(wrapper.find('[data-testid="starter-bead-picker"]').exists()).toBe(true)
    expect(design(wrapper)).toBe(en.starters.useDesign)
    expect(text(wrapper, 'starter-size-value-rounds')).toBe('10')
    expect(text(wrapper, 'starter-size-label-rounds')).toContain('Rounds')
    expect(text(wrapper, 'starter-size-label-rounds')).toContain('from the centre')
    expect(wrapper.get('[data-testid="starter-size-preset-rounds-10"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="starter-size-preset-rounds-10"]').text()).toContain(en.starters.designSize)
    expect(wrapper.find('[data-testid="starter-size-preset-rounds-8"]').text()).not.toContain(en.starters.designSize)
    expect(text(wrapper, 'starter-estimate')).toMatch(/cm|mm/)
    expect(text(wrapper, 'starter-count')).toBe('165 beads')
    expect(wrapper.find('[data-testid="starter-design-note"]').exists()).toBe(false)
  })

  it('turns Use design off when the size changes, naming the design\'s size, and on again when it is set back', async () => {
    const wrapper = mountSetup('triangle')
    await wrapper.get('[data-testid="starter-size-preset-rounds-12"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.startEmpty)
    expect(text(wrapper, 'starter-design-note')).toBe('The design is made for 10 rounds. Set it back to turn the design on.')
    expect(wrapper.get('[data-testid="starter-setup-picture"]').attributes('aria-label')).toBe('Triangle, empty shape with seams')
    expect(text(wrapper, 'starter-count')).toBe('234 beads')
    await wrapper.get('[data-testid="starter-size-decrease-rounds"]').trigger('click')
    await wrapper.get('[data-testid="starter-size-decrease-rounds"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.useDesign)
    expect(wrapper.find('[data-testid="starter-design-note"]').exists()).toBe(false)
  })

  it('keeps Start empty when chosen, saying what it leaves, and puts back the design\'s size on Use design', async () => {
    const wrapper = mountSetup('star')
    await wrapper.get('[data-testid="starter-design"] [role="radio"]:last-child').trigger('click')
    expect(text(wrapper, 'starter-design-note')).toBe(en.starters.emptyNote)
    await wrapper.get('[data-testid="starter-size-preset-partSize-7"]').trigger('click')
    expect(text(wrapper, 'starter-design-note')).toBe(en.starters.emptyNote)
    await wrapper.get('[data-testid="starter-size-preset-partSize-5"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.startEmpty)
    await wrapper.get('[data-testid="starter-size-preset-partSize-9"]').trigger('click')
    await wrapper.get('[data-testid="starter-design"] [role="radio"]:first-child').trigger('click')
    expect(text(wrapper, 'starter-size-value-partSize')).toBe('5')
    expect(design(wrapper)).toBe(en.starters.useDesign)
  })

  it('asks for the Starter, its size and design, the name typed or else the Starter\'s, and the Bead chosen', async () => {
    const wrapper = mountSetup('kite')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('[data-testid="starter-name-input"]').setValue('  Wings ')
    await wrapper.get('[data-testid="starter-size-increase-rows"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([
      [{ sizes: { rows: 21 }, picks: {}, useDesign: true, name: 'Kite', beadId: expect.any(String) }],
      [{ sizes: { rows: 22 }, picks: {}, useDesign: false, name: 'Wings', beadId: expect.any(String) }],
    ])
  })

  it('on an open Project asks no Name or Bead, and measures with the Project\'s own Bead', () => {
    const project = createProject({ technique: 'loom', beadId: 'miyuki/delica/11-0', name: 'Open' })
    const wrapper = mountSetup('warpedSquare', project)
    expect(wrapper.find('[data-testid="starter-name-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="starter-bead-picker"]').exists()).toBe(false)
    expect(text(wrapper, 'starter-estimate')).toMatch(/cm|mm/)
    expect(text(wrapper, 'starter-count')).toBe('144 beads')
  })

  it('sets an earring\'s top and fringe, its Fringe style a choice that Choose it again turns back on (ticket 0597)', async () => {
    const wrapper = mountSetup('vFringe')
    expect(['topWidth', 'topRows', 'fringeLength'].map((name) => text(wrapper, `starter-size-value-${name}`))).toEqual(['7', '6', '12'])
    expect(text(wrapper, 'starter-size-label-topWidth')).toContain('beads in the base row')
    // The card's order: Top width, Top rows, Fringe style, Fringe length.
    const order = wrapper.findAll('[data-testid^="starter-size-label-"], [data-testid^="starter-pick-"]').map((each) => each.attributes('data-testid'))
    expect(order).toEqual(['starter-size-label-topWidth', 'starter-size-label-topRows', 'starter-pick-fringeStyle', 'starter-size-label-fringeLength'])
    expect(text(wrapper, 'starter-count')).toBe('87 beads each · 174 for the pair')
    await wrapper.get('[data-testid="starter-pick-fringeStyle"] [data-value="straight"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.startEmpty)
    expect(text(wrapper, 'starter-design-note')).toBe('The design is made for V fringe. Choose it again to turn the design on.')
    await wrapper.get('[data-testid="starter-pick-fringeStyle"] [data-value="v"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.useDesign)
  })

  it('keeps an earring\'s Top rows below its Top width, and offers only the chips allowed', async () => {
    const wrapper = mountSetup('straightFringe')
    await wrapper.get('[data-testid="starter-size-preset-topWidth-5"]').trigger('click')
    expect(text(wrapper, 'starter-size-value-topRows')).toBe('4')
    expect(wrapper.findAll('[data-testid^="starter-size-preset-topRows-"]').map((chip) => chip.text())).toEqual(['4'])
    expect(text(wrapper, 'starter-design-note')).toBe('The design is made for top 7, 6 top rows. Set it back to turn the design on.')
  })

  /** An open Project on Delica 11/0, the Bead the StarterGallery card measures with. */
  const delica = () => createProject({ technique: 'loom', beadId: 'miyuki/delica/11-0', name: 'Open' })

  it('sizes a Ring by Width and Ring size in EU or US, with its inside, its width and its rows round', async () => {
    const wrapper = mountSetup('ringChevrons', delica())
    expect(text(wrapper, 'starter-size-value-ringSize')).toBe('54')
    expect(text(wrapper, 'starter-size-label-ringSize')).toContain('mm round the finger')
    expect(text(wrapper, 'starter-estimate')).toBe('ø 17.2 mm inside · 9.1 mm wide')
    expect(text(wrapper, 'starter-count')).toBe('≈ 252 beads · 72 rows round')
    await wrapper.get('[data-testid="starter-size-system"] [data-value="us"]').trigger('click')
    expect(text(wrapper, 'starter-size-value-ringSize')).toBe('7')
    expect(text(wrapper, 'starter-size-label-ringSize')).toContain('us size')
    expect(wrapper.findAll('[data-testid^="starter-size-preset-ringSize-"]').map((chip) => chip.text().replace(en.starters.designSize, '').trim())).toEqual(['5', '6', '7', '8', '9'])
    // The Size system is a view, not a size: the design stays on.
    expect(design(wrapper)).toBe(en.starters.useDesign)
    await wrapper.get('[data-testid="starter-size-increase-ringSize"]').trigger('click')
    expect(text(wrapper, 'starter-size-value-ringSize')).toBe('7.5')
    expect(text(wrapper, 'starter-design-note')).toBe('The design is made for eu 54. Set it back to turn the design on.')
    await wrapper.get('[data-testid="starter-size-preset-ringSize-7"]').trigger('click')
    expect(design(wrapper)).toBe(en.starters.useDesign)
    // Back in EU, the size is the whole EU size the US one came to.
    await wrapper.get('[data-testid="starter-size-system"] [data-value="eu"]').trigger('click')
    expect(text(wrapper, 'starter-size-value-ringSize')).toBe('54')
  })

  it('sizes a Band by Width, Wrist and Fit, with its length less the clasp and its rows', async () => {
    const wrapper = mountSetup('bandPlaid', delica())
    expect(text(wrapper, 'starter-estimate')).toBe('1.4 × 16.0 cm')
    // Counts group their thousands as the app writes numbers.
    expect(text(wrapper, 'starter-count')).toMatch(/^≈ 1\s100 beads · 200 rows · 1\.5 cm left for the clasp$/)
    await wrapper.get('[data-testid="starter-pick-fit"] [data-value="loose"]').trigger('click')
    expect(text(wrapper, 'starter-estimate')).toBe('1.4 × 16.5 cm')
    expect(text(wrapper, 'starter-design-note')).toBe('The design is made for Comfortable. Choose it again to turn the design on.')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ sizes: { width: 11, wrist: 16 }, picks: { fit: 'loose' }, useDesign: false })
  })
})
