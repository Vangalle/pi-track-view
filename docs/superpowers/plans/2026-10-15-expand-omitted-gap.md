# Expand Omitted Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click `…` on one filtered skip edge to reveal exactly its hidden ancestor path, and click collapse to restore it.

**Architecture:** The pure type projection accepts a Set of validated per-gap keys and produces restored gray nodes plus one collapse-key edge per expanded gap. The shared browser renderer turns only skipped/collapse edges into accessible SVG controls; session/annotation state remains untouched.

**Tech Stack:** Node.js 22 built-ins, vanilla JS/SVG, headless Chrome test.

**Spec:** `docs/superpowers/specs/2026-10-15-expand-omitted-gap-design.md`

## Global Constraints

- Only the unique parentId path between a skipped edge's two endpoints may expand; no sibling expansion.
- Expanded entries stay gray/nonmatching, and external annotations remain stored but absent from context-only visuals.
- Collapse the same gap; filter or session change clears expansion keys; All restores original tree.
- Original JSONL and HTTP API stay read-only/unchanged; no GUI validation may activate a window.

## Review Focus

- A key for an actual direct edge must not fabricate an expansion (Task 1 test).
- A stale or malformed key must be ignored without throwing or leaking nodes (Task 1 test).
- Two expanded gaps do not affect each other when collapsing one (Task 1 test).
- A restored node with side children keeps those siblings hidden (Task 1/browser tests).
- Selected inspector for a collapsed-away node must close or move to a surviving endpoint (Task 2 browser test).

---

### Task 1: Scoped projection and stable collapse identity

**Files:** Modify `web/preview-layouts.mjs`, `test/preview-layouts.test.mjs`.

**Interfaces:** Export `gapKey(from,to): string` using JSON-encoded ID tuple. `filterGraph(graph,types,expandedGaps=new Set())` returns `{nodes,roots,collapseLinks?}`; layout edges gain optional `collapseKey` on the first restored edge. Existing two-argument calls behave exactly as before.

- [ ] **Step 1: Write a failing test** using `a(message) → b(usage) → x(usage) → y(usage) → z(usage) → c(message)` plus an `x → side` sibling. With `types=Set(['message'])` and `expandedGaps=Set([gapKey('b','z')])`, require `x,y` shown in order and gray; `side` absent, no skipped edge in that gap, one edge with `collapseKey`; clearing the Set restores the original skipped `b→z`. Also test malformed/direct keys and two independent gaps.
```js
const key=gapKey('b','z');
const shown=filterGraph(graph,new Set(['message']),new Set([key]));
assert.deepEqual([...shown.nodes.keys()],['a','b','x','y','z','c']);
assert.equal(groveLayout(shown).edges.filter(edge=>edge.collapseKey===key).length,1);
```
- [ ] **Step 2: Run `node --test test/preview-layouts.test.mjs`; expected missing export/behavior failure.**
- [ ] **Step 3: Implement base-projection validation plus exact ancestor-path inclusion**, with a `collapseLinks` mapping from the first restored edge to the original key; no mutation of graph entries.
- [ ] **Step 4: Run targeted tests and full `npm test`; expected PASS. Commit the slice.**

### Task 2: Interactive indicator, collapse and lifecycle

**Files:** Modify `web/preview.mjs`, `web/preview.css`, `test/headless.test.mjs`, `test/preview.test.mjs` if needed.

**Interfaces:** Existing `skipIndicator` becomes a keyboard-focusable SVG control with `data-gap-key`, expand/collapse name, and click/Enter/Space handler. `expandedGaps` is browser-local state; `applyTypes`, `useDemo`, `useReal` clear it. `render` uses `filterGraph(graph,selectedTypes,expandedGaps)`.

- [ ] **Step 1: Write a failing headless test**: with demo filtered to usage+compaction, click the visible `…` and assert omitted trunk nodes appear as gray cards, no unrelated sibling appears, and a collapse indicator replaces `…`. Click collapse to restore one `…`; repeat with keyboard, and verify changing filter clears expansion. Check selected raw panel closes when its expanded-only node disappears.
```js
assert.equal(await evaluate('document.querySelectorAll(".skip-indicator").length'),1);
await evaluate('document.querySelector(".skip-indicator").dispatchEvent(new MouseEvent("click",{bubbles:true}))');
assert.equal(await evaluate('document.querySelectorAll(".collapse-indicator").length'),1);
```
- [ ] **Step 2: Run `node --test test/headless.test.mjs`; expected indicator click changes nothing.**
- [ ] **Step 3: Implement marker mode/toggle, state reset, and neutral collapse styling**, preserving scrolled view and external overlay boundaries.
- [ ] **Step 4: Run focused browser tests and full `npm test`; expected PASS. Inspect a background screenshot of the expanded segment, then commit the slice.**
