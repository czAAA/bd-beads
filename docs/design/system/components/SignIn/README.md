# SignIn

The Sign in Subpanel and the Google button: how a Guest signs in to openbeads. The Menu's Account section, which opens it, is in the MenuPanel card. (Designed in ticket 1087, built in ticket 0078; the design canvas link is on ticket 1087 in the private docs repo.)

There are no pages and no modal: Sign in is a Subpanel of the Menu, pushed by the Account section's "Sign in" row the way New Project is (MenuPanel card, Subpanel). One flow: the first Google sign-in with an unknown email makes the account, so there is no "sign up" (glossary: Sign in / Sign out).

## The Subpanel

Under the header (Back, the title "Sign in" in `title`), the body is one column, 16 apart:

1. **A refusal**, only when the person has just come back from Google refused (below).
2. **What signing in is for:** one sentence in `body` / `muted`, as New Project's subtitle is. "Sign in to have the same language, theme and Lifted pieces on all your devices. Your Projects stay on this device." It says that Projects stay, so nobody expects them to follow.
3. **What is kept**, in plain sight above the button, with the weight of a heading:
   - the heading "What openbeads keeps" in `title`;
   - a list on `surface`, `radius-md`, padding 10 12 (a 2px `line-strong` edge in high contrast): one row per thing kept, a 16px `check` in `muted` and the words in `control` / `ink`, 6 apart. Today two rows: "Your email address" and "Three settings: language, theme and Lifted pieces";
   - one line under it in `body`: "Nothing else. From Google, only your email address: no name, no picture."
   A ticket that stores one more thing adds one row; the heading and the closing line stay.
4. **Cloudflare's check**, only in the rare case it asks the person something (below).
5. **The Google button**, then 8 under it one line in the form hint's style (`meta` size in the sans face, `muted`): "The first time you sign in, your free account is made."

Room is left under the button for the email link (ticket 0388): an "or" rule and an email field, as New Project has under Create Project. The privacy policy's link (ticket 0082) goes under the closing line of what is kept.

## The Google button

The one company mark in the app, and the one place a color is not a token: the README's "nothing borrowed" has this exception, because Google's sign-in button must carry Google's mark.

- **Shape:** the app's secondary Button at the form's field height (`field-height`), the full width of the Subpanel, as Convert image is in New Project: `button` fill, 1px `button-line` (2px in high contrast), `radius-md`. Google's "G" at 18px (`--google-mark-size`, 1.125rem) in its own four colors, 10 before the label; the label "Continue with Google" in `control` / `ink`, centred with the mark.
- **The mark** is Google's standard color "G", unaltered, in every theme and every state: never one ink, never recolored, never dimmed. It is not an icon of the set and does not go through `AppIcon`.
- **Themes:** the button takes the theme's own `button` and `button-line`, so it is white in light and high contrast and `#202020` in dark; Google allows its mark on a light, a neutral and a dark button.
- **States:** rest; hover `hover-fill`; pressed `press-fill`; focus the 2px `focus-ring`, as every Button. **Busy**, between the press and the page leaving for Google: the label reads "Opening Google…" in `muted` on `surface`, the mark stays, and the button is `aria-disabled` (as Send reads "Sending…" in the FeedbackSheet). A press made before Cloudflare's check has given its token waits for it the same way, busy from the press on: the button is never disabled as the Subpanel opens, so focus can enter on it.
- A press starts a full-page redirect. The open Project is untouched (autosave).

## Cloudflare's check

Turnstile runs unseen as the Subpanel opens, through the loader the FeedbackSheet uses, and its script loads only then, so a Guest who never opens Sign in makes no outside request. In the rare case Cloudflare asks the person something, its own widget (300 by 65, drawn by Cloudflare) shows right above the Google button it holds back, under one line in `small` / `muted`: "One more check before you sign in."

## Back from Google

- **Signed in:** the canvas, with the Menu open on the Account section showing the email. No toast, also when signing in has changed the language or the theme: the section's settings line says why (MenuPanel card).
- **Refused:** the Menu open on this Subpanel, with the reason as a Message at the top of the body (notice placement: no shadow, no close, `role="alert"`). Three reasons:

| Reason | Tone | English |
|---|---|---|
| The person said no at Google | info | You are not signed in: the sign-in was cancelled at Google. |
| Something failed: a check that didn't pass, Cloudflare's included, or sign-in switched off or limited while the person was at Google | `danger` | Signing in did not work. Try again. |
| New accounts are paused (the `sign-up` switch) | `warning` | New accounts are paused. Try again later. |

The Google button stays under it, ready for another try.

## When the backend can't be reached

The Account section's "Sign in" row is never disabled and never hidden. When the backend can't be reached, answers `429` or `503`, or sign-in is switched off, a press on the row shows a toast and opens nothing (Message card, Sign-in unavailable); with no internet the toast says so.

## Phone

At 320 the Subpanel spans the width as every panel does; every line wraps, the button keeps the full width, and Cloudflare's widget keeps its 300.

## Keyboard and screen readers

The Subpanel is a `dialog` named "Sign in", as every Subpanel. Focus enters on the Google button. The list of what is kept is a list of two items under its heading. A refusal is announced once (`role="alert"`). The mark is hidden from screen readers; the button's name is its label.

## Copy

English above; every language is in `writing.md` (Sign-in copy). The owner approved the English on 2026-11-18; the other six were reviewed with the build (ticket 0078).

Hand-written from ticket 1087's canvas; static rendition.
