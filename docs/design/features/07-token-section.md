# 07 · Token section

**Flag:** none — launch · **Phase:** P0 · **Location:** `/`, section 10

## Purpose
Say plainly what $QNTL is for and give the official addresses.

## Layout — phone
H2: "$QNTL runs your own 1,000,000 futures."
Sub: "Its job: burn it to run your own scenario as a public run."
0. Until an official address exists, a Card on top: "Launching on Pons, Wed Nov 25, 11:00am ET. Any CA you see before launch is fake."
0b. While Burn-to-run is off, a second Card: "Burn-to-run is not open yet. A burn made before Status shows it as live does not get a run."
1. "What it does" Card: "Burning $QNTL requests a run on your own scenario. The burn and the result are public. What is open today is on Status."
3. "Official addresses" Card:
   - "Robinhood Chain · Pons" — AddressChip (0x12…ab, Copy, tap to expand full)
   - "Solana · Pump.fun" — AddressChip
   - Line: "Always check the address here before you trade."
4. Links: "View on Pons" · "View on Pump.fun" · "Explorer"
5. Disclaimer (13px, `--ink-2`): "Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice."

## Layout — laptop
The two cards side by side.

## States
- **Copied:** Toast "Address copied".
- **Address not set yet (pre-launch):** AddressChip shows "Posted at launch".

## Copy (exact)
As above. No price talk, no market cap, no "buy", no returns.

## Motion
Press scale on copy buttons only.

## Reuses
Section, Card, Pill, AddressChip, CopyButton, Toast, Button.

## As built
- Adds "The coin does not change the odds, and holding it is not a share of anything."
- "View on Pons" and "View on Pump.fun" show once their links are set in web/src/lib/tokenConfig.ts; addresses come from the worker config.
- Addresses and links come from launch.json only. Once it has a CA: the launch notice goes away, the CA bar shows on every page ("$QNTL CA … Only this one is real.", "Copy CA", "View on Pons", X and GitHub buttons, and a smaller Pump.fun line when set), the page head carries the address, and /token.json lists it. `scripts/set-launch.mjs` fills every place; `scripts/check-launch.mjs` confirms they match.
- X and GitHub buttons (SocialLinks) also sit under the addresses in the "Official addresses" card.
- The launch wallet and the dev-buy burn, each with an explorer link, show in the "Official addresses" card once launch.json has them.
- When Burn-to-run is live: the "not open yet" card goes away, "What it does" ends with "A burn can’t be undone, doesn’t change the odds and pays nothing." and the "Burn to run" button shows.
