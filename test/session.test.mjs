import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSession } from '../src/session.mjs';
const jsonl = (...rows) => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
const header = { type: 'session', version: 3, id: 's', cwd: '/fake' };
test('preserves branching, order, unknown kinds, multiple roots and orphans', () => {
  const parsed = parseSession(jsonl(header, {type:'message',id:'a',parentId:null}, {type:'usage',id:'x',parentId:'a'}, {type:'other',id:'y',parentId:'a'}, {type:'custom',id:'other',parentId:null}, {type:'label',id:'orphan',parentId:'absent'}));
  assert.deepEqual(parsed.roots, ['a','other','orphan']);
  assert.deepEqual(parsed.nodes.get('a').children, ['x','y']);
  assert.equal(parsed.nodes.get('y').type, 'other');
  assert.match(parsed.warnings[0], /orphan.*absent/);
  assert.equal(parsed.entries.length, 5);
});
test('accepts a deep valid session without exhausting the call stack', () => {
  const rows=[header];
  for(let i=0;i<12000;i++)rows.push({type:'message',id:`n${i}`,parentId:i===0?null:`n${i-1}`});
  assert.equal(parseSession(jsonl(...rows)).nodes.size,12000);
});
test('rejects malformed input, duplicate IDs and cycles', () => {
  assert.throws(() => parseSession('not json\n'), /line 1/);
  assert.throws(() => parseSession(jsonl({type:'message',id:'a',parentId:null})), /header/);
  assert.throws(() => parseSession(jsonl(header,{type:'message',id:'a',parentId:null},{type:'usage',id:'a',parentId:null})), /duplicate/);
  assert.throws(() => parseSession(jsonl(header,{type:'message',id:'a',parentId:'b'},{type:'message',id:'b',parentId:'a'})), /cycle/);
  assert.throws(() => parseSession(jsonl(header,{type:'message',id:'a',parentId:23})), /parentId/);
});
