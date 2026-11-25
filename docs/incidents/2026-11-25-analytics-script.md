---
date: 2026-11-25
status: Resolved
title: An analytics script was on the site
summary: Cloudflare added it for about 3 days. Our security pages said there was none. Turned off at 11:03am ET on Nov 25.
---

Cloudflare Web Analytics was adding its script to the site for about 3 days. SECURITY.md and SECURITY-REVIEW.md said there were no trackers and no third-party scripts. Those lines were wrong while it was on.

## What happened

- The setting was on in our Cloudflare account. The script was not in this repository.
- We found it on Nov 25 while checking a site change.

## What was affected

- Pages sent page-view and speed measurements to Cloudflare. Cloudflare's setting left out visitors in the EU.
- Runs, odds and fingerprints were not affected.

## What was done

- The setting was turned off at 11:03am ET on Nov 25. We checked that the script was gone from `/`, `/verify`, `/status` and `/docs`.
- No code change was needed.
