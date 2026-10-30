import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SchemaTags from './SchemaTags.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import type { SchemaAnchor } from '../../composables/canvas/schemaTagPlacement'
import { withColors } from '../../domain/canvas'
import { createProject } from '../../domain/createProject'
import { projectPalette } from '../../domain/palette'
import { withPieceName } from '../../domain/pieceNames'
import type { Project } from '../../domain/project'
import { withLayers } from '../../testUtils/layerFields'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const [red, blue] = projectPalette(base).colors.map((color) => color.hex)
/** Two unframed Schemas: "Owl", 3 × 2 beads in two colors, and "Butterfly" below it. */
const project: Project = withPieceName(
  withPieceName(
    withLayers(base, {
      beads: withColors({}, [
        ...[0, 1, 2].map((column) => ({ row: 0, column, color: red })),
        ...[0, 1, 2].map((column) => ({ row: 1, column, color: blue })),
        { row: 10, column: 0, color: red },
      ]),
    }),
    { row: 0, column: 0 },
    'Owl',
  ),
  { row: 10, column: 0 },
  'Butterfly',
)
const owl: SchemaAnchor = { name: 'Owl', anchor: { row: 0, column: 0 }, piece: { row: 0, column: 0, rows: 2, columns: 3 }, box: { left: 100, top: 100, width: 60, height: 40 } }
const butterfly: SchemaAnchor = { name: 'Butterfly', anchor: { row: 10, column: 0 }, piece: { row: 10, column: 0, rows: 1, columns: 1 }, box: { left: 100, top: 300, width: 20, height: 20 } }
const viewport = { width: 800, height: 600 }

function mountTags(schemas: SchemaAnchor[] = [butterfly, owl]) {
  return mount(SchemaTags, { props: { project, anchors: { schemas, viewport } }, attachTo: document.body })
}
const tagOf = (wrapper: ReturnType<typeof mountTags>, name: string) => wrapper.findAll('[data-testid="schema-tag"]').find((tag) => tag.attributes('aria-label')!.startsWith(name))!

describe('SchemaTags', () => {
  it('writes a short name on its tag and folds a longer one to three dots, which alone has a Tooltip', () => {
    const wrapper = mountTags()

    expect(tagOf(wrapper, 'Owl').text()).toBe('Owl')
    expect(tagOf(wrapper, 'Butterfly').text()).toBe('')
    expect(tagOf(wrapper, 'Butterfly').findAll('i')).toHaveLength(3)
    expect(wrapper.findAllComponents(AppTooltip).map((tip) => tip.props())).toEqual([expect.objectContaining({ name: 'Butterfly', body: 'Click for the size and colors.' })])
    wrapper.unmount()
  })

  it('names each tag a button that shows details, one Tab stop in reading order, the arrows moving between them', async () => {
    const wrapper = mountTags()
    const tags = wrapper.findAll('[data-testid="schema-tag"]')

    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Schema names')
    expect(tags.map((tag) => tag.attributes('aria-label'))).toEqual(['Owl, show details', 'Butterfly, show details'])
    expect(tags.map((tag) => tag.attributes('tabindex'))).toEqual(['0', '-1'])
    ;(tags[0].element as HTMLElement).focus()
    await tags[0].trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(tags[1].element)
    wrapper.unmount()
  })

  it('opens the paper tag with the Schema\'s name, size and counts, focus in it, and the tag hidden and expanded', async () => {
    const wrapper = mountTags()
    await tagOf(wrapper, 'Owl').trigger('click')
    await nextTick()
    const card = wrapper.get('[data-testid="schema-card"]')

    expect(card.attributes('role')).toBe('dialog')
    expect(card.attributes('aria-label')).toBe('Owl')
    expect(card.attributes('aria-modal')).toBeUndefined()
    expect(card.text()).toContain('schema')
    expect(card.get('[data-testid="schema-card-size"]').text()).toBe('3 × 2 beads · ≈ 4.5 × 3 mm')
    expect(card.get('[data-testid="schema-card-counts"]').text()).toBe('6 beads · 2 colors')
    expect(card.findAll('.schema-card__swatches i')).toHaveLength(2)
    expect(tagOf(wrapper, 'Owl').attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(card.element)
    wrapper.unmount()
  })

  it('keeps one paper tag open at a time', async () => {
    const wrapper = mountTags()
    await tagOf(wrapper, 'Owl').trigger('click')
    await tagOf(wrapper, 'Butterfly').trigger('click')

    expect(wrapper.findAll('[data-testid="schema-card"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="schema-card"]').attributes('aria-label')).toBe('Butterfly')
    wrapper.unmount()
  })

  it('closes on its close button and on Escape, focus going back to the tag', async () => {
    const wrapper = mountTags()
    await tagOf(wrapper, 'Owl').trigger('click')
    await wrapper.get('[data-testid="schema-card-close"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="schema-card"]').exists()).toBe(false)
    expect(document.activeElement).toBe(tagOf(wrapper, 'Owl').element)

    await tagOf(wrapper, 'Owl').trigger('click')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(wrapper.find('[data-testid="schema-card"]').exists()).toBe(false)
    expect(document.activeElement).toBe(tagOf(wrapper, 'Owl').element)
    wrapper.unmount()
  })

  it('closes on a press outside, which still goes on to what is under it', async () => {
    const wrapper = mountTags()
    const canvas = document.createElement('div')
    document.body.append(canvas)
    let pressed = false
    canvas.addEventListener('pointerdown', () => (pressed = true))
    await tagOf(wrapper, 'Owl').trigger('click')

    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    await nextTick()

    expect(wrapper.find('[data-testid="schema-card"]').exists()).toBe(false)
    expect(pressed).toBe(true)
    wrapper.unmount()
    canvas.remove()
  })

  it('closes once its Schema is framed, erased or unnamed: gone from the unframed Schemas', async () => {
    const wrapper = mountTags()
    await tagOf(wrapper, 'Owl').trigger('click')

    await wrapper.setProps({ anchors: { schemas: [butterfly], viewport } })

    expect(wrapper.find('[data-testid="schema-card"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('asks for Rename and Frame on its Schema', async () => {
    const wrapper = mountTags()
    await tagOf(wrapper, 'Owl').trigger('click')
    await wrapper.get('[data-testid="schema-card-rename"]').trigger('click')
    await wrapper.get('[data-testid="schema-card-frame"]').trigger('click')

    expect(wrapper.emitted('rename')).toEqual([[{ row: 0, column: 0 }]])
    expect(wrapper.emitted('frame')).toEqual([[{ row: 0, column: 0, rows: 2, columns: 3 }]])
    wrapper.unmount()
  })

  it('shows no tag for a Schema whose corner is out of view', () => {
    const wrapper = mountTags([{ ...owl, box: { ...owl.box, top: 700 } }])

    expect(wrapper.findAll('[data-testid="schema-tag"]')).toHaveLength(0)
    wrapper.unmount()
  })
})
