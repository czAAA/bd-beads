import { PRINT_THEME } from './beadLook'

/** The light theme's values the paper uses (tokens.json; kept equal by printPages.test.ts). A canvas can't read CSS. */
export const PRINT_COLORS = {
  paper: '#ffffff',
  ink: '#1f1f1f',
  muted: '#6a6a6a',
  line: '#e5e5e5',
  accent: '#fa520f',
  board: PRINT_THEME.background,
}
