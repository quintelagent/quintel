# 02 · Wall Street vs Chain

**Flag:** none — launch · **Phase:** P0 · **Location:** `/`, section 3

## Purpose
Show the exchange price and the on-chain token price side by side, and the gap between them.

## Layout — phone
H2: "Wall Street closes. The chain doesn't."
Sub: "The stock on the exchange next to the token on Robinhood Chain."
1. Card "Wall Street": Pill (Open / Closed / Half day), price (NumberRoll, big mono), label "Last price · 3:59pm ET" (or "Close · Fri 4:00pm ET").
2. Gap row between cards: "Gap +0.8% · +$1.42" (mono; down uses `--risk`).
3. Card "On chain": live dot Pill, token price (NumberRoll), "Token volume · 24h $3.4M", PixelSpark of the last 24h.
4. One line (`--ink-2`): "The gap is the difference between the last exchange price and the live token price."

## Layout — laptop
Three columns: Wall Street card · gap (centered, big) · On chain card.

## States
- **Market closed:** Wall Street card text goes `--ink-2`, Pill "Closed · opens Mon 9:30am ET" (Countdown); inverted Pill "24/7 chain mode" appears above the On chain card.
- **Token feed down:** On chain card keeps last good price + Delayed pill: "Token price delayed · 10:32am ET". Gap row shows "Gap unavailable".
- **Loading:** both cards Skeleton in final size.

## Copy (exact)
- Card titles: "Wall Street" · "On chain"
- Labels: "Last price · {time} ET" · "Close · {day} {time} ET" · "Token volume · 24h"
- Badge: "24/7 chain mode"
- Gap: "Gap {±x.x}% · {±$x.xx}"

## 24h volume
The 24h volume of the one Uniswap V3 pool the token price comes from (collected by the worker, kept only if under 2 hours old). The note under the cards says so and gives the time. No figure: "Not available". The exchange label says "as of" the run time, since trade time is not stored.

## Motion
NumberRoll on price changes. Live dot blinks in steps (1s on, 1s off). Reduced motion: dot static.

## Reuses
Section, Card, Pill, NumberRoll, PixelSpark, Countdown, Skeleton.

## Data and privacy
Existing exchange + token price sources. Volume is pool volume, never per-wallet.

## As built
- Extra row "Opens in" / "Closes in". Token label adds "as of {time} ET".
- The card says "Close" only when the stored last close is known to be that session's close; otherwise "Last price · as of {time} ET".
- A "Pause" control stops the live dot.
