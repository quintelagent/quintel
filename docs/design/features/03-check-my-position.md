# 03 · Check my position + watchlist

**Flag:** none — launch (share button: POSITION_SHARE_CARDS) · **Phase:** P0 · **Location:** `/`, tool card, "My position" tab (`/#position`); StickyBar and hero buttons open it

## Purpose
Enter your entry price and see your odds of profit from the latest run.

## Layout — phone
1. Inputs (stacked, full width):
   - "Entry price" — `$` prefix, `inputmode="decimal"`
   - "Shares (optional)" — `inputmode="decimal"`
   - "Horizon" — SegmentedTabs: 1 day · 1 week · 1 month
2. Result Card:
   - Big NumberRoll: "54.3%" + label "odds of profit in 1 week"
   - Three Stat rows: 1 day / 1 week / 1 month odds, each with PixelSpark
   - "Break-even odds" — odds the price is at or above your entry at the horizon
   - "Bad 5% outcome" — "In the worst 5% of futures, the price is $171.20 or lower by Dec 1 (−8.3%)." With shares: adds "(−$1,420)".
   - Footnote: "From run 4,182 · 10:40am ET. Scenario odds, not advice."
3. Buttons: "Save to watchlist" (secondary) · "Share my odds" (ghost, only when POSITION_SHARE_CARDS is on)
4. Watchlist (below result): up to 5 saved rows — entry, horizon, odds (NumberRoll, updates each run), PixelSpark, remove (×). Line: "Saved only on this device."

## Layout — laptop
Inputs left, result right, watchlist full width below.

## States
- **Empty:** result area shows EmptyState "Enter your entry price to see your odds."
- **Invalid:** inline under field: "Enter a price above $0."
- **Loading:** result Skeleton in final size.
- **Delayed:** result keeps last run + Delayed pill.
- **Watchlist empty:** "Save a position to track its odds after every run."
- **Watchlist full:** "You can save up to 5. Remove one to add another."

## Copy (exact)
Tab: "My position" · Fields: "Entry price", "Shares (optional)", "Horizon" · Result label: "odds of profit in {horizon}" · "Break-even odds" · "Bad 5% outcome" · Buttons: "Save to watchlist", "Share my odds" · Toast on save: "Saved to watchlist".

## Motion
NumberRoll on result; watchlist rows slide in. Reduced motion: instant.

## Reuses
SegmentedTabs, Input, Card, Stat, NumberRoll, PixelSpark, Button, EmptyState, Toast, Skeleton.

## Data and privacy
Calculated from the latest run. Inputs and watchlist live in localStorage only — never sent to the server except as anonymous query parameters for the calculation. No account needed.
