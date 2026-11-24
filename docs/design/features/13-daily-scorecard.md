# 13 · Daily scorecard

**Flag:** DAILY_SCORECARD_PUBLIC · **Phase:** P1 launch-day drop · **Location:** `/scorecard`; teaser card in the home Proof section

## Purpose
Show plainly how the odds bands did against what actually happened, misses included.

## Layout — /scorecard (phone)
1. H1: "How our odds did." Sub: "Every day we check the closing price against the bands from the run before. Misses stay up."
2. Summary Card: "Last 30 days: inside the 80% band 24 of 30 times (80.0%)." + PixelBars row: one pixel per day (ink = inside, red with hollow center = outside).
3. Day list (newest first), each row:
   - date (mono) · result Pill "Inside band" (ink) or "Outside band" (risk)
   - "80% band: $171.20 – $196.40" · "Close: $188.10"
   - Misses add a plain line: "Missed: closed at $203.10, above the band."
4. Link: "How bands are scored" → Methodology doc.

## Layout — laptop
Summary card full width; day list as a DataTable (date, band, close, result).

## Home teaser (Proof section)
Small Card: "Inside the 80% band 24 of 30 days" + PixelBars row + "See the scorecard".

## States
- **Empty:** "Collecting data. The first score posts after the next market close."
- **Fewer than 30 days:** summary uses the real count ("4 of 5 days").
- **Loading / error:** Skeleton / ErrorState.
- **Flag off:** route "Soon" page, teaser hidden.

## Copy rules
Use "Inside band" / "Outside band", never "right/wrong" or "accuracy" claims beyond the stated count. Never hide or soften misses.

## Reuses
Section, Card, Pill, PixelBars, DataTable, EmptyState, Skeleton, ErrorState.
