# Architecture

One Cloudflare Worker serves the static site, the JSON API and the 10-minute cron. Storage is Cloudflare D1.

## Data flow

| Stage | What happens |
|---|---|
| Sources | Alpaca, Finnhub and Yahoo for price, history and news. Robinhood Chain for the NVDA/USDG pool and Chainlink. DexScreener for the pool's 24-hour volume. |
| Worker tick | The cron starts the data adapters every 10 minutes. |
| Agent triage | A cheap model scores new headlines. |
| Engine | Five models, 200,000 paths each. |
| Briefing and paper desk | A mid-tier model writes the briefing and code guards check it. The desk applies its published rules. |
| Hourly fingerprint | A 0-value transaction on Robinhood Chain carries the hash as calldata. |
| Storage | Runs, briefings, desk state and fingerprints go to D1. |
| API | Answers come from a short cache that keeps the last good copy while one request refreshes it. |
| Site | Vite and React read the JSON API. A Web Worker runs the same engine for what-ifs and `/verify`. |

## Tick (every 10 minutes)

1. Fetch the stock quote and the on-chain token price.
2. Refresh daily history once per day, and retry every tick until the latest session is present. Triage new headlines and update news intensity.
3. Run the 1M-path engine. While the market is closed this happens every 30 minutes, priced off the token.
4. Update the paper desk. Write a briefing every 30 minutes, or immediately on big news or a move over 3%.
5. At the first tick of each hour, fingerprint the previous hour. Every tick retries up to three pending fingerprints, oldest first. Before an hour is tried again, the chain is asked whether an earlier transaction landed.
6. At 00:30 ET, score matured horizons for the scorecard.

## AI cost control

Every OpenRouter call logs tokens and cost to `ai_usage`. Once the daily cap is reached (`AI_DAILY_CAP_USD`, default $4), briefings and desk notes switch to code-written templates until midnight ET. Live usage is shown at `/api/health`.

## Repo

```
engine/   pure TS engine (zero deps) + tests + verify CLI
worker/   Worker: cron, API, adapters, agent, desk, proof, D1 schema
monitor/  separate read-only Worker that watches the site, runs and fingerprints
web/      Vite + React site, canvas pixel graphics, engine Web Worker
scripts/  design check, secret scan, load test and feature release
docs/     these documents, the design system and incident reports
```
