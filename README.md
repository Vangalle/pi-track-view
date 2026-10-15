# pi-track-view

A local, read-only viewer for Pi JSONL sessions. Open a session with the browser file chooser, inspect the full `id`/`parentId` tree, select an entry to view only that record, and overlay node/edge labels and highlights from other local programs. Independent label modes: none, ID, type. Node color always follows entry type.

## Run

Requires Node.js 22+. No install or network access is needed.

```sh
npm start
```

Open the printed `http://127.0.0.1:<port>` address yourself. The server does **not** open a window, browse session directories, modify the selected JSONL, or contact a provider. Browser refresh restores the active session and overlays while the server runs; restarting the server clears both. The browser's file selector is the only way to load a file. The VS Code button runs `code --reuse-window` **only when clicked**, on a private temporary pretty-printed `.json` copy (JSONL itself cannot be pretty-printed across lines while staying valid JSONL). Install VS Code's `code` CLI or set `PI_TRACK_VIEW_CODE=/path/to/code`. Temp copies are removed on graceful server shutdown.

## External annotations

Use **Copy API key** and **Copy session ID** in the viewer. API access is loopback-only; requests require `Authorization: Bearer <key>`. Each source owns a replaceable overlay and may coexist with other sources:

```sh
curl -X PUT 'http://127.0.0.1:<port>/api/sessions/<session-id>/annotations/my-app' \
  -H 'Authorization: Bearer <key>' -H 'Content-Type: application/json' \
  --data '{"nodes":[{"id":"<entry-id>","label":"Review","highlight":true}],"edges":[{"from":"<parent-entry-id>","to":"<child-entry-id>","label":"Follow","highlight":true}]}'
```

`PUT` replaces only `my-app`'s overlay; `DELETE` on the same URL removes it. `GET /api/sessions/<session-id>/annotations` lists current overlays. Edges must refer to actual parent→child relationships. The view polls every ~1.4 seconds. The header is metadata, not a tree node. Unknown entry types remain visible. All annotations are in process memory, never written to any Pi session.

Run tests with `npm test`. Never share private session data or the local API key with untrusted processes.
