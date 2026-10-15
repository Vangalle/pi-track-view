# pi-track-view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser viewer for Pi JSONL trees with isolated record details and volatile local HTTP annotation overlays.

**Architecture:** Node built-in HTTP server owns in-memory parsed sessions and source-scoped annotations. Static browser app draws SVG tree, polls overlays, and uploads selected files. Editor operation writes only a pretty temporary JSON copy.

**Tech Stack:** Node.js 22+, built-in `node:test`, vanilla JS/CSS/SVG, no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-pi-track-view-design.md`

## Global Constraints

- Never change source JSONL; never read private historical sample sessions in tests.
- Bind 127.0.0.1; require bearer token on every API route, same-origin for browser mutations, reject foreign Host; no CORS.
- All runtime sessions, overlays and auth are memory-only. Pretty copy is private and temporary.
- Three intrinsic modes: none, ID, type; node colors determined by entry type independently. Detail is one entry only.

## Review Focus

- Multi-root and orphan nodes: show all entries, warn about missing parent; never silently drop one.
- Unknown or malformed message content: raw JSON fallback without script execution.
- Malformed or oversized uploads: reject atomically and retain existing session.
- Multiple annotation sources: replacement/removal never erases other sources.
- Stale browser session after process restart: request file selection, not stale overlays.

---

### Task 1: Session parser and tree presentation helpers

**Files:** Create `src/session.mjs`, `web/tree.mjs`, `test/session.test.mjs`, `test/tree.test.mjs`.

**Interfaces:** `parseSession(text): {header,entries,nodes,roots,warnings}` where `nodes` includes `{entry,id,parentId,type,children}`; `layoutTree(nodes,roots): {positions,width,height,edges}`; `nodeCaption(node,mode):string`; `nodeColor(type):string`; `recordView(entry):{title,blocks,raw}`.

- [ ] **Step 1: Write failing tests** for tree branching, multiple roots, orphan warnings, duplicate/cyclic IDs, modes and colors, safe single-record view:
```js
assert.deepEqual(parseSession(lines).roots, ['a','other']);
assert.equal(nodeCaption({id:'a',type:'message'}, 'type'), 'message');
assert.equal(recordView({type:'message',id:'a',message:{role:'user',content:'<script>'}}).blocks[0].text, '<script>');
```
- [ ] **Step 2: Run `node --test test/session.test.mjs test/tree.test.mjs`; expected missing module/exports failure.**
- [ ] **Step 3: Implement parser and pure presentation helpers**, with cycle/duplicate/header checks, preserved record order, deterministic layout, color hash or fixed palette, text-only block descriptions.
- [ ] **Step 4: Run the same tests; expected pass. Commit the slice.**

### Task 2: Memory store and authenticated HTTP API

**Files:** Create `src/store.mjs`, `src/server.mjs`, `test/server.test.mjs`, `package.json`.

**Interfaces:** `createStore()` with `add(text)`, `get(id)`, `setAnnotations(id,source,payload)`, `removeAnnotations(id,source)`, `annotations(id)`; `createServer({store,token,openEditor?})` returns `http.Server`.

- [ ] **Step 1: Write integration tests** using a real loopback server and `fetch` for upload/read/refresh, unknown targets, edge adjacency, source isolation, malformed JSON, bad token, foreign Origin and Host, and new store restart.
```js
assert.equal((await fetch(url+'/api/sessions', {method:'POST',headers:{authorization:'Bearer '+token},body:jsonl})).status, 201);
assert.equal((await fetch(url+'/api/sessions', {headers:{authorization:'Bearer wrong'}})).status, 401);
```
- [ ] **Step 2: Run `node --test test/server.test.mjs`; expected missing module failure.**
- [ ] **Step 3: Implement memory store and routes** `POST /api/sessions`, `GET /api/sessions/:id`, `GET /api/sessions/:id/annotations`, `PUT|DELETE /api/sessions/:id/annotations/:source`; enforce payload size, validation, host/origin/token, JSON errors and same-origin static files.
- [ ] **Step 4: Run server tests and full `node --test`; expected pass. Commit the slice.**

### Task 3: Browser viewer and external overlay

**Files:** Create `web/index.html`, `web/style.css`, `web/app.mjs`, `test/web.test.mjs`; modify `src/server.mjs` for static files as needed.

**Interfaces:** Browser calls established HTTP routes, exports `renderTree(svg,session,overlay,mode,select)` and `renderRecord(panel,entry)` for DOM/integration tests where feasible; pure layout/record behavior remains in `web/tree.mjs`.

- [ ] **Step 1: Write failing tests** for observed HTTP page/asset behavior and UI helpers: node caption mode, overlay separation, safe content and selected record isolation; test static paths cannot escape web root.
```js
assert.equal((await fetch(url+'/')).status,200);
assert.equal((await fetch(url+'/../src/store.mjs')).status,404);
```
- [ ] **Step 2: Run `node --test test/web.test.mjs`; expected missing assets or route failure.**
- [ ] **Step 3: Implement HTML/CSS/JS** file chooser, session recovery, three modes, pan/zoom SVG layout, legends, annotations polling, overlay labels and highlighting, single-record drawer, API key copy, errors and empty states. Serve only named static assets.
- [ ] **Step 4: Run web tests and full `node --test`; expected pass. Commit the slice.**

### Task 4: Pretty-copy VS Code action, executable entry, removal

**Files:** Create `src/editor.mjs`, `src/main.mjs`, `test/editor.test.mjs`, `README.md`; modify `src/server.mjs`, `web/app.mjs`, `package.json`.

**Interfaces:** `openPrettySession(entries,{command?,tempRoot?}):Promise<{file}>`, `POST /api/sessions/:id/open-editor` invokes it only for stored session.

- [ ] **Step 1: Write failing tests** with temporary synthetic source JSONL and a fake executable that captures the argument, verifying formatted `.json` copy, original bytes unchanged and clear missing-cli response.
```js
assert.deepEqual(JSON.parse(await readFile(copy,'utf8')), records);
assert.equal(await readFile(original,'utf8'), initialBytes);
```
- [ ] **Step 2: Run `node --test test/editor.test.mjs`; expected missing module/route failure.**
- [ ] **Step 3: Implement editor copy and button**, CLI entry (`npm start` prints URL), safe startup/shutdown cleanup, concise usage/API documentation. Delete the entire sibling `pi-trajectory` folder only after full verification; user explicitly confirmed ignored data deletion.
- [ ] **Step 4: Run `node --test`, `npm start` + loopback smoke request, `git status` and verify old directory absent; expected pass. Initialize a fresh git repository for pi-track-view and commit the new app.**
