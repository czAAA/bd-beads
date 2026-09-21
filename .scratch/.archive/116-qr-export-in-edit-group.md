# 116: QR export in the Edit group

**What to build:** The QR export button moves out of the below-canvas "Export and import" box into the Toolbox's Edit group, next to Save. Pressing it opens the QR panel for the open Pattern, showing the same QR link (ticket 68) that opens the Pattern on the scanning device. For a Pattern too large for a QR (ADR 0015) the control is disabled and its tooltip explains why, as it does today; the tooltip sits on a wrapper because browsers don't reliably show a disabled button's own title.

The QR panel, and the state that says whether it is open, can no longer belong to the Export and import box, since the Toolbox opens it. It is lifted to somewhere both can reach, so the panel still shows and closes as before wherever it appears on screen. Import from a QR image is unaffected here (ticket 117 moves it).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Edit group has a QR export control with an icon, tooltip and accessible name, in EN and RU
- [ ] Pressing it opens the QR panel with the open Pattern's QR; Close hides it
- [ ] For an over-capacity Pattern the control is disabled and its tooltip gives the "too large" reason
- [ ] The QR export button is gone from the Export and import box
- [ ] The QR panel is opened by the Toolbox but shown and closed the same way as before, with existing QR export tests carried over to the new home
