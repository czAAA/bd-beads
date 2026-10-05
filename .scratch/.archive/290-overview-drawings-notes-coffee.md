# 290: Overview: drawings closer to the content, "you"/"on us" for everyone, full-width Coffee tile

**What to build:** Three changes to the Overview page and the design system's Overview card, together (see `DESIGN.md` §6: change the card, tokens, `bundle.css` and `src/styles/design-values.css` in place, plus a line in the README's Version changelog).

1. **Drawings close to the content.** Today the drawn layer's bead drawings and X1 marks sit at the page edges (placements fitted at each band's narrowest size), so on wide screens they are barely visible, far from anything. Re-fit the placements so each one sits a fixed gap (about 24-48px) outside the content column at every screen band, the large 16% ones keeping a clear margin from text and controls (still never touching text, still `aria-hidden`, still behind content). Where a band has no room beside the column (phone), the small drawings tuck into the gutters. Also thin them out per band, counting from the current laptop+ amount (the `xl` and `xxl` bands, from 1440): about two thirds of that in the `md` and `lg` bands (744-1439), about one third in the `sm` band (phone). The header logo is not part of the drawn layer and is untouched. Update `drawnLayer.ts` and its tests, and the card's "The drawn layer" text and `preview.html` placements.
2. **"you" and "on us" for everyone.** The "you" note on the slogan's first word («вы») and the "on us" arrow beside the tagline («это мы») render only for first-time visitors (`isNew`, no saved Projects). Show both always, in the same font and style as the existing "you are here" note («вы здесь»). The first-time-only notes stay first-time only ("eleven small steps", "you'll make this"). Wording unchanged. Update the card's Hero bullet and `preview.html`.
3. **Coffee tile as wide as the main column.** Today the tile is capped at 51.25rem and its text at 27.5rem (3 lines). Make the tile the main column's width (same edges as "Что внутри" and the plan tiles), drop the text cap so the text takes 1 line where it fits and 2 where it doesn't (more only on narrow screens), and keep the stacked, centred layout (cup, title, text, button). Update the card's Coffee tile bullet and `preview.html`.

Check the visual specs and any reference screenshots for the Overview (EN and RU, each band) that change. No ADR; `CONTEXT.md` only if a term needs a glossary line.

**Blocked by:** none

**Human involvement:** autonomous (a human should eyeball the drawing placements at the five bands, as the tests can't judge "looks close enough")

**Status:** done (except `preview.html`, left for a human: blocked by a deny rule in the implementing session)

- [x] At every band, each drawing sits a fixed gap outside the content column, with none touching text or a control, in EN and RU
- [x] Item counts per band: `xl`/`xxl` as today, `md`/`lg` about two thirds, `sm` about one third; the header logo is unchanged
- [x] The "you" and "on us" notes show with and without saved Projects, in the "you are here" note's font and style, in EN and RU
- [x] The Coffee tile spans the main column at every band; its text is 1-2 lines where it fits at tablet and up
- [ ] The Overview card (README, `preview.html`, changelog line), tokens, `bundle.css` and `design-values.css` match the app; tests and visual specs updated
