# Changelog

All notable changes. Changes to paper-desk rules or Stress Level weights after launch are always listed here.

## [Unreleased]
### Fixed — pricing incident, 23–24 Nov 2026
- Runs **24 and 64 onwards until this fix** started from the 20 Nov close ($125.53) instead of the real price (about $159 and $165). Daily history refreshed only once per day and missed the 23 Nov close; the resulting 31% token gap then tripped the sanity check, so the correct token price was ignored too. Briefings and odds published for those runs were wrong. They are kept, unedited. The paper desk made no trades on them, and the scorecard only uses runs made while the market is open.
- History now retries every tick until the latest session is present; a stale close is never used when a stock quote is available; a large token move is accepted when the stock quote agrees.

### Changed
- “Crisis Level” is now “Stress Level” (same formula and weights). API: `stress` alias added; `crisis` kept.
- Engine input v2 adds touch odds (chance of at least one daily close beyond a level) and steps GBM/jump daily. v1 runs still verify unchanged.

### Earlier
- Engine: deterministic pure-JS `exp`/`log` (fdlibm), xoshiro128** PRNG, keccak256, five models, aggregation, Stress Level.
- Worker: cron tick, data adapters, on-chain NVDA token price, D1 schema, API, guarded research agent with daily AI spend cap, paper desk, hourly fingerprints, scorecard.
- Site: live scenario cloud, drag-a-price, browser what-ifs, weekend gap, briefing, models, desk, proof, `/verify`, `/briefings`, `/docs`.
