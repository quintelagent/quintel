# Limits

What Quintel can’t do, stated plainly.

- **It can’t know the future.** The models are calibrated on past prices. A genuinely new kind of event, which is the situation a crisis creates, can fall outside everything in the history.
- **The scenario odds are model outputs.** "38% of scenarios end the month higher" means 38% of the simulated paths do. It is not a 38% chance in any objective sense, and the live scorecard is the only evidence of calibration. The scorecard starts empty and fills in as horizons mature.
- **Five models aren’t the world.** No options-implied volatility, no order flow, no fundamentals, no cross-asset links (rates, semis index, other stocks).
- **News is a single dial.** Headlines only feed a 0–1 intensity that raises jump odds and the Stress Level. The engine does not interpret what a headline means for direction.
- **AI briefings can be wrong in wording.** Code guarantees that every number in a briefing comes from the run or a cited headline and blocks banned phrases. It cannot guarantee the prose is the best framing. Sources are linked so you can check.
- **The on-chain token isn’t the stock.** When the market is closed, runs start from the NVDA token price on Robinhood Chain. Thin weekend liquidity can make that price noisy. The token may also carry a corporate-action multiplier. If the token is more than 25% from the reference price and the stock quote does not agree with it, the token price is ignored for that run.
- **Data providers can fail.** Prices come through swappable adapters (Alpaca, Finnhub, Yahoo fallback). If all of them fail, the run is skipped rather than invented.
- **The paper desk is a demonstration.** It shows what simple published rules would have done on paper. It ignores fees, slippage and taxes, and it is not advice.
- **Max drawdown uses three of the five models.** GBM and jump are sampled only at the horizons, so they have no daily paths.
- **Fingerprints prove ordering, not correctness.** A fingerprint proves the outputs existed at that hour and haven’t changed. It doesn’t prove the models are good.
