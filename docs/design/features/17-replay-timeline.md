# 17 · Replay timeline

**Flag:** REPLAY · **Phase:** P2 after launch · **Location:** `/replay`; "Replay" link under the hero PixelField and in briefings

## Purpose
Scrub through past runs and watch the odds change around real events.

## Layout — phone
1. H1: "Replay." Sub: "Scrub through every run and watch the odds move."
2. Replay Card:
   - PixelField (square) for the selected run
   - Big NumberRoll kept % + Stress PixelMeter + price at that time
   - Run label: "Run 4,102 · Mon, Nov 23, 2:10pm ET"
3. Timeline (full width, at the bottom of the card): track with one pixel tick per run, event markers (hearings, open/close, CEO news) as small labeled flags; thumb 44px.
4. Controls row: "Play"/"Pause" (2 runs per second), step back / step forward buttons, range SegmentedTabs "1 day" · "1 week" · "All".
5. "Share this moment" (when RUN_SHARE_CARDS is on).

## Layout — laptop
PixelField left, numbers right, timeline full width beneath. Arrow keys step runs; space plays/pauses.

## States
- **Loading range:** timeline track Skeleton; field all `--line`.
- **No runs in range:** "No runs in this window."
- **Event marker tapped:** Sheet with the neutral event line ("Hearing · day 1 · Dec 1") and a jump button.
- **Flag off:** route "Soon" page, link hidden.

## Motion
Scrubbing redraws the field without the wipe (instant per run); Play uses the stepped wipe between runs. Reduced motion: Play steps without the wipe.

## Touch
Only the timeline captures horizontal drags (`touch-action: pan-x` on the track); the rest of the page scrolls normally.

## Reuses
Timeline, PixelField, NumberRoll, PixelMeter, SegmentedTabs, Button, Sheet, ShareSheet, Skeleton, EmptyState.
