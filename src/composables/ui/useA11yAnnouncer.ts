import { nextTick, ref } from 'vue'

// Screen-reader announcements (tickets 159, 192): the one polite live-region message per action, such as a Frame move
// or a rotation.
export function useA11yAnnouncer() {
  /** The live region's text. */
  const announcement = ref('')

  function announce(text: string) {
    // Cleared first, so the same words said twice are still heard twice.
    announcement.value = ''
    void nextTick(() => {
      announcement.value = text
    })
  }

  return { announcement, announce }
}
