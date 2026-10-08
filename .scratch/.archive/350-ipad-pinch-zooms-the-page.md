# 350: iPad pinch over the canvas also zooms the page

**Status:** done

**What was reported (iPad, after 347):** pinching out as far as possible leaves the canvas bigger than the 10% Zoom floor used to look; at the smallest level the view shows a blurred slice of canvas with no Zoom pill, Dock or other controls; everything is soft, not sharp.

**Cause:** that is Page zoom, not Canvas zoom. iOS Safari ignores `user-scalable=no`, and the Page zoom lock (ADR 0034) cancelled `gesturestart`/`gesturechange` only outside the canvas. A pinch inside the canvas is handled by `usePinchPan` through pointer events, but Safari also zoomed the page on top, magnifying a bitmap (blurred) and pushing the chrome off screen. The 10% floor then still looked too big.

**Fix:** `touch-action: pan-x pan-y` on html and body (`manipulation` allows pinch on iOS, so the rest of the page zoomed again), and while a finger is down, `usePageZoomLock` cancels the gesture events everywhere, the canvas included. Mouse and trackpad behaviour is unchanged.

**Hand check (human):** on the iPad Air, pinch the canvas out to 10% and back in; the Zoom pill and Dock stay in place, nothing blurs, and a page already zoomed from before needs a reload.
