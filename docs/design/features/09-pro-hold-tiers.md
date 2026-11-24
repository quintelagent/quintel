# 09 · Pro hold tiers

**Flag:** PRO_TIERS · **Phase:** P1 launch-day drop · **Location:** `/pro`; header WalletChip; LockedState wherever a Pro feature appears (tool, share cards, briefings)

## Purpose
Holders of $QNTL sign in with a free signed message and unlock Pro features.

## Layout — /pro (phone)
1. H1: "Pro." Sub: "Hold $QNTL to unlock custom runs, alerts and early briefings."
2. Status Card (changes by state, see below).
3. "What Pro includes" — Cards:
   - "Custom runs" — "Run 1,000,000 futures on your own price and date. 5 a day."
   - "Alerts" — "Get told when the odds cross a level you set."
   - "Pro share cards" — "Share your custom runs with a Pro badge."
   - "Early briefings" — "Read each briefing {n} minutes before everyone else."
4. Tiers (from config) — same tier Cards as the token section.
5. Custom run panel (Pro only): Inputs "Price", "By date", optional "Shock (%)" → button "Run 1,000,000 futures" → PixelField fills while running → result (big %, PixelBars) + "Share" → counter PixelMeter "3 of 5 runs left today".
6. Alerts panel (Pro only): list of alerts ("Kept % crosses 50%") + "Add alert" Sheet. Uses the existing alert channel.
7. Disclaimer.

## Layout — laptop
Status card + "What Pro includes" in two columns; custom run panel: inputs left, result right.

## Header WalletChip
Signed out: ghost button "Connect wallet". Signed in: AddressChip "0x12…ab" + inverted "Pro" Pill when Pro. Tap → Sheet: balance, tier, "Sign out".

## States (status card)
- **Signed out:** "Hold $QNTL to unlock Pro" + button "Connect wallet".
- **Signing:** Sheet: "Sign a message to prove you hold $QNTL. It's free and doesn't move any funds." Button "Sign message".
- **Signature cancelled:** "Signature cancelled. Nothing was sent."
- **Wrong network:** "Switch your wallet to Robinhood Chain to continue." (or Solana for Pump.fun holders)
- **Not enough:** "You hold 1,200 $QNTL. Pro starts at 10,000." (numbers from config)
- **Pro:** inverted Pill "Pro" + "You're on {tier}."
- **Balance check failed:** "Couldn't check your balance. Try again."
- **Locked feature elsewhere:** LockedState (line pattern + lock icon, never blur): "Pro feature" + "Hold $QNTL to unlock" + button "See Pro".
- **Daily limit reached:** "You've used today's 5 runs. More at midnight ET."
- **Flag off:** /pro → "Soon" page; locks hidden; token section shows "Soon · {date}".

## Motion
Custom run: PixelField fills cell by cell (stepped) while running, then moves to the result’s split. Reduced motion: progress bar via PixelMeter only.

## Reuses
WalletChip, AddressChip, Sheet, Card, Input, Button, PixelField, PixelBars, PixelMeter, LockedState, Pill, Toast, ShareSheet.

## Data and privacy
Sign-in by signed message only (no gas, no transactions, no approvals). Store only a session tied to the address and its tier. Never display full addresses publicly.
