# 11 · Use Quintel from your AI (MCP)

**Flag:** MCP_SERVER · **Phase:** P1 launch-day drop · **Location:** `/mcp`; docs hub card "Use from your AI"; footer link when on

## Purpose
Let people add Quintel to Claude or Cursor in under a minute.

## Layout — phone
1. H1: "Use Quintel from your AI." Sub: "Ask Claude or Cursor for the latest scenario odds, briefings and proofs."
2. SegmentedTabs: "Claude" · "Cursor".
3. Numbered steps (1–3), each a Card with a short line + CodeBlock + Copy:
   - 1 "Copy the server address" — the MCP URL
   - 2 "Add it to {app}" — exact config snippet / settings path for that app
   - 3 "Ask a question" — example prompt: "What are the odds NVDA is above $186.64 in a month?"
4. "Tools" — Cards (DataTable on laptop): tool name (mono), one line, inputs. Use the real tool names from the server code.
5. Note Card: "Read-only. Quintel never trades, never sees your wallet, and never stores your questions."
6. Link: "Server status" → /status.

## Layout — laptop
Steps left (sticky tabs), tools table right.

## States
- **Copied:** Toast "Copied".
- **Server down:** Pill "Down" at top + "The MCP server is down right now. Check status." 
- **Flag off:** /mcp → "Soon" page.

## Copy (exact)
As above. Step titles: "Copy the server address", "Add it to Claude" / "Add it to Cursor", "Ask a question".

## Motion
None beyond press and tab switch crossfade.

## Reuses
Section, SegmentedTabs, Card, CodeBlock, CopyButton, DataTable, Pill, Toast.

## As built
- **Server:** `POST https://quintelagent.com/api/mcp` (`worker/src/mcp.ts`). Streamable HTTP, stateless, read-only, no sign-in. It answers both protocol eras: 2026-07-28 (per-request metadata, `server/discover`) and the older `initialize` handshake (2025-11-25, 2025-06-18, 2025-03-26). GET is 405, bodies stop at 64 KB, batches only exist for 2025-03-26 (10 at most). With the flag off every method is 404.
- **Tools:** one list, `web/src/lib/mcpTools.ts`, used by the server and the page: `get_latest_odds`, `get_odds_at_price`, `get_run`, `get_briefings`, `get_proof`. Every answer carries the run number, its time (Eastern and ISO) and "Scenario odds, not advice."
- **Odds at a price** use the same function as "Drag a price" (end of horizon). Only when the price is the level each run tracks (now $186.64) is the any-daily-close figure added, labeled as a different question. Past the stored range the text says <0.1% or >99.9% and no number is given.
- **Data:** tools read the public API in-process, so they share its cache. Run numbers past the newest run are refused before any read. Nothing sent to the server is logged or stored.
- **Setup steps** were checked against the Claude and Cursor docs on Nov 24, 2026. Step 2 for Claude has two ways in: a custom connector, and one command for Claude Code. Team and Enterprise need an Owner, and the Free plan has one custom connector, so a note says so. The example question uses the tracked level from the latest run.
- **Status line:** under the sub, the page pings the server once a minute. "OK" with "The server is answering.", or "Down" with the copy above and "Try again". Offline shows "Offline · updates paused". Its height is the same in every state.
- **Tools on tablet:** cards, two across. The table starts at 1100px.
- **Docs hub card** is last in the hub and says "Read" like the others.
