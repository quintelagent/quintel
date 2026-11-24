# Quintel — rules for Claude Code

## Design (always)
Before any UI, copy, page, feature, email, share image or component work, read and follow:
@docs/design/SYSTEM.md

- Site layout and page specs: docs/design/SITE.md
- Each feature's design: docs/design/features/NN-name.md (read the one you're building).
- New feature or screen with no design file yet: create it from docs/design/features/_TEMPLATE.md first, show it to me, then build.
- Never invent new colors, fonts, sizes, radii, shadows or animation styles. If the system doesn't cover something, stop and ask.
- When a design decision changes (new feature, new copy, new numbers, new component), update docs/design/ in the same PR. The docs and the site must always match.
- Phone first (390px), then laptop. Run `npm run check:design` and check 375px + 1440px in the browser before any PR.

## Product rules (always)
- Never Nvidia / NVDA / Jensen / Huang / CUDA in a product name, feature name or logo.
- "Scenario odds", never "predictions". No buy/sell advice. Neutral wording on news.
- "Stress Level", never "Crisis".
- Disclaimer: "Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice."

## Git
One feature per branch with a plain-English draft PR; small commits starting "Site: …" or "Ship: …"; authored as Quintel; push as you go; never backdate or force-push. Features ship behind flags (all OFF in production) and are released with `npm run ship <FLAG>`.
