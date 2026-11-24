# 05 · Live activity feed (toasts)

**Flag:** none — launch · **Phase:** P0 · **Location:** global overlay (LiveToasts) + the feed list in the home "Briefing + live feed" section

## Purpose
Make the site feel alive: show each new run, briefing, fingerprint and desk trade as it happens.

## Layout — laptop
Bottom-left stack, max 3 toasts, 360px wide, 24px from edges. Newest at the bottom. Auto-dismiss after 6s; hover pauses the timer.

## Layout — phone
One toast at a time, full width minus 16px each side, sitting just above the StickyBar (or above the safe area when the bar is hidden). Never covers buttons. Swipe down or tap × to dismiss.

## Event types and copy (exact)
| Type | Toast text | Tap goes to |
|---|---|---|
| New run | "New run · 71.4% keep half of Monday's gain (+0.4 pts)" | hero |
| New briefing | "New briefing · {headline}" | the briefing |
| Fingerprint | "Fingerprint posted on Robinhood Chain" + "View" | /verify (latest) |
| Desk trade | "Paper desk opened a position" / "Paper desk closed a position" | paper desk |

Never show wallet addresses, amounts, sizes or P&L in toasts.

## Rules
- No toasts in the first 5s of a visit.
- Phone: max 1 toast per 20s; extra events go only to the feed list.
- Pause while the tab is hidden; on return, show at most 1 summary toast: "3 updates while you were away".
- "Mute live updates" toggle in the footer and the MobileMenu (remembered in localStorage). Muted = feed list only.

## States
- **Offline:** no toasts; feed list header shows Pill "Offline · updates paused".
- **Reconnecting:** Pill "Reconnecting…".
- **Feed list empty:** "Updates show up here as runs finish."

## Motion
Slide up 16px + fade, 250ms; exit fade 150ms. Reduced motion: appear/disappear only.

## Reuses
Toast, LiveToasts, Pill, EmptyState. Announce new runs via a polite live region (max once per minute).

## As built
- Fingerprints posted within 2 minutes share one row ("3 fingerprints posted on Robinhood Chain").
- Incident runs read "Run {n} is listed in incidents"; runs without gain odds read "Run {n} finished".
