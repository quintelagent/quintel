---
date: 2026-11-23
status: Resolved
title: Hourly fingerprints were posted late
summary: First posts at 12:30am ET on Nov 24. Backlog cleared at 1:50am ET.
---

Hourly fingerprints from 9pm ET on Nov 22 through Nov 23 were not posted when their hours ended. The first three reached Robinhood Chain at 12:30am ET on Nov 24.

## What happened

- Each hour’s hash was computed and stored on time. The on-chain post was late.
- The hours starting 9pm, 10pm and 11pm ET on Nov 22 were posted first, after 148 to 160 attempts each.
- Later hours waited behind them. The backlog then posted in order, three hours every 10 minutes.

## What it means for the record

- A fingerprint proves a run existed from the time it was posted, not from the time of the run.
- The attempts and the final send time of each hour are public in [/api/proof?all=1](https://quintelagent.com/api/proof?all=1).

## Where it stands

The backlog cleared at 1:50am ET on Nov 24, with 27 hours posted. At 1:53am ET, one hour was waiting for its next post. The current count is on the [status page](https://quintelagent.com/status).
