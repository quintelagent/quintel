# Trust: what the dev can and can't do

Plain answers about $QNTL and about Quintel itself. Values that exist only after launch say "Posted at launch".

## The token

| Question | Answer | Check it |
|---|---|---|
| Contract address | Posted at launch | [Deployments](DEPLOYMENTS.md) |
| Launch wallet | Posted at launch | explorer link at launch |
| Dev buy, and the burn of it | Posted at launch, with the transaction | explorer link at launch |
| Creator fee | Posted at launch: the rate, and that it pays for the engine, the data and the AI | [Pons fees](https://docs.ponsfamily.com) |

$QNTL is launched through Pons. The points below describe the Pons v2 contracts as published ([verified source](https://sourcify.dev/server/v2/contract/4663/0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e?fields=sources)). They are checked again against the real token at launch, and this page is corrected if anything differs.

| Can the dev… | |
|---|---|
| mint more? | No. The supply is minted once, 1,000,000,000 tokens. |
| pause transfers, or block a wallet? | No. The token has no owner, pause or blocklist. |
| add a transfer tax? | No. There is none in the token. A creator tax on trades, if any, is set at launch and cannot be changed. |
| upgrade or replace the contract? | No. It is not a proxy. |
| take the liquidity? | No. It is locked in a contract with no withdrawal function. |
| change the name, symbol or logo link? | No. The file behind the logo link can change unless its address is content-based. |
| change who receives the creator fee? | **Yes**, at once. |
| buy at launch? | **Yes**, in the launch transaction. Ours is listed above. |

**What Pons can do.** A Pons multi-signature wallet can redirect a launch's fees after a public 3-day delay, and can move a launch's reserves if it stays stuck between its curve and its pool for 7 days. Pons contracts had audits in progress and none completed when we last checked (Nov 24, 2026).

## What the token is for

Burning $QNTL requests a public run of 1,000,000 futures on your own scenario. What is open today is on [Status](https://quintelagent.com/status). The token does not change the odds, is not a share of anything, and pays nothing.

## Quintel

| | On chain | Off chain |
|---|---|---|
| Hourly fingerprints | Yes, from [one published wallet](DEPLOYMENTS.md) | |
| The token | Yes | |
| Runs, briefings, paper desk | Their hashes, inside the hourly fingerprint | The data itself, in a Cloudflare database |
| Prices | The token price is read from the chain | The stock price and news come from data providers |

**What the operator can do:** deploy new code, stop the service, change the paper-desk rules (listed in the [changelog](CHANGELOG.md)), and choose the data providers.
**What the operator can't do without it showing:** change a stored run, its inputs or a briefing after its fingerprint is posted.

## Check any run

1. Open [quintelagent.com/verify](https://quintelagent.com/verify) and enter a run number.
2. Your browser recomputes all 1,000,000 futures from the stored inputs and seed and compares the hashes.
3. It then reads the hour's fingerprint from Robinhood Chain.

Or from a terminal: `npx tsx engine/verify.ts <runId>`. Details are in [Proof](docs/PROOF.md).

*Not financial advice. Not affiliated with Nvidia, Robinhood, Pons or Pump.fun.*
