# Decisions

One line per judgment call, newest last.

- Hosting: one Worker with static assets (not Pages) so site, API and cron deploy together.
- Engine math: pure-JS `exp`/`log` (fdlibm ports) so every browser engine produces byte-identical output; only `Math.sqrt` (IEEE-exact) is used from the platform.
- Normal sampler: Marsaglia polar method (needs only log + sqrt, no trig).
- PRNG: xoshiro128** (32-bit, BigInt-free, fast in every JS engine), seeded via splitmix32 from the first 16 bytes of the seed hash. Spec said xoshiro256**; the 128-bit-state 32-bit variant is the same family and avoids BigInt slowness.
- GBM and Merton terminals are sampled exactly at each horizon via independent increments (1d, +4d, +16d) instead of 21 daily steps in engine input v1; bootstrap, GARCH and OU are path-simulated. Input v2 steps GBM and Merton daily so daily closes can be checked against the touch levels.
- Max drawdown is measured on the bootstrap, GARCH and OU only. GBM and jump step daily in v2 and are still left out, so the figure means the same thing across versions.
- AI: cheap model for triage, mid-tier model for briefings and desk notes; daily spend cap (default $4) falls back to templated text.
- Firefox determinism is checked in CI (Ubuntu); Playwright's Firefox does not launch on this dev Mac's OS version.
- History adapter order: Alpaca (SIP daily bars, split+dividend adjusted) → Yahoo chart API (keyless fallback, verified working).
- If the token/stock gap exceeds 25% the token price is ignored for that run (possible corporate-action multiplier).
- Token price fallback order: Uniswap pool via RPC_URL → public RPC → Chainlink → DexScreener, then GeckoTerminal (indexers of the same pool). Workers freeze timers during compute, so in-Worker run time is stored as null; timing is measured in tests.
- The gauge is called Stress Level. The older field name is kept in stored runs and the API so stored hashes still verify; the API adds `stress`.
- Runs affected by an incident are kept unedited and stay verifiable. The site leaves them out of sparklines and odds changes.
- Site graphics are 2D canvas pixels with no 3D or scroll libraries, so the phone version stays light.
- Docs, incidents and the changelog on the site are rendered from these markdown files at build time, so GitHub and the site match.
