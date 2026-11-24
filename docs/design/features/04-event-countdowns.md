# 04 · Event countdowns + what-if presets

**Flag:** none — launch · **Phase:** P0 · **Location:** `/`, section after the tool

## Purpose
Show the next dates that matter and let people try a move on each with one tap.

## Layout — phone
H2: "The dates ahead."
Sub: "Countdowns to the next market closures and hearings."
Stacked rows (Card with hairline dividers), each: label · date (mono) · Countdown · "What if?" button.
1. "Thanksgiving · market closed" — Thu, Nov 26
2. "Half day · market closes 1:00pm ET" — Fri, Nov 27
3. "Hearing · day 1" — Mon, Dec 1
4. "Hearing · day 2" — Tue, Dec 2
Confirm closure/half-day times against the NYSE holiday calendar before shipping.

## Layout — laptop
2×2 grid of Cards, same content.

## What-if presets (tap "What if?" → scrolls to the tool with the tab and values set)
- Thanksgiving / Half day → Weekend gap tab, gap window preset to that closure: "Try a gap over the holiday"
- Hearing day 1 / day 2 → What-if tab, preset to a ±10% move on that date: "Try a ±10% move on hearing day"

## States
- **Upcoming:** Countdown "1d 14h 22m".
- **Today:** inverted Pill "Today" replaces the countdown.
- **Live** (hearing, when HEARING_LIVE is on): "Live" Pill with stepped red dot; button "Follow live".
- **Done:** row turns `--ink-2`, Pill "Done", moves to the bottom; hidden 24h later.
- **All done:** EmptyState "No dates on the calendar right now."

## Copy (exact)
As above. Buttons: "What if?" · "Follow live". Never describe what a hearing might decide.

## Motion
Countdown digits roll each minute (each second under 1h). Reduced motion: instant.

## Reuses
Section, Card, Countdown, Pill, Button, EmptyState; tool tabs (deep link + preset state).

## Data
Events come from one config list (date, time ET, type, preset), so new events are one line to add.
