# Adopt Grove on Main Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make A's vertical conversation grove the direct `/` session viewer without losing existing local Pi viewer capabilities.

**Architecture:** Serve the proven A comparison renderer and styles as the main page in a main-only mode; hide comparison tabs and wording on `/`, keep `/preview` for reference. Share file loading and overlay code; do not duplicate an independent A renderer.

**Tech Stack:** Node.js 22 HTTP, vanilla JS/CSS/SVG, node:test + headless Chrome.

**Spec:** `docs/superpowers/specs/2026-10-15-adopt-grove-main-design.md`

## Global Constraints

- Keep API behavior and original JSONL read-only.
- `/` shows only A, with direct session controls and a clearly marked example until a real session is loaded.
- Preserve none/ID/type labels, type colors, external annotations, one-entry inspector and click-only VS Code formatted copy.
- Do not activate a visible browser or editor while testing.

## Review Focus

- The A grove must have positive visible card bounds on `/`, not merely hidden DOM nodes (headless test).
- Switching to a real session should not silently keep synthetic overlays (headless test).
- A foreign/invalid file must retain the previous usable view (headless test).
- Refreshing a real session must recover it and its annotation layer while server runs (headless test).
- The editor route and API-key/session-ID discovery remain reachable without variant controls (headless test).

---

### Task 1: Direct A page with retained session actions

**Files:** Modify `src/server.mjs`, `web/preview.html`, `web/preview.css`, `web/preview.mjs`, `test/headless.test.mjs`, `test/web.test.mjs`; add `test/main-grove.test.mjs` if the existing headless test cannot cover demo and restored session cleanly.

**Interfaces:** `GET /` and `GET /index.html` share the same A-capable page served at `/preview`; `preview.mjs` checks `location.pathname` to enter single-view mode and retains the shared `GET|POST /api/sessions` and annotation polling code.

- [ ] **Step 1: Write a failing browser test** that loads `/` and expects A cards visibly in viewport, no A/B/C switcher, direct file selection, and accessible API-key/session-ID controls; upload a synthetic two-node session, assert cards, isolated record and annotation overlay, then reload and assert same session returns.
```js
assert.equal((await fetch(base+'/')).status,200);
assert.equal(await evaluate('document.querySelectorAll(".grove-node").length > 0'),true);
assert.equal(await evaluate('getComputedStyle(document.querySelector(".view-tabs")).display'), 'none');
```
- [ ] **Step 2: Run `node --test test/main-grove.test.mjs test/headless.test.mjs test/web.test.mjs`; expected fail because `/` still serves old horizontal tree.**
- [ ] **Step 3: Reuse the A renderer at `/`**, add main-view CSS/class and header copy, copy-token/session buttons, map current persisted session to A and preserve existing API/editor paths. Existing `/preview` still has three tabs; update old headless test to assert A visibility rather than old SVG selectors.
- [ ] **Step 4: Run focused browser tests and `npm test`; expected PASS with real positive geometry and no failures. Capture and inspect loaded `/` screenshot via headless Chrome. Commit the slice.**
