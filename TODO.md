# TODO

## Phase 0 — Scaffold
- [x] Monorepo, wrangler config, CI, MIT
- [ ] `wrangler login` (human) → D1 create → first deploy
- [ ] Production domain attached (human: domain on Cloudflare)

## Phase 1 — Engine
- [x] Pure-JS exp/log, PRNG, keccak, canonical JSON
- [x] Five models, calibration, aggregation, Crisis Level
- [x] Tests green, 1M paths ≈ 1.1s (Node, M-series)
- [x] Cross-browser determinism (Chromium + WebKit pass locally; Firefox in CI)

## Phase 2 — Data + cron + API
- [x] Adapters: Alpaca, Finnhub, Yahoo fallback; Uniswap V3 pool + Chainlink
- [x] NYSE calendar, tick logic, D1 schema, all /api routes
- [ ] Secrets set in production (human)
- [ ] Runs every 10 min on deploy

## Phase 3 — Site
- [x] All sections, mobile fallback, /verify, /briefings, /docs
- [ ] OG image, Lighthouse pass, phone check

## Phase 4 — Agent + desk
- [x] Triage, briefing, guards, AI cap, desk + notes
- [ ] Live guarded briefing (needs OpenRouter key)

## Phase 5 — Proof
- [x] Fingerprint tx code, verify page + CLI, scorecard empty state
- [ ] First real fingerprint on explorer (needs funded wallet key)

## Phase 6 — Launch
- [ ] Copy pass vs rules, README links, tag v1.0.0
