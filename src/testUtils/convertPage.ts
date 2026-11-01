import { defineComponent, h, type PropType } from 'vue'
import ConvertImageWizard from '../components/import/ConvertImageWizard.vue'
import ConvertStepBar from '../components/import/ConvertStepBar.vue'
import { useConvertImageWizard } from '../composables/import/useConvertImageWizard'
import type { ColorCatalog } from '../domain/colorCatalog'
import type { CreateProjectInput } from '../domain/createProject'
import type { DecodeImage } from '../domain/imageConversion'

/** Convert image as the canvas box shows it (ticket 0756): the page over its Progress bar, in a box as tall as the
 * screen, for a test that mounts it on its own. The wizard is made here as the flow's session makes it. */
export const ConvertPageHost = defineComponent({
  props: {
    start: { type: Object as PropType<{ draft: CreateProjectInput; file?: File }>, required: true },
    decodeImage: { type: Function as PropType<DecodeImage>, required: true },
    loadCatalog: { type: Function as PropType<(id: string) => Promise<ColorCatalog | undefined>>, required: true },
    readClipboardImage: { type: Function as PropType<() => Promise<File | undefined>>, required: true },
  },
  setup(props) {
    const wizard = useConvertImageWizard({ start: props.start.draft, decodeImage: props.decodeImage, loadCatalog: props.loadCatalog as (id: string) => Promise<ColorCatalog> })
    if (props.start.file) void wizard.setFile(props.start.file)
    return () =>
      h('div', { style: 'display:grid;grid-template-rows:minmax(0,1fr) auto;height:100dvh;background:var(--box)' }, [
        h(ConvertImageWizard, { wizard, readClipboardImage: props.readClipboardImage }),
        h(ConvertStepBar, { wizard }),
      ])
  },
})
