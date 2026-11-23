# Decisions

One line per judgment call, newest last.

- Hosting: one Worker with static assets (not Pages) so site, API and cron deploy together.
- Engine math: pure-JS `exp`/`log` (fdlibm ports) so every browser engine produces byte-identical output; only `Math.sqrt` (IEEE-exact) is used from the platform.
- Normal sampler: Marsaglia polar method (needs only log + sqrt, no trig).
- PRNG: xoshiro128** (32-bit, BigInt-free, fast in every JS engine), seeded via splitmix32 from the first 16 bytes of the seed hash. Spec said xoshiro256**; the 128-bit-state 32-bit variant is the same family and avoids BigInt slowness.
- GBM and Merton terminals are sampled exactly at each horizon via independent increments (1d, +4d, +16d) instead of 21 daily steps; bootstrap, GARCH and OU are path-simulated.
- Max drawdown is measured on the three path-simulated models only (GBM/jump do not have daily paths).
- AI: cheap model for triage, mid-tier model for briefings and desk notes; daily spend cap (default $4) falls back to templated text.
- Firefox determinism is checked in CI (Ubuntu); Playwright's Firefox does not launch on this dev Mac's OS version.
- History adapter order: Alpaca (SIP daily bars, split+dividend adjusted) → Yahoo chart API (keyless fallback, verified working).
- If the token/stock gap exceeds 25% the token price is ignored for that run (possible corporate-action multiplier).
