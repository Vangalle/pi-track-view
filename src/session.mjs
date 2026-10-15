export function parseSession(text) {
  if (typeof text !== 'string') throw new Error('session must be text');
  const lines = text.split(/\r?\n/);
  let header;
  const entries = [];
  const nodes = new Map();
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { throw new Error(`invalid JSON at line ${i + 1}`); }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`invalid entry at line ${i + 1}`);
    if (!header) {
      if (entry.type !== 'session' || typeof entry.id !== 'string') throw new Error('missing session header');
      header = entry;
      continue;
    }
    if (entry.type === 'session') throw new Error('duplicate session header');
    if (typeof entry.id !== 'string' || !entry.id) throw new Error(`missing entry id at line ${i + 1}`);
    if (nodes.has(entry.id)) throw new Error(`duplicate entry id: ${entry.id}`);
    if (entry.parentId !== null && typeof entry.parentId !== 'string') throw new Error(`invalid parentId at line ${i + 1}`);
    if (typeof entry.type !== 'string' || !entry.type) throw new Error(`invalid type at line ${i + 1}`);
    entries.push(entry);
    nodes.set(entry.id, { id:entry.id, parentId:entry.parentId, type:entry.type, entry, children:[] });
  }
  if (!header) throw new Error('missing session header');
  const roots = [], warnings = [];
  for (const entry of entries) {
    if (entry.parentId === null) roots.push(entry.id);
    else if (!nodes.has(entry.parentId)) {
      roots.push(entry.id);
      warnings.push(`entry ${entry.id}: missing parent ${entry.parentId}`);
    } else nodes.get(entry.parentId).children.push(entry.id);
  }
  const states = new Map();
  for (const id of nodes.keys()) {
    if (states.get(id) === 2) continue;
    const path = [];
    let current = id;
    while (current !== null && nodes.has(current) && states.get(current) !== 2) {
      if (states.get(current) === 1) throw new Error(`cycle at entry ${current}`);
      states.set(current, 1);
      path.push(current);
      current = nodes.get(current).parentId;
    }
    for (const visited of path) states.set(visited, 2);
  }
  return {header,entries,nodes,roots,warnings};
}
