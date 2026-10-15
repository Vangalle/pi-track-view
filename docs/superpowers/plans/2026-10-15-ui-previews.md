# Three Tree UI Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide one usable `/preview` page where the user can compare three tree layouts on the same Pi session before choosing a final view.

**Architecture:** Pure preview model/layout functions derive coordinates and scene relationships from real Pi entry IDs/parentIDs. A separate vanilla-JS preview client renders A/B/C and a shared single-record bottom inspector; the current `/` app and API remain intact.

**Tech Stack:** Node.js 22, built-in `node:test`, HTML/CSS/SVG, existing in-memory HTTP API, headless Chrome when present.

**Spec:** `docs/superpowers/specs/2026-10-15-ui-previews-design.md`

## Global Constraints

- `/preview` is optional comparison, never replaces `/` or changes session/annotation API behavior.
- Synthetic demo never uses private Pi session data; user-chosen files are uploaded read-only as before.
- Every entry remains addressable by ID, every edge corresponds to a real parent→child; keep single-record bottom inspector.
- Intrinsic none/ID/type labels, type colors and external labels/highlights stay independent across variants.
- Background/headless GUI validation must not activate a visible window.

## Review Focus

- One thousand-entry linear session: B wraps and C remains navigable, instead of rendering a single invisible line (Task 1 tests).
- Multiple roots and missing parents: all roots remain reachable in A/B/C (Task 1 tests).
- Unknown entry type and long hostile text: visible as text only, no raw HTML injection (Task 2 browser test).
- Opening a real file or reusing a current session: error does not corrupt current preview and overlays are source-preserving (Task 2 browser test).
- Switching tabs after selecting a node: selection, label mode and overlay survive, inspector remains one record (Task 2 browser test).

---

### Task 1: Shared fixture and three layout models

**Files:** Create `web/preview-data.mjs`, `web/preview-layouts.mjs`, `test/preview-layouts.test.mjs`.

**Interfaces:** `demoSession():{id,header,entries,roots,warnings}`; `demoOverlay():{nodes,edges}`; `toGraph(session):{nodes:Map,roots}`; `groveLayout(graph):{positions:Map,edges,width,height}`; `metroLayout(graph):{positions:Map,edges,width,height}`; `atlasLayout(graph):{positions:Map,edges,width,height}`; `focusNeighborhood(graph,id):{parent,node,children}`. All positions use stable node IDs; edge arrays use `{from,to}`.

- [ ] **Step 1: Write failing tests**: fixture contains long trunk and branch; all three layouts cover all IDs/edges; metro wraps chain; atlas neighborhood uses only real relationships; unknown types and multiple roots preserved.
```js
const graph=toGraph(demoSession());
for(const layout of [groveLayout,metroLayout,atlasLayout]) {
  const result=layout(graph);
  assert.equal(result.positions.size,graph.nodes.size);
  assert.equal(result.edges.length,graph.nodes.size-graph.roots.length);
}
assert.equal(new Set([...metroLayout(graph).positions.values()].map(p=>p.y)).size>1,true);
```
- [ ] **Step 2: Run `node --test test/preview-layouts.test.mjs`; expected missing module failure.**
- [ ] **Step 3: Implement fixture and iterative layout helpers** in the named files; handle 1000-node linear data without stack recursion.
- [ ] **Step 4: Run `node --test test/preview-layouts.test.mjs` and `npm test`; expected PASS. Commit the slice.**

### Task 2: Functional comparison page and browser verification

**Files:** Create `web/preview.html`, `web/preview.css`, `web/preview.mjs`, `test/preview.test.mjs`; modify `src/server.mjs` static allowlist only.

**Interfaces:** `GET /preview` serves preview HTML, `GET /preview.css`, `/preview.mjs`, `/preview-data.mjs`, `/preview-layouts.mjs` serve named assets. Browser imports `/bootstrap.mjs`, uses current `/api/sessions` and `/api/sessions/:id/annotations` with same bearer token, draws an A/B/C SVG scene and one selected-record inspector.

- [ ] **Step 1: Write failing HTTP and headless-browser tests**: page and assets 200 while `/` unchanged, demo rendered with visible node bbox in each tab; switching preserves selected ID and label mode; clicking shows one raw record; uploaded synthetic file and external overlay also render without page writing the source.
```js
assert.equal((await fetch(base+'/preview')).status,200);
assert.equal((await fetch(base+'/')).status,200);
// CDP: select each [data-view] tab, assert document.querySelectorAll('.preview-node').length > 0
// and first node's getBoundingClientRect().width > 0 after every tab switch.
```
- [ ] **Step 2: Run `node --test test/preview.test.mjs`; expected 404/missing page failure.**
- [ ] **Step 3: Implement three distinct CSS treatments and JS renderers** on shared graph, demo/real session selector, name/type/none switch, overlay badges and edges, zoom/scroll or focus navigation, isolated bottom inspector. Use textContent only for untrusted session text. Do not touch existing `/` app.
- [ ] **Step 4: Run `node --test test/preview.test.mjs` and `npm test`; expected PASS. Capture three headless screenshots and visually inspect each. Commit the slice.**
