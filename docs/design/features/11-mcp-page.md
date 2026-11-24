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
