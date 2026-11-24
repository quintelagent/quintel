# Security

How Quintel handles keys, contracts and reports.

## Keys

- The site never asks for a private key or seed phrase, and never will. Nothing on it needs a wallet today.
- One wallet does one job: the [fingerprint wallet](DEPLOYMENTS.md) sends 0-value transactions to itself. It holds a small amount of ETH for gas and nothing else, so losing its key could not move anyone's funds.
- Keys are Cloudflare Worker secrets. They are not in the code, the database or the logs. Public errors and logs are stripped of URLs and secret values (`worker/src/redact.ts`).
- The worker refuses to post a fingerprint if its key does not match the published wallet.
- Every commit and every CI run is scanned for secrets (`scripts/secret-scan.mjs`).

## Contracts

Quintel has deployed no smart contracts of its own. It reads the contracts listed in [Deployments](DEPLOYMENTS.md).

## Your data

- No accounts, no cookies, no trackers.
- What you type into the tools stays in your browser. The watchlist is saved only on your device.
- The site loads its own files and its own API. Verify also reads one public Robinhood Chain node.

## What the proof does and does not show

A fingerprint shows that a run existed by the time it was posted and has not changed since. It does not show that the odds are right. See [Proof](PROOF.md) and [Limits](LIMITS.md).

## Known limits

- One operator runs the worker, the database and the fingerprint wallet.
- Prices come from outside sources that can fail or be wrong. When one does, we say so in [Incidents](https://quintelagent.com/incidents).
- The code has not been audited by a third party.

## Report a problem

Please report security problems privately through [GitHub security advisories](https://github.com/quintelagent/quintel/security/advisories/new). Include what you found and how to reproduce it. Please do not test against the live site in a way that could disrupt it. There is no bounty program.

*Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.*
