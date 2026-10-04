import { computed, ref } from 'vue'
import { PALETTE, normalizeHex, type PaletteColor } from '../../domain/palette'
import type { Tool } from '../../domain/tool'

/** Red is the Palette's first swatch and its default: a Project almost always opens ready to paint, not on a dead click-a-color-first step. */
export const DEFAULT_PALETTE_COLOR_ID = 'red'

/** What choosing a tool needs from the app shell: leaving Select forgets what it was holding. */
export interface ToolAndColorDeps {
  leaveSelectTool: () => void
  /** The Palette as it stands, built-in and added swatches; the built-in colors alone when omitted. */
  palette?: () => readonly PaletteColor[]
  /** Called whenever a tool is chosen, even the one already active: choosing a tool ends Set Frame. */
  onToolChosen?: () => void
}

/**
 * The active tool and the paint color (tickets 58, 171, 206; ADR 0023): which of the four tools is active, and which
 * of the three mutually exclusive paint colors — a Palette swatch, an Image color or the Custom color — is chosen.
 * Deps are read lazily.
 */
export function useToolAndColor(deps: ToolAndColorDeps) {
  const palette = () => deps.palette?.() ?? PALETTE
  const selectedColorId = ref<string | undefined>(DEFAULT_PALETTE_COLOR_ID)

  /**
   * The last Custom color chosen (CONTEXT.md's Custom color): a one-off hex outside the Palette. Kept on its Toolbox
   * slot for the rest of the session even once a Palette swatch deselects it — replaced only by a new Custom color,
   * gone on reload since it's never persisted. It's the paint color exactly when selectedColorId is unset; the two are
   * kept mutually exclusive by onSelectColor/onSelectCustomColor below, the same way PalettePicker's own selection is
   * a single id rather than a parallel flag per swatch.
   */
  const customColor = ref<string | undefined>(undefined)

  /**
   * The Image color being painted with (CONTEXT.md's Image colors, ticket 58): one of the open Project's own converted
   * colors, offered in the Colors group alongside the Palette. The third of three mutually exclusive paint colors,
   * kept exclusive by the onSelect* handlers below, and reset on a Project switch since a hex from one Project's
   * conversion means nothing in another.
   */
  const selectedImageColor = ref<string | undefined>(undefined)

  const activeTool = ref<Tool>('paint')

  /** The current paint color's hex: the selected Palette color, the selected Image color, or the Custom color — whichever of the three is active; null when none is. */
  function selectedColorHex(): string | null {
    if (selectedColorId.value) {
      return palette().find((color) => color.id === selectedColorId.value)?.hex ?? null
    }
    return selectedImageColor.value ?? customColor.value ?? null
  }

  /** The color the hover preview shows; null (a neutral outline, not a color) when nothing is selected. */
  const previewColor = computed(() => selectedColorHex())

  function onSelectTool(tool: Tool) {
    deps.onToolChosen?.()
    /*
     * Leaving Select forgets what it was holding. The marquee is noise once you're painting rather than selecting,
     * and a clipboard that outlived its marquee would be invisible state: coming back to Select and clicking would
     * stamp a block out of nowhere. Re-choosing Select while it's already active leaves both alone.
     */
    if (tool !== 'select') {
      deps.leaveSelectTool()
    }

    activeTool.value = tool
  }

  /** Picking a color while any other tool is active switches to Paint (ticket 171): the point of picking a color is to paint with it. */
  function switchToPaintOnColorPick() {
    if (activeTool.value !== 'paint') {
      onSelectTool('paint')
    }
  }

  /** Choosing a Palette swatch deselects Custom color and any Image color (CONTEXT.md); the Custom slot keeps showing its last hex, just unselected. */
  function onSelectColor(colorId: string) {
    selectedColorId.value = colorId
    selectedImageColor.value = undefined
    switchToPaintOnColorPick()
  }

  /** Choosing a Custom color makes it the paint color and deselects whichever Palette swatch or Image color was active, vice versa. */
  function onSelectCustomColor(hex: string) {
    customColor.value = hex
    // A hex the Palette already has (built-in, or added earlier) just selects that swatch (ticket 227).
    const match = palette().find((color) => color.hex === normalizeHex(hex))
    if (match) {
      onSelectColor(match.id)
      return
    }
    selectedColorId.value = undefined
    selectedImageColor.value = undefined
    switchToPaintOnColorPick()
  }

  /** The Custom color just joined the Palette (ticket 227): its new swatch is now the selected one, with no tool switch since it was already painting. */
  function onCustomColorAdded(colorId: string) {
    selectedColorId.value = colorId
  }

  /** Choosing one of the open Project's Image colors (ticket 58) paints with it, the same way a Palette swatch does; the Custom slot keeps its own last hex, unselected. */
  function onSelectImageColor(hex: string) {
    selectedImageColor.value = hex
    selectedColorId.value = undefined
    switchToPaintOnColorPick()
  }

  /** A Project switch: an Image color belongs to the Project that was converted, so it can't stay selected; the Palette's own default steps back in, rather than leaving the editor with no paint color at all. */
  function resetImageColor() {
    if (selectedImageColor.value) {
      selectedImageColor.value = undefined
      selectedColorId.value = DEFAULT_PALETTE_COLOR_ID
    }
  }

  return {
    activeTool,
    selectedColorId,
    customColor,
    selectedImageColor,
    selectedColorHex,
    previewColor,
    onSelectTool,
    onSelectColor,
    onSelectCustomColor,
    onCustomColorAdded,
    onSelectImageColor,
    resetImageColor,
  }
}
