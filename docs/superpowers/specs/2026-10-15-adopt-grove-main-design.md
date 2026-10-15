# Adopt conversation grove as the main session view

## Outcome

The user chose preview A and asked for a direct main interface. `/` and `/index.html` now show the conversation-grove tree, not the old horizontal dots. Keep the `/preview` comparison page available but do not expose variant tabs on the main page. The main page presents a clearly labeled synthetic example until a Pi JSONL is opened or the server retains a previous session; no private sessions are enumerated. Do not change the authenticated HTTP API, modify source JSONL, open windows automatically, or alter the isolated-record and VS Code pretty-copy behavior.

## Mechanism

Reuse the proven A grove renderer and associated style from the comparison page rather than maintaining two independent implementations. Serve its HTML on `/` in a main-view mode that hides comparison chrome; `/preview` remains a design sandbox. Main-view mode has a direct title, file chooser, sample switch, ID/type/none labels, type colors, source-scoped external annotations, copy API key and session ID controls, selected-record bottom sheet, and click-only editor action. Selection and current real session survive page refresh while the server remains alive. A demo is always explicitly marked synthetic and never written to a Pi session.

## Verification

A headless browser loads `/`, verifies visible A cards and branching on demo, uploads a synthetic JSONL and sees actual A cards and an isolated record, checks external node/edge overlays, refresh restoration, and confirms controls including API key copy are reachable. Existing `/preview` tests continue to pass. Screenshot of loaded main A inspected in background without taking focus. No migration, no remote service, no new dependency.
