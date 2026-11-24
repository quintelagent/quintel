# 16 · 24/7 chain mode spotlight

**Flag:** CHAIN_MODE_SPOTLIGHT · **Phase:** P2 after launch · **Location:** site-wide state whenever the stock market is closed (nights, weekends, holidays)

## Purpose
When Wall Street is closed, the whole site shifts focus to the token that keeps trading.

## What changes (same palette, no new colors)
1. Banner (banners slot): inverted Pill "24/7 chain mode" + "The market's closed. The chain isn't. Opens {Mon 9:30am ET} · {countdown}". Dismissible (× remembered for that closure).
2. Hero: sub swaps to "The market's closed. The chain isn't."; eyebrow shows "Weekend" / "Holiday" / "Overnight"; a third Stat tile appears: "Token price now" (NumberRoll) with gap vs last close.
3. Wall Street vs Chain: On chain card moves first on phone; Wall Street card dims (`--ink-2`) with countdown to open.
4. Tool: opens on the "Weekend gap" tab by default.
5. Runs cadence label: "Runs every 30 min while the market is closed."
6. Feed: adds "Token moved {±x.x}% since the close" event at most once per hour.

## Layout
Phone first: banner is one line + countdown, wraps to two lines max at 375px. Laptop: single-line banner.

## States
- **Turns on:** at market close (or holiday), from the market-state helper.
- **Turns off:** at the open; banner slides away.
- **Token feed delayed:** banner keeps showing, token tile shows Delayed pill.
- **Flag off:** only the normal "After hours / Weekend" labels show.

## Motion
Banner slides down 16px once per closure. Reduced motion: appears without movement.

## Reuses
Pill, Countdown, Stat, NumberRoll, existing sections (state-driven props, no duplicate components).
