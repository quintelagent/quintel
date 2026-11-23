# Architecture

One Cloudflare Worker serves the static site, the JSON API and the 10-minute cron. Storage is Cloudflare D1.

```mermaid
flowchart LR
  subgraph Sources
    A[Alpaca / Finnhub / Yahoo<br/>price, history, news]
    R[Robinhood Chain<br/>NVDA/USDG pool + Chainlink]
  end
  subgraph Worker["Cloudflare Worker (cron */10)"]
    T[tick] --> D[data adapters]
    D --> N[agent triage<br/>cheap model]
    N --> E[engine<br/>5 models × 200K]
    E --> B[briefing + guards<br/>mid-tier model]
    E --> K[paper desk]
    B --> F[hourly fingerprint]
    K --> F
  end
  A --> D
  R --> D
  E --> DB[(D1)]
  B --> DB
  K --> DB
  F --> DB
  F -->|0-value tx, hash as calldata| R
  DB --> API[/JSON API/]
  API --> W[Site: Vite + React<br/>Three.js hero]
  W --> V[Web Worker<br/>same engine: what-ifs + /verify]
```

## Tick (every 10 minutes)

1. Fetch the stock quote and the on-chain token price.
2. Refresh daily history once per day. Triage new headlines and update news intensity.
3. Run the 1M-path engine. While the market is closed this happens every 30 minutes, priced off the token.
4. Update the paper desk. Write a briefing every 30 minutes, or immediately on big news or a move over 3%.
5. At the first tick of each hour, fingerprint the previous hour and retry any pending fingerprints.
6. At 00:30 ET, score matured horizons for the scorecard.

## AI cost control

Every OpenRouter call logs tokens and cost to `ai_usage`. Once the daily cap is reached (`AI_DAILY_CAP_USD`, default $4), briefings and desk notes switch to code-written templates until midnight ET. Live usage is shown at `/api/health`.

## Repo

```
engine/   pure TS engine (zero deps) + tests + verify CLI
worker/   Worker: cron, API, adapters, agent, desk, proof, D1 schema
web/      Vite + React site, Three.js hero, engine Web Worker
docs/     these documents
```
