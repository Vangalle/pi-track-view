import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.mjs';
import { overlayFor } from '../web/tree.mjs';
test('local page and named assets load but server source stays inaccessible',async t=>{
  const server=createServer({token:'local-secret'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(base+'/');
  assert.equal(page.status,200);
  const html=await page.text();
  assert.match(html,/Open your \.jsonl/);
  assert.match(html,/Copy session ID/);
  assert.equal((await fetch(base+'/preview.mjs')).status,200);
  assert.equal((await fetch(base+'/tree.mjs')).status,200);
  assert.equal((await fetch(base+'/preview.css')).status,200);
  assert.equal((await fetch(base+'/app.mjs')).status,404);
  assert.equal((await fetch(base+'/style.css')).status,404);
  assert.equal((await fetch(base+'/src/store.mjs')).status,404);
  assert.equal((await fetch(base+'/%2f..%2fsrc%2fstore.mjs')).status,404);
});
test('external labels and highlights are separate from intrinsic mode',()=>{
  const overlay={nodes:[{id:'a',label:'review',highlight:true,source:'alpha'},{id:'a',label:'urgent',source:'beta'}],edges:[{from:'a',to:'b',label:'follow',highlight:true,source:'alpha'}]};
  assert.deepEqual(overlayFor(overlay,'a'),{labels:['review','urgent'],highlight:true});
  assert.deepEqual(overlayFor(overlay,'a','b'),{labels:['follow'],highlight:true});
  assert.deepEqual(overlayFor(overlay,'b'),{labels:[],highlight:false});
});
