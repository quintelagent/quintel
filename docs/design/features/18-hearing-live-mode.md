# 18 · Hearing live mode

**Flag:** HEARING_LIVE · **Phase:** P2 after launch (needed by Dec 1) · **Location:** site-wide during a hearing window (start/end from the events config)

## Purpose
During each hearing, show how the odds move in near real time, without covering what's said.

## What changes
1. Banner (top priority in the banners slot): inverted Pill "Live" with stepped red dot + "Hearing · day 1 · briefings every 10 minutes" + "Follow live".
2. Hero: "Live" Pill before the eyebrow; countdown reads "Next run in {mm:ss}".
3. Briefing section becomes a live stream: newest briefing on top, each a compact Card (time ET, one-line change, odds change Pill), older ones collapse. H2 swaps to "Live: how the odds are moving."
4. Event countdown row shows "Live".
5. What-if presets in the tool: "If the stock drops 10% today" · "If it rises 10% today".
6. Line under the briefing stream (`--ink-2`): "We don't cover what's said, only how the odds move."
7. Ends automatically at the scheduled end (or when turned off); banner becomes "Hearing ended · see the summary briefing" for 2 hours.

## Layout
Phone: banner one line + button, stream full width. Laptop: stream left, live hero numbers right (sticky).

## States
- **Before start:** countdown row only (feature 04).
- **Live:** as above.
- **Run delayed during live:** Delayed pill in the banner; stream shows "Next briefing delayed. Last one {time} ET."
- **Ended:** summary state above.
- **Flag off:** normal site.

## Copy rules
Strictly neutral: dates, times, odds changes. No quotes, no characterizing people or testimony, no outcome guesses.

## Motion
Live dot stepped blink (1s). New briefing card slides in. Reduced motion: static dot, cards appear.

## Reuses
Pill, Card, Countdown, NumberRoll, Section, existing tool presets, Toast.
