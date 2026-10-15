# Filter context and taller tree — design reference

## Outcome

When type filtering is active, matching entries remain colored, and each match additionally shows its existing direct parent and every existing direct child as a semi-transparent gray context card unless that entry also matches (matched/color wins). Do not recursively expand context. All other nonmatching entries remain hidden. Root/leaf boundaries do not invent neighbors. This applies to the shared graph renderer (main A, optional preview B/C) without changing session JSONL or the authenticated annotation API. Increase the main A tree viewport to at least `max(650px, 75dvh)` on desktop, with a smaller mobile floor; let the page scroll when the viewport is short.

## Mechanism and visual semantics

`filterGraph(fullGraph,selectedTypes)` creates an in-memory view. With `null`, return the original unfiltered graph. Otherwise first mark all type-matching nodes, then add exactly their direct parent and direct children as context unless already matched. Clone visible nodes with a `context` boolean; never change entries in the original graph. Link each visible child to its nearest visible ancestor; when intermediate records are skipped, mark the edge `skipped` and draw it dashed. A context card uses neutral gray and reduced opacity, while a matching card retains its type color and intrinsic label mode. A context card remains clickable for reading one raw record, without adding that type to the filter. External node badges/highlights and external edge decorations are rendered only on matched nodes and genuine edges between matches; context nodes and derived skip edges stay visually neutral. The external overlay data remains intact and reappears on All.

The filter's count must distinguish matches and gray context; opening another session resets filter selection to All. If zero types are selected, show an explicit empty state. Existing main-view controls and source file privacy remain unchanged.

## Verification

Pure tests cover one-hop-only ancestry/children, matched-over-context precedence, branches, multiple roots, deduplication, skip edges and source graph immutability. Headless browser tests verify gray parent/children above and below a colored match, absence of second-hop neighbors, type-mode/color and annotation boundaries, All restore, and main A viewport height. No GUI activation and no private real session fixtures.
