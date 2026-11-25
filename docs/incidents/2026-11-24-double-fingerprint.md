---
date: 2026-11-24
status: Investigating
title: Two hourly fingerprints were posted twice
summary: Both copies carry the right hash. The record shows the second one, 10 minutes late.
---

The fingerprints for the hours starting 11am and 2pm ET on Nov 24 reached Robinhood Chain on time, but the worker recorded the first try as failed. Ten minutes later it sent each one again.

## What happened

| Hour (ET) | First transaction | Second transaction, shown in the record |
|---|---|---|
| 11am | [12:00:44pm](https://robinhoodchain.blockscout.com/tx/0x42cf20c722a7d148851c8b9ada68359399956bdb01b9d37e834b6a2f7363e6ff) | [12:10:41pm](https://robinhoodchain.blockscout.com/tx/0x5c171184a60cf67ad41563c79a21006b1948096f6b35b54368859bb6bbd82546) |
| 2pm | [3:00:40pm](https://robinhoodchain.blockscout.com/tx/0x89115017de5b94afb65c9e1c9649f61ed02e5a7cb0d88948f32fdb2baae8bb16) | [3:10:43pm](https://robinhoodchain.blockscout.com/tx/0xe69a7f9df0e80ab69756bbec544e3d3b7070200e9fbc489b8409efad243ac208) |

- The most likely cause: a node can accept a transaction and still answer with an error, and the worker took the error as "not sent". The error text was cleared when the second try succeeded, so this is not certain.
- The wallet has 47 transactions for 45 hours. The two extra ones are these.

## What was affected

- The stored send times for these two hours are 10 minutes later than the first post.
- Both copies carry the same correct hash. Runs, hashes and Verify were not affected.

## What was done

- The worker now signs each fingerprint once, sends the same signed bytes to every node, and asks the chain before signing another for that hour. This is written and tested, and goes live with the next deploy.
- The stored record is left as it is.
