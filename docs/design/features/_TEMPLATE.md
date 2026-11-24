# NN · Feature name

**Flag:** FLAG_NAME (or "none — launch")
**Phase:** P0 launch / P1 launch day / P2 after launch / Planned
**Route / location:** where it lives (page, section, header, overlay)

## Purpose
One sentence: what the user gets.

## Layout — phone (390px, build first)
Top-to-bottom list of what's on screen.

## Layout — laptop (1100px+)
What changes from phone.

## States
Loading · Empty · Error · Delayed · Locked/unlocked · Live/Soon/Planned · Market closed — every one that applies, with what the user sees.

## Copy (exact)
Every headline, label, button, empty/error line. Must pass SYSTEM.md sections 2 and 9.

## Motion
What moves, how (SYSTEM.md section 4), and the reduced-motion version.

## Reuses
Components from SYSTEM.md section 6. List any new component (and add it to SYSTEM.md).

## Data and privacy
Where the data comes from; what is never shown.

## Done when
- [ ] Matches this file at 375px and 1440px
- [ ] Every state above checked in the browser
- [ ] `npm run check:design` passes
- [ ] Registry entry in src/features.ts (flag, status, releaseAt, route)
