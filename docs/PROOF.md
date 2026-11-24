# Proof

Quintel is built so that you don’t have to trust it. Each run’s output can be recomputed from its stored inputs. Each hour’s work is then committed to Robinhood Chain, and any change after that shows.

## What gets hashed

| Object | Hash |
|---|---|
| Run inputs | `inputHash = keccak256(canonical(inputs))` |
| Run output | `outputHash = keccak256(canonical(RunOutput))` |
| Briefing | `keccak256(canonical(briefing))` |
| Desk state | `keccak256(canonical(deskState))` after each run |
| Hour | `keccak256(canonical({hour, runIds[], inputHashes[], outputHashes[], briefingHashes[], deskStateHash}))` |

Canonical JSON means object keys are sorted, there is no whitespace, numbers use JavaScript’s shortest round-trip form, and `-0` is written as `0`.

## Hourly fingerprint

At the first tick of each hour, the worker builds that payload for the hour that just ended. It then sends a **0-value transaction from the fingerprint wallet to itself on Robinhood Chain (chain id 4663)** with the hash as calldata. The tx hash is stored. If the chain call fails, the fingerprint stays `pending` and is retried every 10 minutes, up to three hours at a time, oldest first. The attempts and the final send time are public in `/api/proof`, so any delay is visible.

Fingerprint wallet: [`0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47`](https://robinhoodchain.blockscout.com/address/0xdF2E620aa0A91F23C39eD31345CD0a548E02bB47). The worker refuses to post if its key does not match this address. All addresses: [Deployments](../DEPLOYMENTS.md).

## Verify in the browser

1. Open `/verify?run=<id>`.
2. The page downloads `/api/run/<id>`, which holds the stored inputs, seed, input hash and output hash.
3. It recomputes the input hash and the seed.
4. It re-runs all 1,000,000 paths in a Web Worker and recomputes `outputHash`.
5. It downloads the hour’s fingerprint payload, checks that it contains this run’s hashes, recomputes the fingerprint hash, and links the transaction on the explorer. On the explorer, the transaction’s input data should equal that hash.

## Verify from the command line

```bash
git clone <repo> && cd quintel && npm install
npx tsx engine/verify.ts <runId>
# or against another deployment:
QNTL_API=https://<host> npx tsx engine/verify.ts <runId>
```

The script prints each check as `match` or `NO MATCH`.

## Cross-engine determinism

Browsers are allowed to differ in the last bit of `Math.exp` and `Math.log`. The engine uses its own fdlibm ports instead, so outputs are identical in V8 (Chrome, Node, Workers), JavaScriptCore (Safari) and SpiderMonkey (Firefox). CI runs the engine in Chromium, WebKit and Firefox with Playwright and compares `outputHash` to Node’s.
