# Expand an omitted segment — design reference

## Outcome

Make each `…` on a filtered, skipped edge a control. A click reveals all omitted original session entries strictly on the unique parentId path between that edge's two visible endpoints. Do not reveal siblings or recursively expand the rest of the tree. Revealed nonmatching entries are neutral gray context; type matches keep color. A collapse control for the same gap lets the user return to `…`. Filtering changes, opening another session, and returning to All reset per-gap expansion state. The source JSONL, annotations, and existing HTTP API are never changed.

## Mechanism

A gap identity is `JSON.stringify([fromId,toId])`. The unexpanded type projection remains the authority for validating expand requests. For each requested key that still corresponds to a skipped edge in that base projection, walk full-graph parentId pointers from `toId` back to `fromId`; add only intermediate IDs. The projected graph marks added nodes `context: true` and remembers a collapse control on its first restored edge. Keep ordinary derived skip links in other gaps, and never apply external edge/node decorations to expanded context. Invalid or stale gap keys do nothing, not arbitrary traversal. Frontend state is a Set of expanded gap keys; a click on `…` inserts one key and rerenders while preserving approximate scroll position; clicking the collapse marker removes it and rerenders. If the selected raw-entry panel points to a just-collapsed entry, close the panel and select a still-visible endpoint.

The indicator is an interactive SVG button, keyboard-accessible by Enter/Space, with different names/titles for expand and collapse. The collapse control anchors to the top edge of the restored run so it stays associated with the same logical omitted span and does not cover a restored card. The existing A/B/C shared renderer honors the same state. Other filters and full-screen mode remain usable.

## Verification

Pure tests: long skipped chain, exact restored IDs and order, sibling isolation, two independent gaps, invalid keys ignored, collapse returns the same projection, source graph unchanged. Headless browser: activate a filtered gap by click and keyboard, inspect gray restored entries and unchanged external decorations, collapse back to `…`, clear state on filter/session switch, and verify current main `/` and preview continue to render with positive geometry. Only synthetic fixtures; no foreground GUI.
