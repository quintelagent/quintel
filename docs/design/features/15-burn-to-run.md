# 15 · Burn-to-run

**Flag:** BURN_TO_RUN · **Phase:** P2 after launch · **Location:** `/burn`; the token section's "What it does" card links here when the flag is on

## Purpose
Anyone can burn $QNTL to request a custom 1,000,000-future run; every burn and result is public.

## Layout — /burn (phone)
1. H1: "Burn to run." Sub: "Burn $QNTL to run 1,000,000 futures on your own scenario. The burn and the result are public."
2. Counter Card: "$QNTL burned for runs", NumberRoll "1,204,000", "{n} runs requested".
3. Request Card, here when the link names a request (`/burn?request=12`), otherwise after the steps.
4. Steps (numbered Cards):
   - 1 "Choose your scenario": price Input, Horizon tabs (Next close · 1 week · 1 month), Shock tabs (No shock · Add a shock) with three Sliders. One line: "Odds of ending above $160.00, and at $160.00 or lower, in 1 week."
   - 2 "Burn {amount} $QNTL": amount, token and burn address as AddressChips, "Counts from block", "A burn before that block, or below this amount, gets no run. One burn gives one run. Runs go one at a time, about one every 10 minutes, and the queue now: "{n} in the queue now: a new burn waits about {wait}.", "The token is the official address.", "Burns can’t be undone." Buttons in turn: "Connect wallet", "Switch network", "Review burn". Review Sheet: amount, full token address, your full wallet address, full burn address, network, "Transfer, no approval", "Open wallet", "Cancel".
   - 3 "Confirm": Input "Transaction hash", tabs "Short address" · "Anonymous", "Sign and check burn". Accordion "Sign in another wallet": the exact text, Input "Signature", "Check burn".
5. Gallery: H2 "Gallery.", tabs "Latest" · "Most extreme" (furthest price from where the run started). Cards: who, big %, scenario line, the other side, PixelSpark of the futures, time, "Open", "Share".
6. Disclaimer.

## Layout — laptop
Steps left, request card right (it follows the page until it holds a result); gallery in 3 columns.

## The scenario
- A price (from a tenth to ten times the latest run's price, 2 decimals), one of the engine's three horizons, and an optional shock: drift −30% to +20% over 1 month, jumps 1 to 5×, volatility 0.5 to 3×.
- The run uses the latest official run's stored inputs with the price level set to the chosen price, plus the shock. Its seed comes from those inputs. 200,000 paths for each of the five models, so the odds at the end of the horizon are counted exactly.
- Labelled "Custom scenario, not an official run". Kept in its own tables, never in runs or fingerprints.
- Anyone can recheck it: "Recheck here" makes it again in the browser from the official run's inputs; `/api/burn/run/:id` has the inputs, seed and hashes.

## The burn
- A normal token transfer of at least the amount to 0x000000000000000000000000000000000000dEaD on chain 4663. Never an approval.
- The server checks the receipt: success, the exact token, the burn address, the amount, a block at or after the opening block, 2 confirmations. Each transfer is good for one run. The signature must come from the address the tokens left.
- Custom runs go one at a time at the very end of a ten-minute tick, after everything official is stored, and wait when the tick is late or slow or the official run failed. Three failed tries end a run; its burn can then be signed again, whatever the amount or opening block is by then.

## States
- **Not open** (any owner value unset): Pill "Not open yet", "Burning isn’t open.", no steps, no addresses.
- **Loading:** Skeletons; **Error:** "Couldn’t load burn-to-run. Try again."
- **Address mismatch:** "The token address here doesn’t match the official one, so burning is turned off. Please don’t burn."
- **Pending:** "Waiting for confirmation · 1 of 2" + PixelMeter.
- **Verified:** inverted Pill "Burn verified" + "Number {n} in the queue. Estimated wait: about {wait}." With Delayed pill when the official run is late.
- **Running:** empty PixelField + "Running 1,000,000 futures".
- **Done:** big %, PixelBars, the other side and the other horizons, "Recheck here", "Share", "View burn".
- **Not finished:** "The run didn’t finish. The burn still counts: paste its transaction hash in step 3 and sign again."
- **Not found:** "We couldn’t find that burn. Check the transaction hash and network."
- **Too small:** "This burn is below {amount} $QNTL, so it can’t start a run."
- **Other refusals:** one line each for a reverted transaction, another token, another recipient, an early block, another signer, a used burn and a price out of range.
- **Wallet:** none found (says to open the page in the wallet app’s own browser or on a computer before burning), closed, busy, another account, another network, too few tokens, a contract wallet. One line each; before the wallet sends, it says that nothing was sent.
- **Offline:** site banner, buttons off, "You are offline." next to them.
- **Gallery empty:** "No runs yet. The first burn starts the gallery."
- **Flag off:** /burn is the 404 page; every /api/burn endpoint is 404; the token card has no link.

## Privacy
Shortened addresses only, no amounts per person. "Anonymous" is part of the signed text: the address and the transaction are then left out of every answer (the burn itself stays public on the chain). A sent transaction hash is kept on the device until its request is made. No cookies; visitor addresses are never stored.

## Motion
Counter NumberRoll; PixelMeter steps. Reduced motion: instant.

## Reuses
Card, Input, Slider, AddressChip, CopyButton, CodeBlock, Accordion, NumberRoll, Pill, SegmentedTabs, Sheet, Skeleton, EmptyState, ErrorState, PixelMeter, PixelField, PixelBars, PixelSpark, and the tool's Answer, PriceBars and stat rows.

## As built
- Horizons replace "By date": the engine has only these three.
- "Share" copies the request's link.
- The running grid is the still, empty PixelField: a run takes seconds, so there is nothing to fill.
- Exchanges and contract wallets can't sign step 3 (EIP-191 from the burning address only); step 2 says so before the burn, and the page refuses to open a contract wallet (accounts with EIP-7702 code can still sign).
- Just before the wallet opens, the page reads `/api/burn` and `/api/config` again and works out the raw amount itself. Anything that differs from the screen stops it, and so does another account, network, token decimals or too small a balance. The transaction names the chain.
- The counter and the gallery are at most about 35 seconds old.
- Drift is the engine's log drift, the same control as the what-if tool: −30% moves the middle price by about −26%.
- Request limits are kept in memory only, by address (IPv6 by /64). Requests that can't be read never use up the shared limit.
- The counter counts burns used for runs, not every transfer to the burn address.
- Owner values: `QNTL_TOKEN_PONS`, `BURN_AMOUNT` (whole tokens), `BURN_FROM_BLOCK`. Tables: `worker/migrations/0003_burn.sql`.
