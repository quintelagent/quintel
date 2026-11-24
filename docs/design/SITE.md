# Quintel site — layout and pages

Follows docs/design/SYSTEM.md. Feature details live in docs/design/features/.
This is a front-end rebuild: keep all data wiring, API routes, D1 queries, run/cron logic and fingerprint posting working.

## Remove
Three.js and the 3D scenario cloud · Lenis · GSAP (replace with CSS + IntersectionObserver, remove the dependency) · the ice palette (#06080B, #7CCBFF, #FF4D5E) · HUD corners · scroll-jacking and pinned scroll scenes · any leftover old styles and one-off components.

## Sitemap
| Route | What | Feature file |
|---|---|---|
| `/` | Home | below + 01–05, 07, 13 |
| `/verify` | Verify a run | — (below) |
| `/briefings`, `/briefings/:id` | Briefings | — (below), 12 |
| `/docs`, `/docs/:slug` | Docs hub | 08 |
| `/incidents` | Incidents | 08 |
| `/status` | Status | 06 |
| `/changelog` | Ship log | 14 (SHIP_LOG) |
| `/pro` | Pro | 09 (PRO_TIERS) |
| `/board` | Holders Board | 10 (HOLDERS_BOARD) |
| `/mcp` | Use Quintel from your AI | 11 (MCP_SERVER) |
| `/scorecard` | Daily scorecard | 13 (DAILY_SCORECARD_PUBLIC) |
| `/burn` | Burn-to-run | 15 (BURN_TO_RUN) |
| `/replay` | Replay | 17 (REPLAY) |
| `/_design` | Living style guide (noindex) | SYSTEM.md §16 |
| `*` | 404 | below |

Flagged routes return the 404 page (or a "Soon" page if the registry says so) while their flag is OFF.

## Global chrome
- **Header** — phone: PixelMark + "quintel", menu button → full-screen MobileMenu sheet (links + "Check my position"). Laptop: PixelMark + wordmark · Briefings · Verify · Docs · Status · pill "Check my position". When PRO_TIERS is on: WalletChip ("Connect wallet" / "0x12…ab" + Pro pill). StockSwitcher slot reserved (feature 19, planned).
- **Banners slot** (top, below header, one at a time, priority order): Hearing live (18) › Chain mode (16) › Delayed. Height reserved only when a banner shows; it pushes content, never overlays.
- **StickyBar** (phone only, appears after the hero): "Check my position" (primary) + "Verify" (secondary). Hidden on laptop.
- **LiveToasts** (feature 05).
- **Footer** — PixelMark + wordmark, link groups (Product: Briefings, Verify, Status, Changelog · Docs: README, Methodology, Proof, Limits, Security, Deployments, Incidents · Elsewhere: X @quintelagent, GitHub), "Mute live updates" toggle, disclaimer, © 2026 Quintel.

## Home — section order
1. **Hero** → features/01-hero.md
2. **Stats strip** — three Stats in a row (phone: 3 compact columns; numbers shrink with clamp): "1,000,000" / "futures per run" · "10 min" / "between runs" ("30 min" while the market is closed) · "10:00am ET" / "last fingerprint" (links to /verify). Delayed → pill on the third.
3. **Wall Street vs Chain** → features/02-wall-street-vs-chain.md
4. **The tool** — one Card with SegmentedTabs: Drag a price · What-if · Weekend gap · My position. H2: "Pick a price. See the odds." My position → features/03-check-my-position.md. The other tabs keep today's logic, restyled: big thumb-friendly Slider, result as a big NumberRoll + PixelBars. Laptop: tabs on top, controls left, result right. Deep links `/#drag`, `/#whatif`, `/#weekend`, `/#position`.
5. **Event countdowns** → features/04-event-countdowns.md
6. **Briefing + live feed** — H2: "What changed, in plain English." Left (laptop) / top (phone): latest briefing card (time, headline, 3-line summary, odds change pill, "Read briefing"). Right / below: the 6 latest feed events (same events as feature 05), new rows slide in. "All briefings" link.
7. **Five models** — H2: "Five models. One set of odds." A summary card (combined odds, model agreement), then five compact Cards (name, one line, odds of a rise in 1 month, PixelBars of that model's own spread). Phone: horizontal scroll-snap row with peeking next card. Laptop: 5-across grid.
8. **Paper desk** — H2: "A public paper desk, every trade shown." Pill "Paper trading. No real money." Open positions + recent closed in a DataTable; P&L in mono with signs.
9. **Proof** — H2: "Every hour, a fingerprint of every run goes on Robinhood Chain." when nothing is waiting; "Every hour of runs gets a fingerprint." with the waiting count while `/api/proof` shows pending posts PixelFlow (Research agent → 5 models → 1,000,000 futures → Scenario odds → Fingerprint on chain). Button "Verify a run". Scorecard teaser when DAILY_SCORECARD_PUBLIC is on (feature 13).
10. **Token** → features/07-token-section.md
11. **FAQ** — H2: "What people ask first." Accordion, 6–8 questions, max 720px. Must include: What is Quintel? · Are these predictions? (No — scenario odds.) · Where does the price come from? · How can I check a run? · What does Stress Level mean? · What is $QNTL for? · Is this advice? (No.)
12. **Closing** — H2: "1,000,000 futures. Every 10 minutes." Buttons "Check my position" + "Read the docs".
13. **Footer**.

Home laptop layout: hero two columns; Wall Street vs Chain, briefing + feed, and paper desk side by side; tool controls left / result right; models 5-across; FAQ single column.

## Other pages (no flag)
- **Stored briefings** that used the old Stress Level name are hashed and can't be edited: show the current wording with the note "Shown with current wording. Original hash below."
- **/verify** keeps the full in-browser recompute (1,000,000 paths) and only says what was checked: run hashes, seed, recompute, hourly fingerprint, and on-chain calldata when it was actually read.
- **/verify** — H1 "Verify a run." Sub "Paste a run ID or fingerprint. Your browser recomputes it and checks it against the chain." Big Input + "Verify". Result Card: Verified (inverted pill) or "Not found" (EmptyState: "No run matches that ID. Check it and try again."), run time, inputs summary, fingerprint (CodeBlock + Copy), block number, "View on explorer". Below: "Latest fingerprints" DataTable (hour, fingerprint, status, transaction), 10 rows.
- **/briefings** — H1 "Briefings." Sub "What changed in the odds, and why, in plain English." List of briefing Cards. Empty: "The first briefing posts after the next run."
- **/briefings/:id** — article layout (680px, 18px body): time ET, headline, odds change pill, PixelBars chart at top, body, "Share" (feature 12 when RUN_SHARE_CARDS is on), previous/next.
- **404** — H1 "This future didn't happen." Small static PixelField. Button "Back to home".

## Brand assets
Favicon + app icon (PixelMark, ink on paper) · apple-touch-icon · manifest theme color #F3F1EA · og.png 1200×630 (paper, "Does it hold?", PixelField) · unique title + description per route.

## Speed and quality
SYSTEM.md §11 (phone bar) and §12 (speed). Pre-render `/`, `/verify`, `/briefings`, `/docs`, `/status`, `/incidents` at build time (e.g. vite-react-ssg or a build-time prerender step).

## Shipping
Cloudflare preview URL first; production only after approval; old version stays deployable for one-click rollback.
