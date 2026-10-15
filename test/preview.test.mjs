import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { mkdtemp,readFile,writeFile,rm,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.mjs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const wait=async fn=>{for(let i=0;i<120;i++){try{const result=await fn();if(result)return result;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('timed out waiting for preview');};

test('main and comparison paths share safe named assets',async t=>{
  const server=createServer({token:'preview-test'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const main=await fetch(base+'/');assert.equal(main.status,200);assert.match(await main.text(),/id="introTitle"/);
  const comparison=await fetch(base+'/preview');assert.equal(comparison.status,200);assert.match(await comparison.text(),/data-view="metro"/);
  for(const asset of ['/preview.css','/preview.mjs','/preview-data.mjs','/preview-layouts.mjs'])assert.equal((await fetch(base+asset)).status,200,asset);
  assert.equal((await fetch(base+'/preview/../src/store.mjs')).status,404);
});

test('three previews show actual geometry and preserve node selection, labels and annotations', {skip:!existsSync(chrome)}, async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'preview-headless-'));
  const server=createServer({token:'preview-test'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--remote-debugging-port=0','--window-size=1440,900',`--user-data-dir=${dir}/chrome`,'about:blank'],{stdio:'ignore'});
  let ws;
  t.after(async()=>{
    if(browser.exitCode===null){ws?.send(JSON.stringify({id:999999,method:'Browser.close'}));await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);if(browser.exitCode===null)browser.kill();}
    ws?.close();await new Promise(resolve=>server.close(resolve));
    for(let i=0;i<10;i++){try{await rm(dir,{recursive:true,force:true});break;}catch(error){if(!['ENOTEMPTY','EBUSY'].includes(error.code)||i===9)throw error;await new Promise(resolve=>setTimeout(resolve,100));}}
  });
  const debugPort=await wait(async()=>Number((await readFile(path.join(dir,'chrome','DevToolsActivePort'),'utf8')).split('\n')[0]));
  const pages=await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let next=1;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(Error(message.error.message)):resolve(message.result);}};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const outcome=await command('Runtime.evaluate',{expression,returnByValue:true});if(outcome.exceptionDetails)throw Error(outcome.exceptionDetails.exception?.description??outcome.exceptionDetails.text);return outcome.result.value;};
  await command('Page.enable');await command('DOM.enable');await command('Runtime.enable');
  await command('Page.navigate',{url:`http://127.0.0.1:${port}/preview`});
  await wait(()=>evaluate('document.readyState === "complete" && document.querySelectorAll(".preview-node").length > 25'));
  for(const view of ['grove','metro','atlas']){
    await evaluate(`document.querySelector('[data-view="${view}"]').click()`);
    const metrics=await evaluate('(()=>{const nodes=[...document.querySelectorAll(".preview-node")],canvas=document.getElementById("previewCanvas").getBoundingClientRect();return {count:nodes.length,canvasWidth:canvas.width,canvasHeight:canvas.height,visible:nodes.some(el=>{const r=el.getBoundingClientRect();return r.width>5&&r.height>5&&r.x>=canvas.x&&r.x<canvas.right&&r.y>=canvas.y&&r.y<canvas.bottom})}})()');
    assert.ok(metrics.count>25 && metrics.canvasWidth>400 && metrics.canvasHeight>300 && metrics.visible,`${view} geometry ${JSON.stringify(metrics)}`);
    if(view==='metro')assert.equal(await evaluate('document.querySelector(".metro-node[data-id=trunk-1] .node-caption").getBoundingClientRect().width >= 48'),true,'type label must have room for message in the compact track');
    if(process.env.PI_TRACK_PREVIEW_SCREENSHOTS_DIR){await new Promise(resolve=>setTimeout(resolve,300));await mkdir(process.env.PI_TRACK_PREVIEW_SCREENSHOTS_DIR,{recursive:true});await writeFile(path.join(process.env.PI_TRACK_PREVIEW_SCREENSHOTS_DIR,`${view}.png`),Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'));}
  }
  await evaluate('document.getElementById("typeFilterButton").click()');
  await evaluate('document.querySelector("#typeFilterOptions input[value=usage]").click()');
  await evaluate('document.querySelector("#typeFilterOptions input[value=compaction]").click()');
  for(const view of ['grove','metro','atlas']){
    await evaluate(`document.querySelector('[data-view="${view}"]').click()`);
    assert.equal(await evaluate('document.querySelectorAll(".skip-indicator").length'),1,`${view} marks its omitted edge`);
  }
  await evaluate('document.querySelector(".skip-indicator").dispatchEvent(new MouseEvent("click",{bubbles:true}))');
  assert.equal(await evaluate('document.querySelectorAll(".collapse-indicator").length'),1);
  assert.equal(await evaluate('document.querySelector(".atlas-node[data-id=trunk-15]")!==null'),true);
  await evaluate('document.querySelector(".collapse-indicator").dispatchEvent(new MouseEvent("click",{bubbles:true}))');
  assert.equal(await evaluate('document.querySelectorAll(".skip-indicator").length'),1);
  await evaluate('document.getElementById("typeFilterAll").click()');
  assert.equal(await evaluate('document.querySelectorAll(".skip-indicator").length'),0);
  await evaluate('document.querySelector(".preview-node[data-id=trunk-8]").dispatchEvent(new MouseEvent("click",{bubbles:true}))');
  assert.equal(await evaluate('document.getElementById("selectionId").textContent'), 'trunk-8');
  assert.equal(await evaluate('document.getElementById("recordRaw").textContent.includes("trunk-8")'),true);
  assert.equal(await evaluate('document.getElementById("recordRaw").textContent.includes("trunk-9")'),false);
  await evaluate('document.querySelector("[data-label-mode=id]").click()');
  await evaluate('document.querySelector("[data-view=grove]").click()');
  assert.equal(await evaluate('document.getElementById("selectionId").textContent'), 'trunk-8');
  assert.equal(await evaluate('document.querySelector("[data-label-mode=id]").getAttribute("aria-pressed")'), 'true');
  const source=path.join(dir,'private.jsonl');const original=[{type:'session',id:'s',version:3},{type:'message',id:'root',parentId:null,message:{role:'user',content:'<img src=x onerror=alert(1)>'}},{type:'custom',id:'child',parentId:'root',data:{safe:true}}].map(JSON.stringify).join('\n')+'\n';await writeFile(source,original);
  const {root}=await command('DOM.getDocument');const {nodeId}=await command('DOM.querySelector',{nodeId:root.nodeId,selector:'#previewFile'});
  await command('DOM.setFileInputFiles',{nodeId,files:[source]});
  await wait(()=>evaluate('document.querySelectorAll(".preview-node").length === 2'));
  const sid=await evaluate('document.getElementById("previewSessionId").textContent');
  assert.equal(await readFile(source,'utf8'),original);
  const result=await fetch(`http://127.0.0.1:${port}/api/sessions/${sid}/annotations/external`,{method:'PUT',headers:{authorization:'Bearer preview-test','content-type':'application/json'},body:JSON.stringify({nodes:[{id:'root',label:'QA note',highlight:true}],edges:[{from:'root',to:'child',label:'trace',highlight:true}]})});
  assert.equal(result.status,204);
  await wait(()=>evaluate('document.getElementById("overlayCount").textContent.includes("2")'));
  assert.equal(await evaluate('document.querySelector(".preview-node[data-id=root]").textContent.includes("QA note")'),true);
  assert.equal(await evaluate('document.querySelectorAll("img").length'),0);
  const emptyFile=path.join(dir,'empty.jsonl');await writeFile(emptyFile,JSON.stringify({type:'session',id:'empty',version:3})+'\n');
  const {root:emptyDocument}=await command('DOM.getDocument');const {nodeId:emptyInput}=await command('DOM.querySelector',{nodeId:emptyDocument.nodeId,selector:'#previewFile'});
  await command('DOM.setFileInputFiles',{nodeId:emptyInput,files:[emptyFile]});
  await wait(()=>evaluate('document.getElementById("nodeCount").textContent === "0 nodes"'));
  for(const view of ['grove','metro','atlas']){
    await evaluate(`document.querySelector('[data-view="${view}"]').click()`);
    assert.equal(await evaluate('document.querySelector(".empty-preview")?.textContent.includes("No entries")'),true,`${view} shows an empty state`);
  }
  await evaluate('document.querySelector("[data-view=grove]").click()');
  const wideFile=path.join(dir,'wide.jsonl'),wideRows=[{type:'session',id:'wide',version:3},{type:'message',id:'wide-root',parentId:null,message:{role:'user',content:'branching root'}}];
  for(let i=0;i<20;i++)wideRows.push({type:'message',id:`branch-${i}`,parentId:'wide-root',message:{role:'assistant',content:[{type:'text',text:`branch ${i}`} ]}});
  await writeFile(wideFile,wideRows.map(JSON.stringify).join('\n')+'\n');
  const {root:wideDocument}=await command('DOM.getDocument');const {nodeId:wideInput}=await command('DOM.querySelector',{nodeId:wideDocument.nodeId,selector:'#previewFile'});
  await command('DOM.setFileInputFiles',{nodeId:wideInput,files:[wideFile]});
  await wait(()=>evaluate('document.getElementById("nodeCount").textContent === "21 nodes"'));
  assert.equal(await evaluate('(()=>{const canvas=document.getElementById("previewCanvas").getBoundingClientRect(),node=document.querySelector(".preview-node[data-id=wide-root]").getBoundingClientRect();return node.width>0&&node.left>=canvas.left&&node.right<=canvas.right&&node.top>=canvas.top&&node.bottom<=canvas.bottom})()'),true,'selected root must start in view for a wide forest');
});
