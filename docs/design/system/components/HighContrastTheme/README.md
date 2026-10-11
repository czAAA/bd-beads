# HighContrastTheme

The added third theme, `contrast`: 7:1 text, 2px borders at 3:1, no shadows, a 3px black focus ring.

- Set `data-theme="contrast"` on `<html>`. The app picks it when `prefers-contrast: more` matches and the person has not chosen a theme; it is also in the theme menu as "High contrast".
- Values: `ink` #000, `body` #1f1f1f, `muted` #3d3d3d, `accent` and `danger` #a82c00 with white labels, every line #595959 (`line-strong` #000), every surface white; bead colours unchanged.
- `components/bundle.css` thickens borders to 2px, the focus ring to 3px and the active underline to 3px under `[data-theme="contrast"]`, and handles `forced-colors: active` with system colours.

Hand-written from the Phase C sign-off.
