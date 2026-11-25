# Quintel design system — "Paper lab"

This file is the single source of truth for how Quintel looks, moves and talks.
Every page, feature, state, email, share image and future product follows it.
If something you need isn't here, add it here first (see "Adding something new"), then build it.

---

## 1. North star

Quintel should feel like an Apple product page crossed with a serious research lab:
calm, light, lots of space, big confident type, one idea per screen, nothing flashy.

- A working product comes before decoration (the hero is live data, not art).
- Every section headline is a plain-English sentence that makes a claim.
- Motion is small, stepped and pausable.
- Not a meme page. Not dark crypto neon. No hype.

**The phone is the main product.** Design at 390px first, then widen for laptop.

---

## 2. Hard product rules (apply to every screen and every string)

- Never use Nvidia / NVDA / Jensen / Huang / CUDA in a product name, feature name or logo. Factual body copy (e.g. "NVDA +31% in a day") is fine.
- Say **"scenario odds"**, never "predictions", "forecast", "signal", "call" or "target".
- No buy/sell/hold advice. No "you should". No return promises.
- Neutral wording on news: state facts and dates, never opinions about people or outcomes.
- The user-facing name is **"Stress Level"** (0–33 Calm, 34–66 Elevated, 67–100 High; see docs/METHODOLOGY.md). "Crisis" must not appear anywhere.
- Disclaimer (footer, token section, share images, and every token page):
  "Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice."
- Token links are labeled neutrally: "View on Pons", "View on Pump.fun", "Explorer".
- Paper desk is always labeled "Paper trading. No real money."
- Never show a user's wallet address in public places except shortened (0x12…ab) where the user chose to be public. Never show amounts on public boards.

---

## 3. Tokens (src/styles/tokens.css is the only place hex values live)

### Color — light theme only
| Token | Hex | Use |
|---|---|---|
| `--paper` | #F3F1EA | page background |
| `--card` | #FBFAF6 | cards, sheets, inputs |
| `--ink` | #121212 | text, "kept" pixels, primary button, up moves |
| `--ink-2` | #6B675E | secondary text, labels |
| `--line` | #DEDAD0 | hairlines, empty pixels, disabled |
| `--risk` | #E5484D | downside, "lost" pixels, high stress, errors, live dot |

Derived (defined in tokens.css with color-mix, never new hues):
`--ink-soft` (ink 6% on card, hover fills) · `--risk-soft` (risk 10% on card, error and "outside band" backgrounds).

Rules: no gradients, no glow, no blur/backdrop-filter, no drop shadows except `--shadow-bar` (one very soft shadow, phone sticky bar and toasts only). No dark mode at launch. `<meta name="theme-color" content="#F3F1EA">`, `color-scheme: light`.

Inverted pill (ink background, paper text) is the only "loud" treatment. Use it for: Live, Chain mode, Shipped, Today, Verified.

### Type
- Sans: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif`. Inter is self-hosted (woff2, latin subset, `font-display: swap`) as fallback only. Never ship SF Pro files.
- Mono (every number, label, counter, address, code): `ui-monospace, "SF Mono", "JetBrains Mono", monospace` + `font-variant-numeric: tabular-nums`. JetBrains Mono is self-hosted (woff2, latin subset, swap) as fallback only, so numbers never fall back to Courier.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Hero H1 | clamp(40px, 11vw, 88px) | 600 | letter-spacing −0.02em, line-height 1.05 |
| Section H2 | clamp(28px, 7vw, 56px) | 600 | same |
| H3 / card title | 20px | 600 | line-height 1.2 |
| Big number | clamp(44px, 13vw, 96px) | 500 mono | must fit one line at 375px |
| Body | 17px | 400 | line-height 1.5 |
| Article body | 18px | 400 | max 680px wide |
| Label / eyebrow | 12–13px | 500 mono | `--ink-2`, sentence case |

Headlines and labels are **sentence case**. No ALL CAPS anywhere.

### Shape, spacing, layout
- Radius: cards 24px · inner tiles 16px · inputs 14px · buttons/pills 999px.
- Buttons 48px tall; every tap target ≥ 44×44px.
- Hairlines: 1px `--line`.
- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 144. Nothing off-scale.
- Side padding: 16px phone, 24px tablet, 32px laptop. Max content width 1120px; articles 680px.
- Section spacing: 96px phone, 144px laptop.
- Breakpoints, mobile-first only: base = phone, `@media (min-width: 768px)`, `@media (min-width: 1100px)`. Never `max-width` queries.

### Icons
Lucide only, outline, 1.5px stroke, 20px default (16px inline, 24px max). No emoji anywhere.
One exception: the X and GitHub marks in `SocialLinks`, 16px solid inline SVG in `currentColor`.

---

## 4. Motion

- Ease: `cubic-bezier(0.32, 0.72, 0, 1)`. Durations: 150ms (press), 250ms (UI), 400ms (sections, sheets).
- Animate only `transform` and `opacity`.
- Buttons and cards: `scale(0.97)` on press.
- Sections: fade + rise 12px once when entering view (IntersectionObserver). Never again on scroll back.
- Pages: crossfade via the View Transitions API where supported, nothing otherwise.
- Live numbers: **NumberRoll**, digits roll 300ms; never jump, flicker or reflow.
- Pixel graphics: stepped at ~10 fps (that's the style, not a bug). PixelField ticks every 140ms on one shared timer.
- Toasts and sheets: slide 16px + fade, 250ms.
- Pause every looping animation when off-screen or when the tab is hidden. Every loop has a "Pause" control.
- `prefers-reduced-motion: reduce` → no movement: pixel graphics show their final frame, NumberRoll swaps instantly, toasts appear without sliding, no page crossfade.
- Banned: Three.js, Lenis, GSAP, scroll-jacking, pinned scroll scenes, parallax, autoplaying video.

---

## 5. Pixel system (the visual identity)

Idea: **1,000,000 futures, shown as pixels.** Each PixelField cell stands for an equal share of the run: about 287 futures (64×64) or 118 futures (100×100), counting filled cells only. Labels and aria text say so; never "one pixel, one future".
Ink pixel = kept / up / inside · red pixel = lost / down / outside · line pixel = empty.
Red pixels are solid. Meaning never relies on color alone: the number, the label or key, and the aria-label always say it too.
PixelField gaps are about 1 CSS px on every screen (`max(1, round(dpr))` device pixels); cells are whole device pixels.

Shared canvas helper: draws with `fillRect` at device-pixel-ratio resolution, integer cell sizes → razor-sharp on every screen. Every canvas sits in a fixed `aspect-ratio` box (no layout shift) and has an `aria-label` stating its value in words.

| Component | What it shows |
|---|---|
| `PixelField` | The scenario grid and the hero picture. 64×64 phone, 100×100 laptop. Kept (ink) and lost (red) cells scattered at random in exact proportion, over 15% empty (`--line`) texture cells. Standard motion: a swap shimmer, every 140ms swap 4.4% of cells as random pairs (counts never change). A new run moves to the new split in ~1.5s of ticks, then the number rolls. No wipe. Loading: all empty, still. Has a Pause control; stops off-screen and in a hidden tab (a move cut short by pausing or scrolling away lands on the exact split at once); reduced motion shows a still grid. |
| `PixelFan` | Not placed yet (kept for later). All futures spreading out over 1 week, as an ordered pixel pattern. Ink above the halfway price, red below. 64×48 phone, 100×100 laptop. Draws in once (~1s, 10 steps), again on each new run. Loading: a light dot grid. |
| `PixelMeter` | 10 blocks, ink → red as the value rises (Stress Level, progress, limits). |
| `PixelBars` | Distributions, histograms, hit/miss rows as stacked pixel columns. |
| `PixelFlow` | Dot-matrix process diagram; pixels hop along grid lines in steps. |
| `PixelSpark` | Tiny pixel sparkline (cards, rows, watchlist). |
| `PixelMark` | The 3×3 logo mark. |

No other illustration style is allowed. No photos, no 3D, no stock art, no network-node graphics.

---

## 6. Components (src/components/ui — every page uses these, none builds its own)

Header · Footer · MobileMenu (full-screen sheet) · StickyBar (phone only) · Section (eyebrow + H2 + sub) · Card · Button (primary = ink fill, secondary = line outline, ghost) · Pill (Live, Soon + date, Planned, Delayed, Up, Down, Inside band, Outside band, Shipped) · SegmentedTabs · Slider · Input (numeric uses `inputmode="decimal"`, 16px+) · Stat (label + mono number) · NumberRoll · DataTable (turns into stacked cards on phone) · Accordion · CodeBlock · CopyButton · AddressChip (0x12…ab + copy, tap to expand) · Toast + LiveToasts · Sheet (bottom sheet on phone, centered dialog on laptop) · Skeleton · EmptyState · ErrorState · LockedState · Countdown · SocialLinks (X and GitHub buttons: header, footer, CA) · plus all Pixel components.

Adding a component: only if no existing one fits. Add it to this list with a one-line purpose in the same PR.

---

## 7. States (every data-driven element must design all that apply)

| State | Look | Copy pattern |
|---|---|---|
| Loading | `Skeleton` in the exact final size; PixelField shows an all-`--line` grid | none |
| Empty | `EmptyState`: one line + one action | "Save a position to track its odds after every run." |
| Error | `ErrorState`, plain English, "Try again" | "Couldn't load the latest run. Try again." |
| Delayed | keep last good data + `Delayed` pill | "Delayed · last run 10:10am ET" |
| Offline | keep data, pause live updates | "Offline · updates paused" |
| Locked | `LockedState`: line-pattern panel + lock icon + reason + action (never blur) | what it is, then the action |
| Soon | `Pill` "Soon · Nov 25, 2pm ET" | — |
| Planned | `Pill` "Planned" | — |
| Live | inverted `Pill` with a stepped blinking red dot | "Live" |

Never show NaN, undefined, blank numbers, raw error text or spinners that resize the layout.

### Market states (site-wide label in hero + Wall Street card)
Market open · After hours (runs every 30 min) · Weekend · Holiday · Half day · Delayed.
Delayed means no new run for 20 min while the market is open, or 45 min while it is closed.

---

## 8. Numbers and time (one shared formatter, src/lib/format.ts)

- Prices: `$186.64` (2 decimals). Large: `$1.2M`.
- Odds and %: one decimal, `61.2%`. Change in odds: `+0.4 pts`. Tiny odds: `<0.1%`, `>99.9%`.
- Signs: real minus `−` and `+` on every change. Up = `--ink`. Down = `--risk` at 24px and larger; smaller falls use `--ink` text, the `−` sign and a small `--risk` pixel marker (small red text fails contrast).
- Times: Eastern, `10:40am ET`; dates `Tue, Dec 1` (the weekday is always computed from the date, never typed). Relative: "updated 2 min ago".
- Countdowns: `1d 14h 22m` (mono), under 1h `42:10`.
- Addresses: `0x12…ab` (first 4, last 2 after 0x) unless expanded.
- Token amounts: `1,204,000 $QNTL`.

---

## 9. Copy rules

- Short, calm, plain English. Apple-like. If a line can lose words, cut them.
- Sentence case. No exclamation marks, no emoji, no ampersands.
- Buttons: verb first, 1–3 words ("Check my position", "Verify a run", "Copy").
- Banned words: predict, prediction, forecast, guarantee, moon, pump, 100x, revolutionary, insane, alpha, signal, "you should", "buy now", crisis.
- Every number on screen has a label that says what it is and when it's from.
- Errors say what happened and what to do. No "Error:" prefix, no blame.
- The product speaks as "we" in docs and briefings, never "I".

---

## 10. Accessibility

- Numbers that roll expose one plain value to screen readers; digits are hidden from them.
- Contrast: body text ≥ 4.5:1 (`--ink` and `--ink-2` on `--paper` both pass).
- Visible focus ring: 2px `--ink` outline, 2px offset, on everything clickable.
- Sliders and tabs work with arrow keys. Sheets trap focus and close on Esc.
- Every canvas has an `aria-label` with its value in words; live regions announce new runs politely (max once per minute).
- Meaning never relies on color alone (the number, label or key, aria-label, +/− signs, pill text).

---

## 11. Phone quality bar

- Test at 375×667, 390×844, 430×932, landscape 844×390. Zero sideways scrolling.
- `100dvh` not `100vh`; `env(safe-area-inset-*)` on header, sticky bar, toasts, sheets.
- Inputs 16px+ (no iOS zoom). No hover-only interactions.
- Swipe areas react only to horizontal swipes (`touch-action: pan-y`); sliders and timelines `pan-y` too (the browser keeps vertical scroll, we handle the horizontal drag).
- StickyBar never covers content (page bottom padding = bar height + safe area).
- Big numbers fit one line at 375px.
- With Chrome DevTools 4x CPU slowdown, scrolling stays smooth.

## 12. Speed

- Pre-rendered HTML for every public route; live data hydrates after. (Not built yet.)
- Initial JS < 150 KB gzipped; lazy-load below the fold and every flagged feature.
- Lighthouse mobile: Performance ≥ 95, Accessibility ≥ 95, CLS < 0.02, LCP < 2s.

---

## 13. Feature flags and the features registry

- One registry, `src/features.ts`: each feature has `flag`, `name`, `oneLine`, `status` (live / soon / planned), `releaseAt` (ET), `route`.
- The registry drives: flag checks, the /status page and its pills. Nothing hard-codes a status.
- All flags default OFF in production. The release command turns one on and updates the registry and CHANGELOG.
- A feature that is off renders nothing, and its route is the 404 page. Planned items appear only on /status. Its design file is added in the same branch as its code.

---

## 14. Adding something new (process — follow every time)

1. Copy `docs/design/features/_TEMPLATE.md` to `docs/design/features/NN-name.md` and fill every section **before writing code**.
2. Reuse components from section 6. If you truly need a new one, add it to section 6 in the same PR.
3. No new colors, fonts, sizes, radii, shadows or animation styles. If one seems needed, stop and ask.
4. Design every state from section 7 that applies.
5. Write copy that passes section 9 and the rules in section 2.
6. Build phone first (390px), then laptop.
7. Run `npm run check:design` and the screenshot check (375px + 1440px) before opening the PR.

## 15. Enforcement — `npm run check:design`

A script that fails the build if it finds:
- a hex color outside `src/styles/tokens.css`;
- imports of `three`, `lenis`, `gsap`, or any `backdrop-filter`;
- a `max-width` media query;
- emoji or banned words (section 9) in UI strings. Allowed exceptions: the brand name "Pump.fun", and negations that explain what Quintel is not ("not predictions", "Are these predictions?" in the FAQ, and the Limits/Methodology docs). docs/design/ itself is not scanned;
- "Crisis", or Nvidia/NVDA/Jensen/Huang/CUDA in component names, feature names, routes or logo assets;
- a live feature in `src/features.ts` with no matching `docs/design/features/*.md` file.

## 16. Living style guide

Not built yet. When it is: route `/_design` (noindex, not linked), every token, component, pill, state and pixel graphic on one page, at phone and laptop width. New components are added here in the same PR.
