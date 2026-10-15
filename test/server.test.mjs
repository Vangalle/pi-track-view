import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../src/server.mjs';
import { createStore } from '../src/store.mjs';
const token='test-secret';
const doc=[{type:'session',id:'s',version:3},{type:'message',id:'root',parentId:null,message:{role:'user',content:'hello'}},{type:'usage',id:'child',parentId:'root',kind:'cache'}].map(JSON.stringify).join('\n')+'\n';
async function setup(t) {
  const server=createServer({store:createStore(),token,maxBytes:1024*1024});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{authorization:`Bearer ${token}`,...headers},body});
  return {server,base,request};
}
test('session upload/read, invalid upload, restart and authentication',async t=>{
  const {request,base}=await setup(t);
  assert.equal((await fetch(base+'/api/sessions',{headers:{authorization:'Bearer wrong'}})).status,401);
  const uploaded=await request('/api/sessions','POST',doc);
  assert.equal(uploaded.status,201);
  const {id}=await uploaded.json();
  const read=await (await request(`/api/sessions/${id}`)).json();
  assert.equal(read.entries[1].id,'child');
  assert.deepEqual(read.roots,['root']);
  assert.equal((await request('/api/sessions','POST','bad')).status,400);
  assert.equal((await request(`/api/sessions/${id}`)).status,200);
  assert.equal((await request('/api/sessions/no-such-session')).status,404);
  const other=createStore();
  assert.equal(other.get(id),undefined);
});
test('independent sources, exact node/edge validation, atomic replacement',async t=>{
  const {request}=await setup(t);
  const {id}=await (await request('/api/sessions','POST',doc)).json();
  const path=`/api/sessions/${id}/annotations`;
  const put=(source,payload)=>request(`${path}/${source}`,'PUT',JSON.stringify(payload),{'content-type':'application/json'});
  assert.equal((await put('alpha',{nodes:[{id:'root',label:'watch',highlight:true}],edges:[{from:'root',to:'child',label:'step'}]})).status,204);
  assert.equal((await put('beta',{nodes:[{id:'child',label:'done'}],edges:[]})).status,204);
  assert.equal((await put('alpha',{nodes:[{id:'missing',label:'bad'}],edges:[]})).status,400);
  assert.equal((await put('alpha',{nodes:[],edges:[{from:'child',to:'root',highlight:true}]})).status,400);
  let overlays=await (await request(path)).json();
  assert.deepEqual(overlays.nodes.map(x=>x.label),['watch','done']);
  assert.equal(overlays.edges[0].to,'child');
  assert.equal((await request(`${path}/alpha`,'DELETE')).status,204);
  overlays=await (await request(path)).json();
  assert.deepEqual(overlays.nodes.map(x=>x.label),['done']);
});
test('foreign origin, host, malformed JSON and huge body rejected',async t=>{
  const {request,server}=await setup(t);
  assert.equal((await request('/api/sessions','POST',doc,{origin:'http://evil.test'})).status,403);
  const hostileHost=await new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/sessions',headers:{host:'evil.test',authorization:`Bearer ${token}`}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);req.end();
  });
  assert.equal(hostileHost,403);
  const {id}=await (await request('/api/sessions','POST',doc)).json();
  const path=`/api/sessions/${id}/annotations/src`;
  assert.equal((await request(path,'PUT','{',{'content-type':'application/json'})).status,400);
  assert.equal((await request(path,'PUT',JSON.stringify({nodes:[{id:'root',label:'x'.repeat(300)}],edges:[]}))).status,400);
  assert.equal((await request('/api/sessions','POST','x'.repeat(1024*1024+1))).status,413);
});
