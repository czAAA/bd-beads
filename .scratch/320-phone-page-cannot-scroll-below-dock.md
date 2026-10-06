# 320: Phone portrait: the page cannot scroll past the Dock

**What to build:** In phone portrait, swiping or scrolling the page reveals an empty band of space below the Dock (seen as a blank strip under the Dock's tab row). That should be impossible: the app shell fills the visible screen exactly, the Dock is the bottom edge, and nothing below it can be reached by touch. Find the cause (likely the shell's height not matching the visible viewport, or safe-area padding / a document-level scroll) and fix it so the page itself never scrolls on the phone layout. The left column and sheets keep their own touch-scroll.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Phone portrait (iOS Safari and Android Chrome, with the browser toolbar shown and hidden): swiping on the header, canvas margin, Dock or empty areas never reveals space below the Dock
- [ ] The Dock sits flush at the bottom of the visible area, still respecting the device's bottom safe area
- [ ] Left column and sheets still scroll by touch where their content overflows
- [ ] Landscape phone, tablet and desktop layouts unchanged
- [ ] A regression test or visual check covers the shell height / document not being scrollable on the phone layout
- [ ] Check against ticket 316 (`overscroll-behavior`) so the two fixes don't overlap or conflict
