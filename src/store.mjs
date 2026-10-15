import { randomUUID } from 'node:crypto';
import { parseSession } from './session.mjs';

export function createStore() {
  const sessions=new Map();
  const required=id=>{ const item=sessions.get(id); if (!item) throw Object.assign(new Error('session not found'),{status:404}); return item; };
  return {
    add(text) {
      const parsed=parseSession(text);
      const id=randomUUID();
      sessions.set(id,{...parsed,annotationsBySource:new Map()});
      return id;
    },
    get:id=>sessions.get(id),
    annotations(id) {
      const item=required(id), nodes=[],edges=[];
      for (const [source,overlay] of [...item.annotationsBySource].sort(([a],[b])=>a.localeCompare(b))) {
        nodes.push(...overlay.nodes.map(n=>({...n,source})));
        edges.push(...overlay.edges.map(e=>({...e,source})));
      }
      return {nodes,edges};
    },
    setAnnotations(id,source,payload) {
      const item=required(id);
      if (!/^[a-zA-Z0-9][\w-]{0,63}$/.test(source)) throw new Error('invalid source');
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges) || payload.nodes.length+payload.edges.length>10000) throw new Error('expected nodes and edges arrays');
      const validDecor=record=>{
        if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('invalid annotation');
        if (record.label !== undefined && (typeof record.label !== 'string' || record.label.length>240)) throw new Error('invalid label');
        if (record.highlight !== undefined && typeof record.highlight !== 'boolean') throw new Error('invalid highlight');
      };
      const nodes=payload.nodes.map(record=>{
        validDecor(record);
        if (typeof record.id !== 'string' || !item.nodes.has(record.id)) throw new Error('unknown node');
        return {id:record.id,...(record.label===undefined?{}:{label:record.label}),...(record.highlight===undefined?{}:{highlight:record.highlight})};
      });
      const edges=payload.edges.map(record=>{
        validDecor(record);
        if (typeof record.from !== 'string' || typeof record.to !== 'string' || !item.nodes.get(record.from)?.children.includes(record.to)) throw new Error('unknown edge');
        return {from:record.from,to:record.to,...(record.label===undefined?{}:{label:record.label}),...(record.highlight===undefined?{}:{highlight:record.highlight})};
      });
      item.annotationsBySource.set(source,{nodes,edges});
    },
    removeAnnotations(id,source) { const item=required(id); item.annotationsBySource.delete(source); }
  };
}
