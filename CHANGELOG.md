# Changelog

All notable changes. Changes to paper-desk rules or Stress Level weights after launch are always listed here.

## [Unreleased]
### Site
- New design, “Paper lab”: light, phone first, one idea per screen. 1,000,000 pixels stand for 1,000,000 futures.
- New pages: Status, Incidents and this changelog. Docs on the site are rendered from the repo’s markdown.
- Removed the 3D scenario cloud and the scroll effects.

## Mon, Nov 23, 2026
### Fixed: pricing incident
- Runs **24 and 64 to 78** started from the Nov 20 close ($125.53) instead of the real price (about $159 and $165). On run 24, before the open, the token was 26% above that close, past the 25% sanity check, so its price was ignored. Before runs 64 to 78, daily history had refreshed only once that day and missed the Nov 23 close; the resulting 31% gap tripped the same check. Briefings and odds published for those runs were wrong. They are kept, unedited. The paper desk made no trades on them, and the scorecard only uses runs made while the market is open.
- History now retries every tick until the latest session is present; a stale close is never used when a stock quote is available; a large token move is accepted when the stock quote agrees.

### Changed
- The 0–100 gauge is now called Stress Level (same formula and weights). API: `stress` added; the older field name is kept so stored hashes still verify.
- Engine input v2 adds touch odds (the share of paths with at least one daily close beyond a level) and steps the random walk and jump models daily. v1 runs still verify unchanged.

## Earlier
- Engine: deterministic pure-JS `exp`/`log` (fdlibm), xoshiro128** PRNG, keccak256, five models, aggregation, Stress Level.
- Worker: cron tick, data adapters, on-chain NVDA token price, D1 schema, API, guarded research agent with daily AI spend cap, paper desk, hourly fingerprints, scorecard.
- Site: first version with drag-a-price, browser what-ifs, weekend gap, briefing, models, desk, proof, `/verify`, `/briefings`, `/docs`.
