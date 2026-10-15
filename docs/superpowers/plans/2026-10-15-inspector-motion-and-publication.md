# Inspector Motion and Public Source Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ordinary and pinned record drawers one height, move the session-level editor action to the main viewer, add a reversible centered/dimmed inspector and restrained/reduced motion, then publish the audited source to a public `Vangalle/pi-track-view` repository on `main`.

**Architecture:** Reuse the shared `web/preview.html`, `web/preview.mjs` and `web/preview.css` for `/` and `/preview`, preserving a single inspector element. Centering is an in-browser presentation state only; session and annotation APIs remain unchanged. Publish only after test, source/history and account verification.

**Tech Stack:** Node.js built-in test runner, vanilla JS/CSS, headless Chrome via CDP, git, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-10-15-inspector-motion-and-publication-design.md`.

## Global Constraints

- Both ordinary and pinned inspector use the same `min(44vh,360px)` height at the same viewport size; centering never increases height.
- `previewEditor` invokes the existing authenticated action only for a real session, without changing source JSONL; no GUI editor invocation in tests.
- Pin, filter, original records, annotations, fullscreen, and `/preview` continue to work.
- Backdrop/Escape/Return restore bottom view without closing or unpinning; × and existing auto-close paths clear the centered backdrop.
- Prefer transform/opacity and one fixed-panel movement over animating thousands of nodes; respect `prefers-reduced-motion`.
- Background headless Chrome only, no activation, no test audio/microphone.
- Release requires verified `Vangalle` identity, clean audited snapshot and new public repo. Original local commits contain a personal QQ author email: preserve them on local private refs; push only a fresh single-root `main` snapshot with the public `Vangalle` noreply author/committer. No force/mirror/deletion.

## Review Focus

- Short viewport/mobile: same inspector heights, centered bounds inside the viewport, both JSON panes scroll within their allotted space (Task 2 headless test).
- Fullscreen/immersive mode: backdrop below inspector but above tree, Escape returns bottom before exiting immersive (Task 2 headless test).
- Filtering/collapsing away the focused record while centered: auto-close removes backdrop but keeps pin (Task 2 headless test).
- Rapid type-filter toggle: a pending exit animation never hides a freshly reopened menu (Task 3 headless test).
- Reduced-motion preference: center and filter effects become effectively instantaneous but all controls still work (Task 3 headless test).

---

### Task 1: Equal-height inspector and session-level editor action

**Files:** Modify `test/headless.test.mjs`, `web/preview.html`, `web/preview.css`, `web/preview.mjs`.

**Interfaces:** Existing `showRecord`, `useDemo`, `useReal`, `previewEditor` listener remain; Task 2 uses the inspector with a single fixed height and header containing `pinRecord` and `closeInspector`.

- [ ] **Step 1: Write browser assertions before changing production files.** In `test/headless.test.mjs`, after opening the demo record, assert `previewEditor.closest('.data-actions')` is non-null, `previewEditor.closest('.inspector')` is null and `.disabled === true`. Save `plainHeight = previewInspector.getBoundingClientRect().height` before pinning; replace the old `height>400` pinned assertion with `Math.abs(pinnedHeight-plainHeight)<1` and keep left/right JSON width assertions. After loading the real file, before clicking a record, assert `.disabled === false` and that the inspector is closed. The old height and button location must fail.
- [ ] **Step 2: Verify RED.** Run `node --test test/headless.test.mjs`; expect assertion failure for the old editor location or taller pin drawer, not a test harness error.
- [ ] **Step 3: Implement minimal layout and state.** Move the existing editor button from `.inspector-actions` to `.data-actions` in `web/preview.html`; do not duplicate it. Remove pinned-only height CSS (desktop and mobile), style the editor button in the main action row, and keep the existing click handler/API unchanged. `showRecord` no longer changes the editor state; `useDemo` disables it and `useReal` enables it:

```js
// In showRecord: remove $('previewEditor').disabled=!real.
// In useDemo, retain the existing assignment:
$('previewEditor').disabled=true;
// In useReal, add this assignment alongside the real-session state:
$('previewEditor').disabled=false;
```

```html
<div class="data-actions"><button type="button" id="previewEditor" disabled>Open formatted session in VS Code ↗</button><!-- existing file/session actions follow --></div>
```

The excerpt shows only the changed lines; preserve each existing function body and action row rather than replacing either wholesale.
- [ ] **Step 4: Verify GREEN.** Run `node --test test/headless.test.mjs` then `npm test`; both pass, original private-copy editor tests still pass, no GUI editor is launched.
- [ ] **Step 5: Commit.** `git add web/preview.html web/preview.css web/preview.mjs test/headless.test.mjs && git commit -m 'fix: unify inspector height and move session editor action'`.

### Task 2: Reversible centered record presentation

**Files:** Modify `test/headless.test.mjs`, `web/preview.html`, `web/preview.css`, `web/preview.mjs`.

**Interfaces:** Produce `setInspectorCentered(next,{restoreFocus=true}={})` and `hideInspector()` in `web/preview.mjs`; Task 3 CSS augments transitions for the same classes `.centered` on the inspector and `.active` on its backdrop. `showRecord` still opens the one inspector; hide paths call `hideInspector` rather than only removing `.open`.

- [ ] **Step 1: Write failing headless interaction checks.** In `test/headless.test.mjs`, while a real/synthetic record is open, assert `focusInspector` exists; click it with `clickAt`, wait for `previewInspector.centered` and assert after the transition `abs((rect.top+rect.bottom)/2-innerHeight/2)<3`, `rect.height===plainHeight`, backdrop visible and hit-testable outside the panel, pinned JSON IDs unchanged and `aria-pressed=true`. Click backdrop with CDP pointer and assert return to bottom, inspector remains open, pin remains pressed. Repeat with Escape (use immersive fallback, assert immersive remains), press × from centered and assert backdrop gone; reopen a card and assert it opens at bottom. While centered and focused record is filtered away, assert backdrop gone and pin remains. At a small emulated viewport, assert inspector fits and comparison content has constrained scroll panes; clear viewport emulation afterward. Verify synthetic keyboard Tab from last header button wraps to first focusable inspector button, and leaving center removes dialog/modal semantics.
- [ ] **Step 2: Verify RED.** `node --test test/headless.test.mjs` fails on missing `focusInspector`.
- [ ] **Step 3: Implement minimal presentation state.** Add `<div id="inspectorBackdrop" class="inspector-backdrop" aria-hidden="true"></div>` before the existing inspector and a `button#focusInspector` in `.inspector-actions` in `web/preview.html`. Add the following state transition, invoking `hideInspector()` from ×, session switches and auto-close in `applyTypes`/`toggleGap`; backdrop click and capture-phase Escape call `setInspectorCentered(false)`. Trap Tab within the header's visible buttons and the single-record `<summary>` when applicable, and restore focus to the header button only on a voluntary return, never on filter/session auto-close. Retain all existing data state and record population.

```js
function setInspectorCentered(next,{restoreFocus=true}={}){
  const panel=$('previewInspector'),active=next&&panel.classList.contains('open');
  panel.classList.toggle('centered',active);
  $('inspectorBackdrop').classList.toggle('active',active);
  $('focusInspector').setAttribute('aria-pressed',String(active));
  $('focusInspector').textContent=active?'Return to bottom':'Focus view';
  if(active){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');$('focusInspector').focus();}
  else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');if(restoreFocus&&panel.classList.contains('open'))$('focusInspector').focus();}
}
function hideInspector(){setInspectorCentered(false,{restoreFocus:false});$('previewInspector').classList.remove('open');$('previewInspector').setAttribute('aria-hidden','true');}
```

```css
.inspector{transition:bottom .3s cubic-bezier(.2,.8,.2,1),transform .3s cubic-bezier(.2,.8,.2,1)}
.inspector.centered{bottom:50%;transform:translateY(50%);z-index:60}
.inspector-backdrop{position:fixed;inset:0;z-index:50;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .24s ease,visibility .24s ease;background:#071013a8}
.inspector-backdrop.active{opacity:1;visibility:visible;pointer-events:auto}
```

Test click and Escape against this contract; do not animate height or move tree nodes.
- [ ] **Step 4: Verify GREEN.** Run `node --test test/headless.test.mjs` and `npm test`; take and inspect a settled centered screenshot through headless CDP only.
- [ ] **Step 5: Commit.** `git add web/preview.html web/preview.css web/preview.mjs test/headless.test.mjs && git commit -m 'feat: center record inspector over dimmed tree'`.

### Task 3: Polish local motion and reduced-motion handling

**Files:** Modify `test/headless.test.mjs`, `web/preview.css`, `web/preview.mjs`.

**Interfaces:** Reuse `typeFilterPanel`/`typeFilterButton`, `closeTypeFilter`, and Task 2 presentation classes; no API or data-view changes.

- [ ] **Step 1: Write failing browser assertions.** In `test/headless.test.mjs`, emulate `prefers-reduced-motion: reduce` through `Emulation.setEmulatedMedia`, open the inspector and centered view, assert computed transition duration for the inspector/backdrop is near zero; toggle the type filter closed/open rapidly and assert the panel remains visible, interactable, and `aria-expanded=true` after an animation interval; reset to no-preference and assert the inspector has a nonzero finite transition, backdrop fades and menu can fully close then reopen by mouse/keyboard. Keep existing label/filter/count assertions.
- [ ] **Step 2: Verify RED.** `node --test test/headless.test.mjs` fails at reduced-motion computed style (existing CSS always animates) or filter opening behavior.
- [ ] **Step 3: Implement minimal polish.** Add reduced-motion override and 150–300 ms ease-out hover/focus transitions for existing controls; do not animate tree geometry on render. Add a cancelable entrance/exit animation to the existing type filter; aria-expanded records intended-open state even while the closing panel is still in the DOM. A second click cancels the first animation so it cannot hide a freshly reopened menu:

```js
let filterAnimation;
function setTypeFilterOpen(open){
  const panel=$('typeFilterPanel'),button=$('typeFilterButton');
  if(!open&&button.getAttribute('aria-expanded')==='false')return;
  filterAnimation?.cancel();filterAnimation=null;
  button.setAttribute('aria-expanded',String(open));
  if(open)panel.hidden=false;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){panel.hidden=!open;return;}
  filterAnimation=panel.animate(open
    ? [{opacity:0,transform:'translateY(-7px)'},{opacity:1,transform:'translateY(0)'}]
    : [{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-7px)'}],
    {duration:open?190:150,easing:'ease-out',fill:'forwards'});
  if(!open)filterAnimation.finished.then(()=>{if(button.getAttribute('aria-expanded')==='false')panel.hidden=true;}).catch(()=>{});
}
```

```css
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
```

Wire `closeTypeFilter` and the existing button click to `setTypeFilterOpen`; use the existing pointerdown/Escape handlers unchanged except where Task 2's centered Escape must take priority.
- [ ] **Step 4: Verify GREEN.** Run `node --test test/headless.test.mjs test/preview.test.mjs`, `npm test`, `node --check web/preview.mjs`, `git diff --check`; inspect settled screenshots in reduced and normal modes.
- [ ] **Step 5: Commit.** `git add web/preview.css web/preview.mjs test/headless.test.mjs && git commit -m 'style: refine viewer motion and reduced-motion behavior'`.

## Release: Audited public source repo (after final review)

- [ ] Run `npm test`, `git diff --check`, check branch/worktree clean and capture current `main` and feature SHA. Audit `git ls-files`, `git log --all --name-status`, `git log --all -p` for session payloads, active credentials/tokens or private files. Artificial test tokens are fixtures, not credentials; if uncertain, stop rather than publishing. Confirm `gh auth status` has active `Vangalle`, and `gh repo view Vangalle/pi-track-view` still reports no existing repo.
- [ ] Ensure `main` is an ancestor of verified `feat/ui-previews` and the only worktree is clean. Record `git rev-parse feat/ui-previews` and `git rev-parse main`. Keep original `main` and `feat/ui-previews` refs untouched through publication. Create orphan `public-main` with `git switch --orphan public-main`; restore **only** the verified feature snapshot using `git restore --source=feat/ui-previews --staged --worktree .`, then commit with `git -c user.name=Caleb -c user.email=65287607+Vangalle@users.noreply.github.com -c commit.gpgsign=false commit -m 'Initial public release of pi-track-view'`. Verify `git rev-list --count HEAD` returns `1`, `git diff --exit-code feat/ui-previews HEAD -- .` shows identical tracked files, both author and committer use noreply, and `npm test` passes on the sanitized snapshot.
- [ ] Create **only** the approved new public repository (`gh repo create Vangalle/pi-track-view --public --source=. --remote=origin`), inspect `git remote -v` and `gh repo view` before `git push -u origin public-main:main`. After remote verification, rename the original local `main` to `private/main-before-publication`, rename the checked-out `public-main` to `main`, set `main` upstream to `origin/main`, and configure this repository's future commits to use the public noreply identity; the original `feat/ui-previews` remains local and is never pushed. No force push, mirror push, remote deletion, or GitHub Pages configuration.
- [ ] Verify `gh repo view Vangalle/pi-track-view --json nameWithOwner,isPrivate,url,defaultBranchRef` gives `isPrivate=false` and default `main`, `git ls-remote origin refs/heads/main` matches the sanitized local main SHA, `gh api repos/Vangalle/pi-track-view/commits --jq '.[0].commit.author.email'` reports the noreply address, and no real session data is tracked. Report verified URL and branch, plus any remaining limitations directly in chat.
