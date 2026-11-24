# 01 · Hero — "Does it hold?"

**Flag:** none — launch · **Phase:** P0 · **Location:** `/`, first section

## Purpose
In 3 seconds: what happened, what the odds say now, and when the next run lands.

## Layout — phone
1. Eyebrow (mono label): market state + run + time — "After hours · run 4,182 · 10:40am ET"
2. H1: "NVDA +31% in a day. Does it hold?"
3. Sub: "1,000,000 futures, every 10 minutes."
4. PixelField, full width, square.
5. Big number (NumberRoll) "61.2%" + label "of futures keep Monday's gain" + small info button (opens Sheet with the metric definition from the Methodology doc — use the existing definition, do not invent one).
6. Two Stat tiles side by side:
   - "Stress level" — PixelMeter + "62 · Elevated"
   - "Back above $186.64 within 1 month" — "38.4%"
7. Row: Countdown "Next run in 06:12" · "updated 2 min ago"
8. Buttons: "Check my position" (primary, → `/#position`) · "How it works" (secondary, → Proof section)

## Layout — laptop
Two columns. Left: eyebrow, H1, sub, big number + label, the two Stat tiles, countdown row, buttons. Right: PixelField ~520px square, vertically centered.

## States
- **Loading:** PixelField all `--line`; number/tiles Skeleton in final size; countdown hidden.
- **Delayed** (no run 30+ min): last good data + Delayed pill in eyebrow: "Delayed · last run 10:10am ET".
- **Error:** same as delayed; never blank.
- **Market states:** eyebrow shows Market open / After hours (runs every 30 min) / Weekend / Holiday / Half day.
- **Chain mode on** (feature 16): sub swaps to "The market's closed. The chain isn't."
- **Hearing live on** (feature 18): inverted "Live" pill before the eyebrow.

## Copy (exact)
- Eyebrow: "{Market state} · run {n} · {time} ET"
- H1: "NVDA +31% in a day. Does it hold?"
- Sub: "1,000,000 futures, every 10 minutes."
- Big label: "of futures keep Monday's gain"
- Stress labels: "Calm" / "Elevated" / "High" (map to the existing Stress Level thresholds)
- Tile 2 label: "Back above $186.64 within 1 month"
- Countdown: "Next run in {mm:ss}" · "updated {n} min ago"
- Info sheet title: "What 'Monday's gain kept' means"
- Footnote under buttons (12px, `--ink-2`): "Scenario odds, not predictions. Not financial advice."

## Motion
New run: PixelField stepped wipe (~800ms) → NumberRoll on all numbers → PixelMeter fills block by block at 10fps. Reduced motion: final frame, instant numbers.

## Reuses
Section, PixelField, NumberRoll, Stat, PixelMeter, Countdown, Pill, Button, Sheet, Skeleton.

## Done when
- [ ] Big number and H1 fit at 375px without overflow
- [ ] All market states + delayed checked
- [ ] No layout shift between loading and loaded (CLS < 0.02)
