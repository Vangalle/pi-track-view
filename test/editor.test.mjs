import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,chmod,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openPrettySession } from '../src/editor.mjs';
import { createServer } from '../src/server.mjs';
const records=[{type:'session',id:'s',version:3},{type:'message',id:'a',parentId:null,message:{role:'user',content:'private <text>'}}];
test('explicit editor action opens indented private copy, source bytes unchanged',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'track-test-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source.jsonl'),original=records.map(JSON.stringify).join('\n')+'\n';
  await writeFile(source,original);
  const code=path.join(dir,'fake-code');
  await writeFile(code,`#!/bin/sh\nprintf '%s' "$2" > '${path.join(dir,'called')}'\n`);await chmod(code,0o700);
  const {file}=await openPrettySession(records,{command:code,tempRoot:dir});
  assert.equal(path.extname(file),'.json');
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),records);
  assert.match(await readFile(file,'utf8'),/\n  \{/);
  assert.equal(await readFile(path.join(dir,'called'),'utf8'),file);
  assert.equal(await readFile(source,'utf8'),original);
});
test('missing editor command has a clear error and leaves no formatted copy',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'track-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await assert.rejects(()=>openPrettySession(records,{command:path.join(dir,'nonexistent'),tempRoot:dir}),/VS Code|code CLI/);
});
test('authenticated editor route only accepts uploaded session',async t=>{
  const called=[];
  const server=createServer({token:'secret',openEditor:async entries=>{called.push(entries);return {file:'/temporary/formatted.json'};}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={authorization:'Bearer secret'};
  const jsonl=records.map(JSON.stringify).join('\n')+'\n';
  const {id}=await (await fetch(base+'/api/sessions',{method:'POST',headers,body:jsonl})).json();
  assert.equal((await fetch(base+`/api/sessions/${id}/open-editor`,{method:'POST',headers:{authorization:'Bearer wrong'}})).status,401);
  assert.equal((await fetch(base+'/api/sessions/00000000-0000-0000-0000-000000000000/open-editor',{method:'POST',headers})).status,404);
  assert.equal((await fetch(base+`/api/sessions/${id}/open-editor`,{method:'POST',headers})).status,200);
  assert.deepEqual(called[0],records);
});
