# Security review

**This is an internal review, not an audit.** It was done by the people who build Quintel. No third party has audited the code. Last updated Nov 25, 2026.

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

- Read only for visitors, with one exception: `/api/burn/request` takes a signed scenario for a burn. The admin route needs a secret token.
- The burn route takes at most 8 KB, refuses anything that is not exactly the expected fields, and is limited per visitor and overall. It stores nothing until the burn is confirmed on the chain and the signature matches the wallet that burned.
- Inputs are bounded, and extra query values cannot get around the cache.
- Answers come from a cache that serves the last good copy while one request refreshes it, so a crowd asking for the same thing rarely reaches the database. `/api/health` is never served stale. Tested with 500 visitors at once in `scripts/load-test.mjs`.

## Burn-to-run

| It can | It cannot |
|---|---|
| Read a transaction receipt and the current block from Robinhood Chain | Move, approve or return anyone's tokens |
| Queue one public custom run for a confirmed burn | Give a run to a burn that is too small, too early, already used or signed by another wallet |
| Run at the end of a tick, after everything official is stored | Change an official run, the odds or a fingerprint |

- A burn can't be undone. A run that fails three times keeps its burn valid: it can be signed again.
- The worker trusts the nodes it reads. A private node is asked first, then the public one, and both must be on the right chain.
- Two confirmations are required. Robinhood Chain makes about ten blocks a second, so that is a fraction of a second. A deeper chain reorganization could remove a burn after its run.

## The site

- No cookies, accounts, trackers or third-party scripts.
- Tool inputs stay in the browser, except a scenario sent to Burn-to-run. That page is the only one that uses a wallet.
- The wallet is asked for one token transfer to the burn address, with no approval, and one plain signature. The page reads the token, amount and network again just before it opens the wallet, and stops if anything differs.
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
