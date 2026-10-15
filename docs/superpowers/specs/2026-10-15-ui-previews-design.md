# Three interactive tree views — design reference

## Outcome

The current horizontal depth layout degenerates into a monochrome line for mostly-linear Pi sessions. Deliver an independent `/preview` browser page with three selectable, actually interactive visual treatments using the same tree and selected record. This is for choosing a direction; do not replace the existing `/` viewer or modify the Pi JSONL, API semantics, or any real session automatically.

## Shared flow and boundaries

The preview defaults to an in-browser synthetic session with a long trunk, role variety, two forks and one external-demo annotation. If the current server still holds a browser-selected session ID, preview may load it through the existing authorized API; a file chooser also uploads a chosen JSONL into the same in-memory store, never writes back. Any real session's external overlays come from the existing annotations endpoint; synthetic overlays are clearly marked as demonstration. All three tabs share dataset, selected node, label mode (none/ID/type), type colors and the single-record bottom inspector. Caption mode affects only intrinsic node labels, never role cues or external overlays. Unknown types, multiple roots and absent parent warnings remain visible rather than filtered. No clickable option modifies the current main viewer.

## Three comparisons

A. **Conversation grove** — warm editorial vertical card tree: depth descends, branches shift to neighboring lanes, cards carry short read-only message previews plus role badges, parent-child connectors. A linear run occupies a readable vertical stack instead of a horizontal line.
B. **Metro tracks** — dark transit-style layout: sequential nodes wind across bounded-width rows; branch edges remain explicit and offshoots distinguishable. Cards are compact with role/type glyphs, not transcript cards. This favors path topology over content.
C. **Atlas / focus** — cool two-pane view: a compressed map of the complete tree on the left, an enlarged local slice (parent, selected node and children) on the right; click map nodes and local cards to move focus. Topological fidelity lives in the map; the local view is intentionally selective, not a replacement for the tree.

All three preserve exact IDs and parent/child relationships; no aggregating, losing or inventing nodes or edges. External node badges and highlighted edges work on the real session API and demonstration data alike. The inspector shows only the selected raw entry and does not write it. No forced GUI activation during verification.

## Verification

Pure tests use the same branching fixture to ensure every renderer's model covers all nodes (C map), all actual edges (A/B/C), line wrapping on long chains (B), and content/label overlays independent of type color. Headless browser tests open `/preview`, switch all tabs, verify positive visible bounds and screenshot each loaded layout, click node and check isolated record, and ensure the existing `/` remains served and unchanged. Do not read private old sessions for tests.
