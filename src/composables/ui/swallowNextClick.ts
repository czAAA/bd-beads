/**
 * Eats the click that follows a press an overlay swallowed (a sheet or popover closing on a press outside it), so
 * nothing under the press acts. It outlives the overlay (which unmounts before the click lands) and drops away at the
 * next press, so a press that never clicks (a drag, a cancel) leaves nothing behind.
 */
export function swallowNextClick(): void {
  const stop = (event: Event) => {
    event.stopPropagation()
    event.preventDefault()
    release()
  }
  const release = () => {
    document.removeEventListener('click', stop, true)
    document.removeEventListener('pointerdown', release, true)
  }
  document.addEventListener('click', stop, true)
  document.addEventListener('pointerdown', release, true)
}
