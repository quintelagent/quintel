# 06 · /status

**Flag:** none — launch · **Phase:** P0 · **Location:** `/status` (header link, footer, MobileMenu)

## Purpose
One honest page showing what's live, what's coming and when, and whether the system is healthy.

## Layout — phone
1. H1: "Status." Sub: "What's live, what's next, and how the system is running."
2. Health Card — three rows, each with a Pill (OK / Delayed / Down):
   - "Last run" — "10:40am ET · OK"
   - "Last fingerprint" — "10:00am ET · OK"
   - "Price feeds" — "Exchange OK · Token OK"
3. Groups (Section-style headers):
   - "Live" — rows with Pill "Live"
   - "Soon" — rows with Pill "Soon · Nov 25, 2pm ET"
   - "Planned" — rows with Pill "Planned"
   Each row: feature name (16px, 600), one line (`--ink-2`), Pill on the right (below the text on phone).
4. Links: "Changelog" · "Incidents".

## Layout — laptop
Health card as 3 columns; groups as single column, max 820px.

## States
- **Loading:** Skeleton rows.
- **Error:** "Status is unavailable right now. Try again." + button.
- **Feature released:** moves from Soon to Live automatically (from the registry); when SHIP_LOG is on, a "Shipped {time} ET" line appears under it for 24h.

## Copy (exact)
H1 "Status." · Health labels "Last run", "Last fingerprint", "Price feeds" · Group titles "Live", "Soon", "Planned".

## Data
Rendered entirely from `src/features.ts` (name, oneLine, status, releaseAt) + health endpoint. No hand-written statuses. Feature names come from the registry and must follow product rules (e.g. "Holders Board", not "NVDA Holders Board").

## Reuses
Section, Card, Pill, Skeleton, ErrorState.
