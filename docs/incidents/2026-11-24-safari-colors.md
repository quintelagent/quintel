---
date: 2026-11-24
status: Resolved
title: Pixel graphics could be drawn black on slow Safari loads
summary: Live from 2:12am to 3:31am ET on Nov 24. Numbers and text were not affected.
---

On Safari, a slow first load could run the page before its stylesheet arrived. The pixel graphics read their colors too early and were drawn solid black.

## What happened

- The new design went live at 2:12am ET with this problem in it.
- It was found at about 3:15am ET while checking a later change, and reproduced on the live site with a delayed stylesheet.

## What was affected

- The pixel grid, charts and sparklines, on Safari only, and only when the stylesheet was slow.
- Numbers, text, runs and fingerprints were not affected.

## What was done

- The page now waits for its stylesheet before drawing. Live at 3:31am ET and checked with the same delayed loads.
