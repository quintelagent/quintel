# Methodology

Quintel produces **scenario odds**, not predictions. Every official run simulates **1,000,000 paths** for NVDA: five models × 200,000 paths each. Each path covers 21 trading days, and the engine reports the distribution at three horizons: **next close (1d)**, **1 week (5d)** and **1 month (21d)**.

This page describes **engine input v2**, used since run 79. Runs 1 to 78 used v1, which has no touch odds. The differences are noted where they matter, and v1 runs still verify unchanged.

All code lives in [`/engine`](../engine). It is pure TypeScript with zero runtime dependencies. The same file runs in the Cloudflare Worker for official runs and in your browser for verification.

## Inputs

| Input | Source |
|---|---|
| Spot price | Stock price while the market is open. While it is closed, the on-chain NVDA token price (Uniswap V3 NVDA/USDG pool on Robinhood Chain, cross-checked against Chainlink). If the token price is unavailable or out of line, the last close is used. A close that misses the latest session is never used while a stock quote is available. |
| Daily closes | Up to 756 split-adjusted daily closes (about 3 years) |
| Intraday vol | Annualised realised vol from today’s 5-minute bars, market hours only (optional) |
| News intensity | 0–1, from the research agent’s headline triage (relevance-weighted, 6-hour half-life) |
| Token premium | (token − reference) / reference. The reference is the stock price while the market is open, otherwise the last close, or the latest stock quote if the history is behind. |
| Reference high | Configurable. Defaults to the highest close in the last 60 sessions. Stored under an older field name, kept so stored hashes still verify. |
| Touch levels (v2) | Two prices set before the run: the back-above level and the half-give-back level. |

The seed is `keccak256(canonical(inputs) + asOf)`, truncated to 64 bits. Inputs and seed are stored with every run.

## Calibration (shared)

- **Volatility σ:** RiskMetrics EWMA with λ = 0.94 on daily log returns. When intraday vol is available it is blended 50/50.
- **Drift μ:** half of the trailing 1-year mean daily log return. Historical drift is a noisy estimate, so it is shrunk toward zero.

## The five models

### 1. Random walk (GBM)
*Price drifts with today’s volatility and no memory — the textbook baseline.*

`log S(t+Δ) = log S(t) + (μ − σ²/2)Δ + σ√Δ · Z`

v2 runs step every path one day at a time (Δ = 1), so each daily close can be checked against the touch levels. v1 runs sampled each horizon directly with independent increments (1 day, then +4, then +16).

### 2. Jump (Merton jump-diffusion)
*Random walk plus sudden gaps, sized from past big moves and amplified when the news is loud.*

Jumps are daily returns more than 3 standard deviations from the mean. They give the jump intensity λ (per day) and the jump size distribution N(μJ, σJ). The live intensity is `λ × (1 + 2 × newsIntensity)`. The diffusion variance is σ² minus the jump variance, floored at σ²/4. The drift is compensated by `λk`, where `k = e^(μJ + σJ²/2) − 1`. Each step adds `N ~ Poisson(λΔ)` jumps, whose sum is `N·μJ + σJ√N·Z`. v2 runs step daily (Δ = 1). v1 runs sampled each horizon interval directly.

### 3. History replay (block bootstrap)
*Replays real past weeks of returns in random order — no bell-curve assumptions.*

Paths are built from blocks of 5 consecutive real daily returns, each block starting at a uniformly random point in the history. With no what-if shock applied, every simulated day is an actual historical return. A test enforces this.

### 4. Vol clusters (GARCH(1,1))
*Calm follows calm and storms follow storms: volatility reacts to every big day.*

`h(t+1) = ω + α·ε(t)² + β·h(t)`

ω, α and β are fitted by Gaussian maximum likelihood with a deterministic Nelder–Mead search on the last 756 returns. Stationarity (α + β < 0.999) is enforced, and the fit falls back to (0.08, 0.90) if it fails. Simulation starts from the last fitted conditional variance.

### 5. Bounce (mean reversion, Ornstein–Uhlenbeck)
*Price is pulled back toward its slow moving average — captures oversold bounces.*

`d` is the log-price deviation from the 50-day simple moving average. It is fitted as AR(1): `d(t+1) = φ·d(t) + σ_d·Z`, with φ clamped to [0.5, 0.995]. The average itself drifts with μ. Today’s deviation is measured from the current spot.

## Outputs

For each model and for the combined 1,000,000 paths, at each horizon:

- **Percentiles:** p1, p5, p10, p25, p50, p75, p90, p95, p99 (index `floor(q·N)` of the sorted terminals)
- **Histogram:** 60 buckets between the combined 0.1st and 99.9th percentiles. Out-of-range paths are clamped into the end buckets, so counts always sum to the path count.
- **Probabilities (combined):** P(up), P(down > 10%), P(down > 20%), P(above the reference high), and P(below L) for every round-number level L on a ±40% grid
- **Touch odds (v2 runs):** share of all 1,000,000 paths with at least one daily close above the configured level within 21 days, and share with at least one daily close at or below the half-give-back level within 5 days. Intraday touches are not counted.
- **Expected max drawdown (1 month):** the mean worst peak-to-trough over three models: history replay, vol clusters and bounce. Random walk and jump step daily in v2 but are still left out of this figure.
- **95% VaR (1 month):** `1 − p5 / spot`
- **Model agreement (0–100):** `100 × (1 − (2a + b))`, clamped. Here a is the standard deviation of the five 1-month medians and b is the standard deviation of their p10–p90 spreads, both divided by the mean spread.

## Gain kept (the home page number)

The share of all 1,000,000 paths that **keep at least half of the Nov 23, 2026 gain for a week**: `1 − touch.giveBack.p`. A path keeps it when no daily close over the next 5 trading days is at or below the halfway price between the Nov 20 and Nov 23 closes. Intraday moves are not counted, and the 5-day window starts from each run.

## Stress Level (0–100)

Labels: **0–33 Calm · 34–66 Elevated · 67–100 High.** The labels are display only and do not feed any rule.

The API exposes it as `stress`. Stored runs keep an older field name so stored hashes still verify.

The weights are public and live in the [engine source](../engine/src):

| Component | Weight | 0 at | 1 at |
|---|---|---|---|
| Realised vol (20d) ÷ its 1-year median | 0.35 | ≤ 0.8× | ≥ 2.5× |
| P(down > 20% at 1 month) | 0.30 | 0% | ≥ 25% |
| News intensity | 0.20 | 0 | 1 |
| Token vs stock gap (absolute) | 0.15 | 0% | ≥ 5% |

## “Back above” odds

The share of all 1,000,000 paths with at least one daily close above the configured level ($186.64) within 21 trading days: `touch.backAbove.p`. This counts any close on the way, so it is higher than the odds of ending above that level. Price tools on the site use end-of-horizon odds instead.

## Determinism

Byte-identical output in every JS engine is a hard requirement:

- PRNG: xoshiro128** (32-bit integer ops only), seeded via splitmix32. Each model gets its own stream.
- Normals: Marsaglia polar method, which needs only `log` and `sqrt`.
- `exp` and `log` are pure-JS fdlibm ports (`engine/src/math.ts`). Browsers may implement `Math.exp` and `Math.log` with different last-bit rounding, so they are never used. `Math.sqrt` is IEEE-exact everywhere.
- Fixed iteration order. Every stored number is rounded to 6 decimals before hashing.
- Canonical JSON (sorted keys, no whitespace), then keccak256 (pure TS).

## Paper desk rules

Rules are fixed at launch. Any change requires a public CHANGELOG entry.

- Virtual $100,000. NVDA only, long or flat, max 1×.
- **Enter long** when P(up, 1 week) ≥ 58% *and* the Stress Level is lower than at the previous run.
- **Exit** when P(up, 1 week) < 50%, or when the position is down 8% from entry (stop-loss).
- Fills only while the stock market is open, at the stock price. Marked to market after every run.
