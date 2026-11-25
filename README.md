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
  <a href="https://github.com/quintelagent/quintel/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/quintelagent/quintel/actions/workflows/ci.yml/badge.svg?branch=main" /></a>
  <a href="https://quintelagent.com/api/latest"><img alt="Latest run" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fquintelagent.com%2Fapi%2Flatest&query=%24.run.id&label=latest%20run&color=121212" /></a>
  <a href="https://quintelagent.com/verify"><img alt="Fingerprints on chain" src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fquintelagent.com%2Fapi%2Fproof&query=%24.sent&label=fingerprints%20on%20chain&color=121212" /></a>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-121212" />
</p>

An AI research agent and five quant models simulate NVDA’s possible paths, turn them into **scenario odds**, explain what changed in plain English, run a public paper-trading desk on those odds, and post a cryptographic fingerprint of every hour’s work on **Robinhood Chain**. Anyone can check that nothing was edited after its fingerprint was posted.

## Live today

| | |
|---|---|
| **1,000,000 futures per run** | Five models × 200,000 paths: random walk, jump-diffusion, history replay, GARCH(1,1) and mean reversion. Pure TypeScript with zero dependencies. ~1s per run. |
| **Around the clock** | Every 10 minutes while the market is open. Every 30 minutes while it is closed, priced off the on-chain NVDA token. |
| **Does it hold?** | The odds that the Nov 23 gain holds, the odds of a close back above a set level, and a Stress Level from 0 to 100 with public weights. |
| **Wall Street vs Chain** | The exchange price next to the on-chain token price, the gap, and the pool's 24-hour volume. |
| **Tools** | Drag a price, what-if shocks, weekend gap, and Check my position with a watchlist. All worked out on your device. |
| **Briefings** | An AI research agent every 30 minutes. Code rejects any number that isn't in the run or the news, and any advice wording. |
| **Paper desk** | $100k virtual, published rules, every trade with a note. Losses are shown like gains. |
| **Proof** | An hourly fingerprint on Robinhood Chain. Any run can be recomputed in the browser, byte for byte. |
| **Status, docs, incidents** | What is live, how it works, and anything that broke. |

## How it works

1. **Data.** Every 10 minutes the worker fetches the NVDA price, the on-chain token price (Uniswap V3 NVDA/USDG on Robinhood Chain, cross-checked against Chainlink) and new headlines. The 3 years of daily closes refresh once a day.
2. **Triage.** A fast model scores each headline. The scores become a news-intensity input.
3. **Simulate.** Five models × 200,000 paths each, seeded by `keccak256(inputs + timestamp)`, give percentiles, probabilities and the Stress Level.
4. **Explain and act.** A briefing is written and guard-checked. The paper desk applies its published rules.
5. **Prove.** Each hour, every run, input, briefing and desk hash is rolled into one fingerprint and sent on-chain.

## Trust

Nothing here needs to be taken on trust. Each claim has a place to check it.

| Claim | Where to check |
|---|---|
| 1,000,000 paths behind every run | `/api/run/<id>` has the inputs and seed. [Verify](https://quintelagent.com/verify) recomputes all of them in the browser. |
| Nothing was edited after its fingerprint posted | The hour’s hash is the input data of a transaction from [the fingerprint wallet](https://robinhoodchain.blockscout.com/address/0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47). |
| Late or missing fingerprints stay visible | [`/api/proof?all=1`](https://quintelagent.com/api/proof?all=1) lists every recorded hour, its attempts and when it was sent. |
| Same result in every browser | CI runs the engine in Chromium, WebKit and Firefox and compares hashes. |
| The paper desk follows fixed rules | Rules in [Methodology](docs/METHODOLOGY.md), every trade in [`/api/desk`](https://quintelagent.com/api/desk). |
| Mistakes are listed | [Incidents](docs/incidents), including the runs that started from a stale price. |

More: [Trust](TRUST.md) · [Security](SECURITY.md) · [Security review](SECURITY-REVIEW.md) (internal, not an audit) · [Incidents](INCIDENTS.md).

What is **not** proven: that the odds are right. See [Limits](docs/LIMITS.md). The code has not been audited by a third party.

### Addresses

| What | Robinhood Chain (chain id 4663) |
|---|---|
| Fingerprint wallet | [`0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47`](https://robinhoodchain.blockscout.com/address/0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47) |
| $QNTL on Pons | [`0x6997C0690DDE8e0d08e4D20A562f5d2817b54c5F`](https://robinhoodchain.blockscout.com/token/0x6997C0690DDE8e0d08e4D20A562f5d2817b54c5F) |

The full list is in [Deployments](DEPLOYMENTS.md). Quintel never asks for a private key, a seed phrase or a token approval.

## Verify a run

In the browser, open `https://quintelagent.com/verify?run=<id>`. From the command line:

```bash
npm install
npx tsx engine/verify.ts <runId>
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

`/api/latest` · `/api/run/:id` · `/api/runs?since=` (newest 200, up to 45 days back) · `/api/sample/:id` · `/api/output/:id` · `/api/briefings` · `/api/news` · `/api/history` · `/api/desk` · `/api/proof` (newest 48 hours, `?all=1` for every hour) · `/api/fingerprint/:hour` · `/api/fingerprint-for-run?id=` · `/api/scorecard` · `/api/health` · `/api/config`

## Docs

[Methodology](docs/METHODOLOGY.md) · [Proof](docs/PROOF.md) · [Limits](docs/LIMITS.md) · [Architecture](docs/ARCHITECTURE.md) · [Decisions](docs/DECISIONS.md) · [Deployments](DEPLOYMENTS.md) · [Trust](TRUST.md) · [Security](SECURITY.md) · [Incidents](INCIDENTS.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

---

**Not financial advice. Not affiliated with Nvidia, Robinhood, Pons or Pump.fun.** Scenario odds are model outputs, not predictions. The paper desk uses virtual money only. MIT licensed.
