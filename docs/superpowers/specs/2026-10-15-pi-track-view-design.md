# pi-track-view — local Pi session tree viewer

## Outcome and boundaries

Replace the discredited pi-trajectory research application with a separate local browser-based application, pi-track-view. The old directory (including ignored copied sessions and git history) is deleted only after the replacement runs and tests pass. The application never writes to a selected Pi session. No learning, scoring, profiles, session management, scanning, remote sharing, or automatic VS Code launching.

## Data flow

User selects a `.jsonl` in a browser file chooser → browser uploads its contents to a 127.0.0.1 Node server → server validates Pi session header and id/parentId graph and retains the raw entries in memory → browser draws the full forest and selected single entry. Session identity is an opaque generated ID retained in browser localStorage; refresh fetches the same server-owned session. Server restart loses sessions and annotations and requires re-selection. No Pi directory enumeration or filesystem path access from HTTP.

Pi header is metadata, not a node. Every other entry is a node, including unknown types, usage, label, custom, branch summary, context edit, and multiple roots. The type of a node is its entry `type`, not the message role. Preserve file order among siblings and show orphan entries as separate roots with a warning rather than hiding them; reject duplicate IDs and cycles. Bad input produces a user-visible error without replacing the current session.

## UI and interaction

A local static HTML/CSS/JS app with SVG tree, panning/zooming, selected-node focus, visible type legend, three intrinsic label modes (none / ID / type), and stable type→color mapping (same in all modes). External labels and highlights are separate overlays, never substitutes for the intrinsic label mode. Selecting one node raises a lower detail panel containing only that entry, rendered with role/content blocks when it is a message, and optionally its raw JSON; no ancestor transcript. External edge labels and highlights render along the parent-child connection. Text content is always rendered as text, never raw HTML. Nodes and edges have accessible names and the detail can be opened by keyboard.

## External integration

Bind loopback only. A startup-random bearer token is displayed in the UI for trusted local external programs. JSON API: `PUT /api/sessions/:sessionId/annotations/:source` replaces one source's annotation set, `{nodes:[{id,label?,highlight?}],edges:[{from,to,label?,highlight?}]}`; `DELETE` clears that source. Validate exact target IDs and parent-child edges, source names and string lengths, reject invalid requests atomically. Concurrent sources coexist in deterministic source-name order. Browser polls a small annotations endpoint and never writes annotations into session contents. Session upload and read APIs, and editor-open API use the same token; reject cross-origin mutation and non-loopback Host headers. No CORS grants. Process restart clears token, sessions and overlays.

## VS Code button

Only on explicit click, the server creates a private temporary `.json` file containing an indented JSON array of all session records in original line order, then asks the `code` CLI to open that copy. JSONL itself cannot be multiline pretty-printed while remaining valid JSONL. Never modify/open the original in place. Show a useful error when `code` is unavailable. The temp directory is private and removed at server exit; do not send contents to remote services.

## Verification

Node built-in tests cover parsing (branching, multiple roots, unknown entries, malformed input, duplicate IDs, cycles), annotation validation and source isolation, refresh/restart semantics and token/origin/host checks, editor copy formatting and original bytes unchanged, and viewer behavior via pure layout/label/render helpers. No GUI validation may activate a window; browser verification can use an unactivated headless browser if available or report the limitation explicitly. Test against synthetic sessions only; do not read or serve old copied private sessions.
