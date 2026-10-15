import http from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { openPrettySession } from './editor.mjs';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';

const assetPaths = {'/':'preview.html','/index.html':'preview.html','/tree.mjs':'tree.mjs',
  '/preview':'preview.html','/preview.css':'preview.css','/preview.mjs':'preview.mjs','/preview-data.mjs':'preview-data.mjs','/preview-layouts.mjs':'preview-layouts.mjs'};
const webRoot=new URL('../web/',import.meta.url);

function send(res,status,value) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(value));
}
async function bodyText(req,maxBytes) {
  const chunks=[];
  let size=0,tooLarge=false;
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>maxBytes) {tooLarge=true;continue;}
    chunks.push(chunk);
  }
  if (tooLarge) throw Object.assign(new Error('request too large'),{status:413});
  return Buffer.concat(chunks).toString('utf8');
}
export function createServer({store=createStore(),token,openEditor,maxBytes=64*1024*1024}={}) {
  if (!token) throw new Error('token required');
  const temporaryDirectories=new Set();
  const server=http.createServer(async (req,res)=>{
    const host=req.headers.host;
    if (!host || !/^127\.0\.0\.1:\d+$/.test(host) || host !== `127.0.0.1:${req.socket.localPort}`) return send(res,403,{error:'invalid host'});
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(res,403,{error:'invalid origin'});
    const pathname=new URL(req.url,`http://${host}`).pathname;
    if (req.method==='GET' && pathname==='/bootstrap.mjs') {
      res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
      return res.end(`export const token = ${JSON.stringify(token)};`);
    }
    if (req.method==='GET' && assetPaths[pathname]) {
      try {
        const data=await readFile(fileURLToPath(new URL(assetPaths[pathname],webRoot)));
        const contentType=pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.mjs') ? 'text/javascript' : 'text/html';
        res.writeHead(200,{'content-type':`${contentType}; charset=utf-8`,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'"});
        return res.end(data);
      } catch { return send(res,404,{error:'asset missing'}); }
    }
    if (!pathname.startsWith('/api/')) return send(res,404,{error:'not found'});
    if (req.headers.authorization !== `Bearer ${token}`) return send(res,401,{error:'unauthorized'});
    try {
      if (pathname==='/api/sessions' && req.method==='POST') {
        const id=store.add(await bodyText(req,maxBytes));
        return send(res,201,{id});
      }
      const match=pathname.match(/^\/api\/sessions\/([a-f\d-]{36})(?:\/(annotations|open-editor)(?:\/([\w-]+))?)?$/);
      if (!match) return send(res,404,{error:'not found'});
      const [,id,endpoint,source]=match;
      const session=store.get(id);
      if (!session) return send(res,404,{error:'session not found'});
      if (!endpoint && req.method==='GET') return send(res,200,{id,header:session.header,entries:session.entries,roots:session.roots,warnings:session.warnings});
      if (endpoint==='open-editor' && req.method==='POST') {
        const result=await (openEditor??openPrettySession)(session.entries.length ? [session.header,...session.entries] : [session.header]);
        if (!openEditor && result.directory) temporaryDirectories.add(result.directory);
        return send(res,200,{opened:true});
      }
      if (endpoint==='annotations' && !source && req.method==='GET') return send(res,200,store.annotations(id));
      if (endpoint==='annotations' && source && req.method==='PUT') {
        let payload;
        try {payload=JSON.parse(await bodyText(req,Math.min(maxBytes,2*1024*1024)));} catch (error) {if (error.status) throw error;throw new Error('invalid JSON');}
        store.setAnnotations(id,source,payload);
        res.writeHead(204,{'cache-control':'no-store'});return res.end();
      }
      if (endpoint==='annotations' && source && req.method==='DELETE') {
        store.removeAnnotations(id,source);
        res.writeHead(204,{'cache-control':'no-store'});return res.end();
      }
      return send(res,404,{error:'not found'});
    } catch (error) {
      return send(res,error.status??400,{error:error.message});
    }
  });
  server.on('close',()=>{for(const directory of temporaryDirectories) rm(directory,{recursive:true,force:true}).catch(()=>{});});
  return server;
}
