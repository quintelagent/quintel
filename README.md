<p align="center">
  <img src="web/public/favicon.svg" width="72" alt="Quintel" />
</p>

<h1 align="center">Quintel</h1>

<p align="center"><b>1,000,000 futures for NVDA. Every 10 minutes.</b></p>

<p align="center">
  <a href="https://quintelagent.com">Site</a> ·
  <a href="https://quintelagent.com/verify">Verify</a> ·
  <a href="https://quintelagent.com/docs">Docs</a> ·
  <a href="https://x.com/quintelagent">X</a>
  <br/><br/>
  <img alt="CI" src="https://github.com/quintelagent/quintel/actions/workflows/ci.yml/badge.svg" />
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-121212" />
</p>

An AI research agent and five quant models simulate NVDA’s possible paths, turn them into **scenario odds**, explain what changed in plain English, run a public paper-trading desk on those odds, and post a cryptographic fingerprint of every hour’s work on **Robinhood Chain**. Anyone can check that nothing was edited after its fingerprint was posted.

## Features

| | |
|---|---|
| **1M-path engine** | Five models × 200,000 paths: random walk, jump-diffusion, history replay, GARCH(1,1) and mean reversion. Pure TypeScript with zero dependencies. ~1s per run. |
| **Live, 24/7** | Runs every 10 minutes while the market is open. While it is closed, runs every 30 minutes priced off the on-chain NVDA token. |
| **Stress Level** | A 0–100 blend of realised vol, tail odds, news intensity and the token/stock gap. The weights are public. |
| **Research agent** | Triage of every headline plus a briefing every 30 minutes. Code guards reject any number that isn’t in the run, and any advice wording. |
| **Paper desk** | $100k virtual, published rules, every trade with a note. Losses are shown like gains. |
| **Proof** | Hourly keccak256 fingerprint as calldata on Robinhood Chain. Late posts stay visible in `/api/proof`. Any run can be recomputed in the browser, byte for byte. |
| **Touch odds** | The share of all 1,000,000 paths with a daily close back above a set level within a month, or back below half of the Nov 23 gain within a week. |
| **Tools** | Drag a price, weekend gap, what-if shocks that rerun 500,000 paths in your browser, and a position check that runs 100,000 paths on your device. |
| **Docs and incidents** | Every document on the site is rendered from this repo. Anything that broke is listed with what was done. |

## How it works

1. **Data.** Every 10 minutes the worker fetches the NVDA price, 3 years of daily closes, the on-chain token price (Uniswap V3 NVDA/USDG on Robinhood Chain, cross-checked against Chainlink) and new headlines.
2. **Triage.** A fast model scores each headline. The scores become a news-intensity input.
3. **Simulate.** Five models × 200,000 paths each, seeded by `keccak256(inputs + timestamp)`, give percentiles, probabilities and the Stress Level.
4. **Explain and act.** A briefing is written and guard-checked. The paper desk applies its published rules.
5. **Prove.** Each hour, every run, input, briefing and desk hash is rolled into one fingerprint and sent on-chain.

**Quintel fingerprint wallet:** [`0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47`](https://robinhoodchain.blockscout.com/address/0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47) (Robinhood Chain, chain id 4663)

## Verify a run

In the browser, open `/verify?run=<id>`. From the command line:

```bash
npm install
QNTL_API=https://quintelagent.com npx tsx engine/verify.ts <runId>
```

See [docs/PROOF.md](docs/PROOF.md).

## Quick start

```bash
npm install
npm test                       # engine + worker tests
npm run test:browsers          # determinism in Chromium, WebKit, Firefox
npx wrangler d1 migrations apply quintel --local
npm run build && npx wrangler dev --test-scheduled
# trigger a tick:
curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" "http://127.0.0.1:8787/api/admin/tick?force=1"
```

Secrets are set with `wrangler secret put`, or in `.dev.vars` locally (gitignored): `OPENROUTER_API_KEY`, `ALPACA_KEY_ID`, `ALPACA_SECRET_KEY`, `FINNHUB_API_KEY`, `FINGERPRINT_KEY`, `ADMIN_TOKEN`.

## API

`/api/latest` · `/api/run/:id` · `/api/runs?since=` · `/api/sample/:id` · `/api/output/:id` · `/api/briefings` · `/api/desk` · `/api/proof` · `/api/scorecard` · `/api/health` · `/api/config`

## Docs

[Methodology](docs/METHODOLOGY.md) · [Proof](docs/PROOF.md) · [Limits](docs/LIMITS.md) · [Deployments](docs/DEPLOYMENTS.md) · [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md) · [Incidents](docs/incidents) · [Changelog](CHANGELOG.md)

---

**Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.** Scenario odds are model outputs, not predictions. The paper desk uses virtual money only. MIT licensed.
