import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeCaption, nodeColor, recordView } from '../web/tree.mjs';
test('caption modes do not change stable type color', () => {
  const node = {id:'abc',type:'message'};
  assert.equal(nodeCaption(node,'none'),'');
  assert.equal(nodeCaption(node,'id'),'abc');
  assert.equal(nodeCaption(node,'type'),'message');
  assert.equal(nodeColor('message'),nodeColor('message'));
  assert.notEqual(nodeColor('message'),nodeColor('usage'));
});
test('single record view keeps raw data and treats hostile content as plain text', () => {
  const entry={type:'message',id:'a',message:{role:'user',content:'<script>alert(1)</script>'}};
  const view=recordView(entry);
  assert.equal(view.blocks[0].text,'<script>alert(1)</script>');
  assert.match(view.title,/user/);
  assert.equal(JSON.parse(view.raw).id,'a');
  assert.equal(recordView({type:'usage',id:'b',kind:'cache'}).blocks.length,0);
});
