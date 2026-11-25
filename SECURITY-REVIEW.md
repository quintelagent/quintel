# Security review

**This is an internal review, not an audit.** It was done by the people who build Quintel. No third party has audited the code. Last updated Nov 24, 2026.

## Secrets

| Check | Where |
|---|---|
| Keys are Cloudflare Worker secrets, never in code, database or logs | `worker/src/config.ts`, `.gitignore` |
| Public errors and logs are stripped of URLs and secret values | `worker/src/redact.ts`, tested |
| Every commit, and every CI run, is scanned for secrets | `scripts/secret-scan.mjs`, `.githooks/`, `.github/workflows/ci.yml` |
| GitHub secret scanning and push protection are on | repository settings |
| The worker refuses to post from any wallet but the published one | `worker/src/proof/fingerprint.ts`, tested |

## What the worker can do

| It can | It cannot |
|---|---|
| Read prices, news and public chain data | Hold, move or approve anyone's tokens |
| Run the engine and store the results | Change a stored run without breaking its hash |
| Send 0-value transactions from the fingerprint wallet to itself | Send value (the code only ever sends 0), or use another wallet |
| Write briefings, which code checks against the run's numbers | Publish a number that is not in the run or the news |

One operator holds the Cloudflare account, the repository and the fingerprint key. That person could deploy different code. Stored runs and posted fingerprints would still show the difference: see [Proof](docs/PROOF.md).

## The API

- Read only for visitors. The one write route needs a secret token.
- Inputs are bounded, and extra query values cannot get around the cache.
- Answers come from a cache that serves the last good copy while one request refreshes it, so a crowd asking for the same thing rarely reaches the database. `/api/health` is never served stale. Tested with 500 visitors at once in `scripts/load-test.mjs`.

## The site

- No cookies, accounts, trackers or third-party scripts.
- Tool inputs stay in the browser. Nothing asks for a wallet today.
- Markdown is rendered from parsed tokens, not injected as HTML.

## Repository

- `main` cannot be force-pushed or deleted; release tags cannot be moved.
- CI uses a read-only token and pinned actions. Outside pull requests need approval before CI runs.
- Pull requests that add wallet code, approvals or new network hosts are closed unless discussed first.

## Known limits

- One operator, one database, one hosting provider.
- A fingerprint marked as posted means it was sent; the worker does not wait for a receipt. Before an hour is tried again, the chain is asked whether an earlier transaction landed. Verify reads the transaction from the chain.
- Outside price and news sources can fail or be wrong. The worker cross-checks prices, and what went wrong is in [Incidents](INCIDENTS.md).
- The site does not set a content security policy yet.

*Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.*
