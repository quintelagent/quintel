# Deployments

Every contract, wallet and service Quintel uses, with a link to check it. If an address is not on this page, it is not ours.

## Robinhood Chain (chain id 4663)

| What | Address |
|---|---|
| Fingerprint wallet (posts every hourly fingerprint) | [`0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47`](https://robinhoodchain.blockscout.com/address/0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47) |
| NVDA stock token (read only: price source while the market is closed) | [`0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC`](https://robinhoodchain.blockscout.com/address/0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC) |
| NVDA/USDG Uniswap V3 pool (read only) | [`0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3`](https://robinhoodchain.blockscout.com/address/0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3) |
| Chainlink NVDA price feed (read only: cross-check) | [`0x321A36e441DfBadA01Aa6f9884F14a344E133D1F`](https://robinhoodchain.blockscout.com/address/0x321A36e441DfBadA01Aa6f9884F14a344E133D1F) |
| $QNTL on Pons | Posted at launch |

The fingerprint wallet only sends 0-value transactions to itself, with the hour's hash as data. It holds a small amount of ETH for gas and nothing else. Every fingerprint in [/api/proof](https://quintelagent.com/api/proof) was posted from it, and the worker refuses to post from any other.

## Solana

| What | Address |
|---|---|
| $QNTL on Pump.fun | Posted at launch |

## Services

| What | Where |
|---|---|
| Site and API | [quintelagent.com](https://quintelagent.com) (Cloudflare Worker, D1 database, runs on a 10-minute schedule) |
| Public API | [/api/latest](https://quintelagent.com/api/latest) · [/api/proof](https://quintelagent.com/api/proof) · [/api/health](https://quintelagent.com/api/health) · [/api/config](https://quintelagent.com/api/config) |
| Public chain node used by the browser check | `https://rpc.mainnet.chain.robinhood.com` |
| Code | [github.com/quintelagent/quintel](https://github.com/quintelagent/quintel) |

## Check it yourself

1. Open [/verify](https://quintelagent.com/verify) and enter any run number.
2. Open its transaction on the explorer. It must come from the fingerprint wallet above, go to the same wallet, carry 0 value, and its input data must equal the fingerprint hash.

*Not affiliated with Nvidia, Robinhood, Pons or Pump.fun. Not financial advice.*
