# 01 · Hero — "Does it hold?"

**Flag:** none — launch · **Phase:** P0 · **Location:** `/`, first section

## Purpose
In 3 seconds: what happened, what the odds say now, and when the next run lands.

## Layout — phone
1. Eyebrow (mono label): market state + run + time — "After hours · run 4,182 · 10:40am ET"
2. H1: "NVDA +31% in a day. Does it hold?"
3. Sub: "1,000,000 futures, every 10 minutes."
4. PixelFan, full width, 4:3, with "Now · $164.21" and "1 week" under it, then "Halfway price $145.29" and the above / below key.
5. Big number (NumberRoll) "61.2%" + label "of futures keep at least half of Monday's gain for a week" + small info button (opens Sheet with the metric definition from the Methodology doc — use the existing definition, do not invent one).
6. Two Stat tiles side by side:
   - "Stress level" — PixelMeter + "62 · Elevated"
   - "Back above $186.64 within 1 month" — "38.4%"
7. Row: Countdown "Next run in 06:12" · "updated 2 min ago"
8. Buttons: "Check my position" (primary, → `/#position`) · "How it works" (secondary, → Proof section)

## Layout — laptop
Two columns. Left: eyebrow, H1, sub, big number + label, the two Stat tiles, countdown row, buttons. Right: PixelFan 500px square, vertically centered.

## States
- **Loading:** PixelFan shows a light dot grid; number/tiles Skeleton in final size; countdown hidden.
- **Delayed** (no run for 20 min while open, 45 min while closed): last good data + Delayed pill in eyebrow: "Delayed · last run 10:10am ET".
- **Error:** same as delayed; never blank.
- **Market states:** eyebrow shows Market open / After hours (runs every 30 min) / Weekend / Holiday / Half day.
- **Chain mode on** (feature 16): sub swaps to "The market's closed. The chain isn't."
- **Hearing live on** (feature 18): inverted "Live" pill before the eyebrow.

## Copy (exact)
- Eyebrow: "{Market state} · run {n} · {time} ET"
- H1: "NVDA +31% in a day. Does it hold?"
- Sub: "1,000,000 futures, every 10 minutes." while the market is open; "1,000,000 futures, every 30 minutes while the market is closed." when it is closed
- Big label: "of futures keep at least half of Monday's gain for a week" (METHODOLOGY.md, "Gain kept")
- Stress labels: "Calm" / "Elevated" / "High" (0–33 / 34–66 / 67–100)
- Tile 2 label: "Back above $186.64 within 1 month"
- Countdown: "Next run in {mm:ss}" · "updated {n} min ago"
- Info sheet title: "What 'Monday's gain kept' means"
- Footnote under buttons (12px, `--ink-2`): "Scenario odds, not predictions. Not financial advice."

## Motion
On load and on each new run: PixelFan draws in from the left (10 steps, ~1s) → NumberRoll on all numbers → PixelMeter fills block by block at 10fps. Reduced motion: final frame, instant numbers.

## Reuses
Section, PixelFan, NumberRoll, Stat, PixelMeter, Countdown, Pill, Button, Sheet, Skeleton.

## Done when
- [ ] Big number and H1 fit at 375px without overflow
- [ ] All market states + delayed checked
- [ ] No layout shift between loading and loaded (CLS < 0.02)

## As built
- H1 is one line per sentence (three lines on phone). The size of the move comes from the run, never typed.
- The picture uses the run's own 1-day and 1-week spreads (all 1,000,000 futures); the days between join them by rank. The most extreme 2.5% on each side is outside the picture. It shows prices along the way, so its red area is not the same number as the big odds figure.
- Laptop: the picture is 500px (exact 5px cells) and the label sits beside the big number, so the hero fits 1440×900.
- "Back above" tile note: "any daily close". Countdown past due: "Run in progress", then "Next run delayed" after 5 minutes. No touch data: "Not in this run."
- The Delayed pill lives in the hero eyebrow on the home page; the top banner shows Delayed on the other pages only, so nothing shifts.
