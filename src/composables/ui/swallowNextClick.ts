// Eats the click that follows a press an overlay swallowed (sheet or popover closing on an outside press). It outlives
// the overlay (which unmounts before the click lands) and drops away at the next press, so a press that never clicks
// leaves nothing behind.
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
