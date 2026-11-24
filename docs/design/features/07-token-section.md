# 07 · Token section

**Flag:** none — launch · **Phase:** P0 · **Location:** `/`, section 10

## Purpose
Explain plainly what $QNTL does (Pro by holding, custom runs by burning) and give the official addresses.

## Layout — phone
H2: "$QNTL unlocks Pro and runs custom scenarios."
Sub: "Hold it for Pro features. Burn it to run your own 1,000,000 futures."
1. "Pro hold tiers" — stacked Cards, one per tier (amounts from config): tier name, "Hold {amount} $QNTL", 3–4 bullet features (Custom runs · Alerts · Pro share cards · Early briefings). Pill "Soon · {date}" while PRO_TIERS is off.
2. "Burn-to-run" Card — two lines: "Burn $QNTL to request a custom run of 1,000,000 futures. The burn is public and the result is posted to the gallery." Pill "Soon · {date}" while BURN_TO_RUN is off; link "How it works" → /docs/burn.
3. "Official addresses" Card:
   - "Robinhood Chain · Pons" — AddressChip (0x12…ab, Copy, tap to expand full)
   - "Solana · Pump.fun" — AddressChip
   - Line: "Always check the address here before you trade."
4. Links: "View on Pons" · "View on Pump.fun" · "Explorer"
5. Disclaimer (13px, `--ink-2`): "Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice."

## Layout — laptop
Tiers as a 3-column row; burn card and addresses card side by side below.

## States
- **Copied:** Toast "Address copied".
- **Address not set yet (pre-launch):** AddressChip shows "Posted at launch".

## Copy (exact)
As above. No price talk, no market cap, no "buy", no returns.

## Motion
Press scale on copy buttons only.

## Reuses
Section, Card, Pill, AddressChip, CopyButton, Toast, Button.
