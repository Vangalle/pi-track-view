# Filter Context and Taller Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show exactly one parent/child ring as neutral gray context around type-filter matches and give the main tree more vertical space.

**Architecture:** Extend the existing pure `filterGraph` projection with one-hop context markers; keep the full graph and session entries untouched. Existing shared renderers consume that projected graph and style context nodes/edges neutrally; main CSS increases the canvas floor.

**Tech Stack:** Node.js 22, vanilla browser JS/CSS/SVG, node:test and headless Chrome.

**Spec:** `docs/superpowers/specs/2026-10-15-filter-context-height-design.md`

## Global Constraints

- Type matches stay colored; only direct parent and direct children may become gray context; matched wins on overlap.
- Unmatched second-hop records remain hidden; roots/leaves never fabricate neighbors.
- Original JSONL and external annotation storage/API remain untouched; derived edges and context cards do not inherit external decorations.
- Main A tree desktop height is at least `max(650px,75dvh)`, short windows may scroll; no foreground GUI validation.

## Review Focus

- A matching root/leaf without a parent/child must show no invented gray card (Task 1).
- Sibling fan-out: all direct children remain reachable; their children do not leak in (Task 1).
- Two matching nodes share a neighbor: it appears once and matched color takes precedence (Task 1).
- A real annotation on a context-only node or edge stays stored but does not visually override gray (Task 2).
- Window height below 650px: main page may scroll, tree canvas still has nonzero 650px desktop height (Task 2).

---

### Task 1: One-hop context projection

**Files:** Modify `web/preview-layouts.mjs`, `test/preview-layouts.test.mjs`.

**Interfaces:** Existing `filterGraph(graph,types)` returns `{nodes:Map,roots}` with per-node `context:boolean` and projected `parentId`, `children`, `skippedParent`; existing `groveLayout(graph)` emits edges `{from,to,skipped}`. `types=null` returns the original graph.

- [ ] **Step 1: Write failing tests** on a literal chain and fan-out where only `c` matches. Require the visible set `{b,c,d,e}`, with `b,d,e` contextual, `a,f` absent; require deduplicated context and a matching child to remain colored:
```js
const shown=filterGraph(toGraph({entries:[
 {id:'a',type:'usage',parentId:null},{id:'b',type:'usage',parentId:'a'},
 {id:'c',type:'message',parentId:'b'},{id:'d',type:'usage',parentId:'c'},
 {id:'e',type:'usage',parentId:'c'},{id:'f',type:'usage',parentId:'d'}
]}),new Set(['message']));
assert.deepEqual([...shown.nodes.keys()],['b','c','d','e']);
assert.equal(shown.nodes.get('b').context,true);
```
- [ ] **Step 2: Run `node --test test/preview-layouts.test.mjs`; expected FAIL because context nodes are absent.**
- [ ] **Step 3: Implement two-pass matched+one-hop context selection**, then reuse nearest-visible-ancestor linking; set `context` on clones only. Preserve original order and genuine-edge metadata.
- [ ] **Step 4: Run targeted tests and `npm test`; expected PASS. Commit the slice.**

### Task 2: Neutral context UI and taller viewport

**Files:** Modify `web/preview.mjs`, `web/preview.css`, `test/headless.test.mjs`, `test/preview.test.mjs` only if shared preview behavior requires it.

**Interfaces:** Existing renderer gets projected nodes and edges; `.grove-node.context`/`.metro-node.context`/`.atlas-node.context` gray cards; `.grove-link.context` and equivalents neutral edges; `#nodeCount` reports matches and context separately. Main A CSS `min-height:max(650px,75dvh)` with mobile override.

- [ ] **Step 1: Write failing headless assertions** after filtering demo to `usage`: expect three visible nodes (matching trunk-18, context trunk-17/trunk-19), a gray context class on direct parent and child but not on the match, no second-hop trunk-16/trunk-20, no external badges on gray cards, and main canvas height >=650px. All restores every node without gray classes.
```js
assert.equal(await evaluate('document.querySelectorAll(".grove-node").length'),3);
assert.equal(await evaluate('document.querySelector(".grove-node[data-id=trunk-17]").classList.contains("context")'),true);
assert.equal(await evaluate('document.getElementById("previewCanvas").getBoundingClientRect().height>=650'),true);
```
- [ ] **Step 2: Run `node --test test/headless.test.mjs`; expected FAIL on old matched-only display/height.**
- [ ] **Step 3: Style context cards/edges neutrally**, suppress overlays on contextual elements, distinguish matching/context counts, and increase main tree height. Leave standalone preview layout switching intact.
- [ ] **Step 4: Run `node --test test/headless.test.mjs` and `npm test`; expected PASS. Take background screenshot of filtered main tree, inspect it, commit the slice.**
