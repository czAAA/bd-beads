import { readonly, ref, type Ref } from 'vue'
import type { ResolvedTheme } from './theme'

/** The theme <html> is drawn in now, as a ref, for what can't follow CSS: the canvas renderer (ProjectTheme,
 * DESIGN.md §4.2) redraws on it. Watches `data-theme`, so whoever changes the theme doesn't have to know who draws. */
function current(): ResolvedTheme {
  const theme = document.documentElement.dataset.theme
  return theme === 'dark' || theme === 'contrast' ? theme : 'light'
}

const resolved = ref<ResolvedTheme>('light')
let observer: MutationObserver | undefined

export function useResolvedTheme(): Readonly<Ref<ResolvedTheme>> {
  if (!observer) {
    resolved.value = current()
    observer = new MutationObserver(() => {
      resolved.value = current()
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  }
  return readonly(resolved)
}
