# Security

How Quintel handles keys, contracts and reports.

## Keys

- The site never asks for a private key or seed phrase, and never will. Only [Burn-to-run](https://quintelagent.com/burn) uses a wallet, and nothing else on the site needs one.
- One wallet does one job: the [fingerprint wallet](DEPLOYMENTS.md) sends 0-value transactions to itself. It holds a small amount of ETH for gas and nothing else, so losing its key could not move anyone's funds.
- Keys are Cloudflare Worker secrets. They are not in the code, the database or the logs. Public errors and logs are stripped of URLs and secret values (`worker/src/redact.ts`).
- The worker refuses to post a fingerprint if its key does not match the published wallet.
- Every commit and every CI run is scanned for secrets (`scripts/secret-scan.mjs`).

## Contracts

Quintel has deployed no smart contracts of its own. It reads the contracts listed in [Deployments](DEPLOYMENTS.md).

## Burn-to-run

- A burn is a normal $QNTL transfer from your own wallet to `0x000000000000000000000000000000000000dEaD`. There is no approval, no contract of ours and no account. Then you sign a plain message with your scenario, which is free and moves nothing.
- The worker reads the transaction's receipt and the current block from Robinhood Chain. It checks that the transfer succeeded, that the token, burn address and amount are right, that the block is at or after the opening block, and that the signature is from the wallet that burned. Each burn gets one run.
- **A burn can't be undone.** Nobody can return burned tokens, including us.
- A burn made before Burn-to-run opened, or below the amount on the page, gets no run.
- A burn doesn't change the odds, is not a share of anything, and pays nothing.
- Custom runs are kept apart from official runs and are not in any fingerprint. The address is shown shortened, or left out if you choose to be anonymous. The burn itself is always public on the chain.

## Your data

- No accounts, no cookies, no trackers.
- What you type into the tools stays in your browser. Burn-to-run is the exception: the scenario you sign is sent and published, and the full address, the burn and the signature are stored. The watchlist is saved only on your device.
- The site loads its own files and its own API. Verify also reads one public Robinhood Chain node.

## What the proof does and does not show

A fingerprint shows that a run existed by the time it was posted and has not changed since. It does not show that the odds are right. See [Proof](docs/PROOF.md) and [Limits](docs/LIMITS.md).

## Known limits

- One operator runs the worker, the database and the fingerprint wallet.
- Prices come from outside sources that can fail or be wrong. When one does, we say so in [Incidents](https://quintelagent.com/incidents).
- The code has not been audited by a third party.

## Report a problem

Please report security problems privately through [GitHub security advisories](https://github.com/quintelagent/quintel/security/advisories/new). Include what you found and how to reproduce it.

- **Response:** we aim to reply within 3 days.
- **In scope:** this repository, quintelagent.com, its API, the fingerprint flow and the monitoring worker.
- **Out of scope:** third-party services (Cloudflare, Robinhood Chain, Pons, Pump.fun, data providers), spam, and anything that needs access to someone else's device.
- **Please do not** disrupt the live site, flood it with requests or touch other people's data. There is no bounty program.

See also [Security review](SECURITY-REVIEW.md), [Trust](TRUST.md) and [Incidents](INCIDENTS.md).

*Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.*
