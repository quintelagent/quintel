# 14 · Ship log

**Flag:** SHIP_LOG · **Phase:** P1 launch-day drop · **Location:** `/changelog`; "Shipped" toasts (feature 05); "Shipped {time}" lines on /status

## Purpose
Show, live, that the product keeps shipping — every release with its time.

## Layout — /changelog (phone)
1. H1: "Changelog." Sub: "Everything we've shipped, newest first."
2. Today group (when anything shipped today): inverted "Shipped" Pill per row, time ET, feature name, one line, link to the feature.
3. Older entries grouped by date: date header (mono), rows (title, one line, optional "Read more" accordion for details).

## Layout — laptop
Single column, max 720px, date headers in a left gutter.

## States
- **New release while viewing:** row slides in at top + "Shipped" toast.
- **Empty:** "The first release notes post at launch."
- **Flag off:** /changelog still renders CHANGELOG.md as plain list (no live feed, no toasts).

## Data
Parsed from CHANGELOG.md at build time; `npm run ship <FLAG>` appends an entry (name and oneLine from src/features.ts) so the site updates on deploy. One source of truth.

## Copy
Entry titles are plain ("Holders Board is live"), never hype.

## Reuses
Section, Pill, Accordion, Toast, EmptyState.
