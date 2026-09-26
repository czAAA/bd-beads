# bd-beads design system download

Snapshot of the bd-beads design system, version 13 (synced from czAAA/bd-beads DESIGN.md @ e16e9c5, plus the X1 logo, Icons v2 and Phases A–E).

- README.md: the brand book: principles, content, colour, type, spacing, layout, states, themes, logo, favicon, iconography.
- Sections: accessibility.md, forms-and-states.md, interaction-and-motion.md, printed-output.md, responsive.md, writing.md.
- tokens.json: every token: colours in three themes (light, dark, contrast), type, spacing, radii, shadows, layout, zIndex, print.
- tokens.css: the same as CSS variables and type classes; light by default, data-theme="dark" or "contrast" on <html> for the others.
- components/: each component's guidelines (README.md) and preview (preview.html), plus bundle.css (64 components).
- previews/: the same previews as standalone pages with tokens and styles inlined; the button bottom-right cycles light, dark and contrast.
- assets/Logos, assets/Icons (Icons v2, 44), assets/Icons v1 (the app's current 23): SVG and PNG files.
- favicon/: theme-aware favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png for the app's public/ folder.
- sign-off/: the pages each part was approved on: logo and icons, breakpoints, forms and states, states and motion, accessibility, print and writing, last gaps.

Fonts are not included: the owner adds them in the repo under public/fonts/. Previews load them from Google Fonts.
The live design system on claude.ai is the current version; this download is a copy and will not update.
