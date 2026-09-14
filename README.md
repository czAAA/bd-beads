# bd-beads
beads drawing app

Live at: https://czAAA.github.io/bd-beads/

## Deploy

Hosted on GitHub Pages — see [ADR 0003](docs/adr/0003-github-pages-hosting.md) for why and what that requires from the build. Every push to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds the app and publishes it to Pages; no manual deploy step is needed.

One-time repo setup: under Settings → Pages, set Source to "GitHub Actions".
