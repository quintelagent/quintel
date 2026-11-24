# 10 · Holders Board

**Flag:** HOLDERS_BOARD · **Phase:** P1 launch-day drop · **Location:** `/board`; link from hero area ("See the Holders Board") and footer when on

Name rule: the feature is **"Holders Board"** everywhere (never "NVDA Holders Board"). Body copy may say "NVDA token holders".

## Purpose
An opt-in, anonymous board of NVDA token holders: how they're doing and their scenario odds of profit.

## Layout — phone
1. H1: "Holders Board." Sub: "Anonymous, opt-in. Codenames and percentages only."
2. Aggregate Card (for $QNTL holders; public view shows the same with less detail if configured): "Board average +12.4%" · "214 members" · "Odds of profit in 1 week: 52.1%" · PixelBars of members' % changes.
3. SegmentedTabs: "Biggest gain" · "Best entry" · "Longest held".
4. Board list (DataTable → stacked rows on phone): rank (mono), codename ("Quiet Falcon 41"), % gain/loss (signed, up ink / down risk), "Entry vs now" ("$142 → $176 · estimated"), odds of profit 1d / 1w / 1m (three small mono values), held time ("21 days").
5. Your row (when joined): pinned at top, inverted "You" Pill, button "Remove me".
6. Join Card (when not joined): "Join with your wallet. We show a random codename and your % change — never your address or amounts." Button "Join the board".
7. Disclaimer.

## Layout — laptop
Aggregate card full width; tabs + table below with all columns visible.

## States
- **Empty:** "No one's on the board yet. Be the first." + "Join the board".
- **Joining:** wallet sign-in (same Sheet as Pro) → "Your codename is Quiet Falcon 41." → Toast "You're on the board".
- **No NVDA token found:** "We couldn't find NVDA tokens in this wallet. Nothing was saved."
- **Remove:** Sheet "Remove yourself from the board? This deletes your entry right away." Buttons "Remove me" / "Cancel" → Toast "Removed. Your data is deleted."
- **Loading / error:** Skeleton rows / ErrorState.
- **Flag off:** /board → "Soon" page.

## Copy (exact)
Tabs: "Biggest gain", "Best entry", "Longest held" · Column labels: "Codename", "Change", "Entry vs now", "Odds of profit", "Held" · "estimated" always shown next to entry values · Line under table: "Entries are estimated from on-chain history."

## Motion
Rows NumberRoll on each run; your row highlight fades in once. Reduced motion: instant.

## Reuses
Section, Card, SegmentedTabs, DataTable, Pill, PixelBars, Sheet, WalletChip, Toast, EmptyState, ErrorState, Skeleton.

## Data and privacy
Opt-in only. Store: address hash, random codename, estimated entry, first-held date. Show: codename, %, estimated entry/now price, odds, held time. Never show addresses, balances or $ amounts. "Remove me" hard-deletes immediately.
