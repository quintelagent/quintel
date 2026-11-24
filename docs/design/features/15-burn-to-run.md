# 15 · Burn-to-run

**Flag:** BURN_TO_RUN · **Phase:** P2 after launch · **Location:** `/burn`; token section burn card links here when on

## Purpose
Anyone can burn $QNTL to request a custom 1,000,000-future run; every burn and result is public.

## Layout — /burn (phone)
1. H1: "Burn to run." Sub: "Burn $QNTL to run 1,000,000 futures on your own scenario. The burn and the result are public."
2. Counter Card: "$QNTL burned" — big NumberRoll "1,204,000" + "{n} runs requested".
3. Steps (numbered Cards):
   - 1 "Choose your scenario" — Inputs "Price", "By date", optional "Shock (%)". Summary line: "Odds of $160 or lower by Dec 31".
   - 2 "Burn {amount} $QNTL" — exact instructions for the burn method from the contract, burn address as AddressChip + Copy, amount in mono. Warning line: "Burns can't be undone."
   - 3 "Confirm" — Input "Transaction hash" (or auto-detected when the wallet is connected) + button "Check burn".
4. Request status Card (after step 3), see states.
5. Gallery: H2 "Gallery." Cards: "Requested by 0x12…ab" · scenario line · result (big %) · PixelSpark · time · "Share". Filter SegmentedTabs: "Latest" · "Most extreme".
6. Disclaimer.

## Layout — laptop
Steps left, status card right (sticky); gallery 3-column grid below.

## States (request status)
- **Pending:** "Waiting for confirmation · 1 of 2" + PixelMeter.
- **Verified:** inverted Pill "Burn verified" + "Your run is queued. About {n} min."
- **Running:** PixelField fills stepped.
- **Done:** result (big %, PixelBars) + "Share" + "See it in the gallery".
- **Not found:** "We couldn't find that burn. Check the transaction hash and network."
- **Too small:** "This burn is below {amount} $QNTL, so it can't start a run."
- **Gallery empty:** "No runs yet. The first burn starts the gallery."
- **Flag off:** /burn → "Soon" page; token card shows "Soon · {date}".

## Privacy
Gallery shows only shortened addresses (the burn is already public on-chain); no balances. Option at step 3: "Show as Anonymous in the gallery".

## Motion
Counter NumberRoll; status changes crossfade; running PixelField stepped. Reduced motion: instant.

## Reuses
Section, Card, Input, AddressChip, CopyButton, NumberRoll, PixelMeter, PixelField, PixelBars, PixelSpark, Pill, SegmentedTabs, ShareSheet, EmptyState.
