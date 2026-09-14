# 02: Creative, bright, cozy visual design

**What to build:** Replace the current bare-bones styling with a considered visual design system applied across the whole app shell (background, typography, buttons, form controls, pattern grid chrome) — creative and bright, but cozy rather than clinical or garish.

**Style reference:** flat, hand-illustrated look — bold color-blocking (no gradients), thick confident outlines, organic hand-drawn shapes, occasional loose crayon/scribble texture accents for warmth, generous white/light negative space. Anchor palette ("Japan Color Palette"): cello (dark navy ink), peppermint (pale paper background), amaranth (red), wedgewood (blue), aqua island (soft teal).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Palette and type choices are defined as reusable design tokens (e.g. CSS custom properties), not one-off inline values
- [ ] Palette matches the style reference: bold flat color-blocking in cello navy, peppermint, amaranth red, wedgewood blue, and aqua island teal, on generous white/light negative space
- [ ] Applied consistently across all existing UI (New Pattern form, buttons, headings, pattern grid chrome) — not a one-off single screen
- [ ] Text and interactive elements keep readable contrast against the new palette
- [ ] Tokens are reusable so later tickets' new UI (technique-specific grids, palette swatches, catalog management, etc.) can adopt them without redefining colors
