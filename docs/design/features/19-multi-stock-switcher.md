# 19 · Multi-stock odds (planned — design only)

**Flag:** none yet (future MULTI_STOCK) · **Phase:** Planned — do not build now, but build everything else so this drops in later · **Location:** StockSwitcher in the hero (and header on laptop); future routes `/s/:symbol`

## Purpose
Same product for other Robinhood stock tokens (TSLA, AAPL…), same layout, one switcher.

## StockSwitcher
- Phone: a pill button in the hero eyebrow row: "NVDA" + chevron → bottom Sheet listing symbols. Each row: ticker (mono, 600), short company-free label ("Stock token"), status Pill ("Live" / "Soon" / "Planned"). Search Input once the list passes 8.
- Laptop: same pill in the header next to the wordmark; dropdown instead of Sheet.
- Tickers as plain text only — no company logos, colors or brand marks.

## What to build now (so it's easy later)
- Every data component takes a `symbol` prop (default "NVDA"); no hard-coded "NVDA" inside components.
- Copy strings with the ticker or reference price ($186.64) live in one per-symbol config (headline, sub, reference price, events).
- API calls take a symbol parameter, even if only NVDA exists.
- Reserve the switcher slot in hero and header (hidden while only one symbol exists).

## States (future)
- One symbol: switcher hidden.
- Symbol "Soon": selectable, shows a Soon page for that symbol with the release date.
- Switching: crossfade + PixelField wipe; URL updates to `/s/{symbol}`.

## Rules
Same product rules for every symbol: no company names or logos in product names, scenario odds, no advice, neutral news.

## Reuses
StockSwitcher, Sheet, Pill, Input, all existing sections.
