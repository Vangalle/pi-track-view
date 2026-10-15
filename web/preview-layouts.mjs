export function toGraph(session) {
  const nodes=new Map(session.entries.map(entry=>[entry.id,{id:entry.id,type:entry.type,parentId:entry.parentId,entry,children:[]}]));
  const roots=[];
  for(const entry of session.entries) {
    if(entry.parentId!==null && nodes.has(entry.parentId))nodes.get(entry.parentId).children.push(entry.id);
    else roots.push(entry.id);
  }
  return {nodes,roots};
}
export const gapKey=(from,to)=>JSON.stringify([from,to]);
function project(graph,matches,shown,collapseLinks=new Map()) {
  const nodes=new Map(),roots=[];
  for(const node of graph.nodes.values())if(shown.has(node.id))nodes.set(node.id,{...node,children:[],context:!matches.has(node.id)});
  for(const node of nodes.values()){
    let parentId=node.parentId,skipped=false;
    while(parentId!==null&&!nodes.has(parentId)){
      const hidden=graph.nodes.get(parentId);
      if(!hidden){parentId=null;break;}
      skipped=true;parentId=hidden.parentId;
    }
    node.parentId=parentId;node.skippedParent=skipped;
    if(parentId!==null)nodes.get(parentId).children.push(node.id);
    else roots.push(node.id);
  }
  return {nodes,roots,collapseLinks};
}
export function filterGraph(graph,types,expandedGaps=new Set()) {
  if(types===null)return graph;
  const matches=new Set(),baseShown=new Set();
  for(const node of graph.nodes.values())if(types.has(node.type)){matches.add(node.id);baseShown.add(node.id);}
  for(const id of matches){
    const node=graph.nodes.get(id);
    if(graph.nodes.has(node.parentId))baseShown.add(node.parentId);
    for(const child of node.children)baseShown.add(child);
  }
  const base=project(graph,matches,baseShown);
  if(!expandedGaps.size)return base;
  const shown=new Set(baseShown),collapseLinks=new Map();
  for(const key of expandedGaps){
    let pair;
    try{pair=JSON.parse(key);}catch{continue;}
    if(!Array.isArray(pair)||pair.length!==2||pair.some(id=>typeof id!=='string'))continue;
    const [from,to]=pair,endpoint=base.nodes.get(to);
    if(endpoint?.parentId!==from||!endpoint.skippedParent)continue;
    const path=[];let current=graph.nodes.get(to)?.parentId;
    while(current!==from&&typeof current==='string'&&graph.nodes.has(current)){
      path.push(current);current=graph.nodes.get(current).parentId;
    }
    if(current!==from||path.length===0)continue;
    path.reverse();for(const id of path)shown.add(id);
    collapseLinks.set(gapKey(from,path[0]),key);
  }
  return project(graph,matches,shown,collapseLinks);
}
function edgesOf(graph) {
  return [...graph.nodes.values()].flatMap(node=>node.children.map(to=>({from:node.id,to,skipped:graph.nodes.get(to)?.skippedParent===true,collapseKey:graph.collapseLinks?.get(gapKey(node.id,to))})));
}
function breadthFirst(graph) {
  const order=[...graph.roots];
  for(let i=0;i<order.length;i++)order.push(...graph.nodes.get(order[i]).children);
  return order;
}
export function groveLayout(graph) {
  const positions=new Map(),edges=edgesOf(graph);let lane=0,maxDepth=0;
  for(const root of graph.roots){
    const stack=[{id:root,depth:0,exit:false}];
    while(stack.length){const current=stack.pop(),children=graph.nodes.get(current.id).children;
      if(!current.exit){stack.push({...current,exit:true});for(let i=children.length-1;i>=0;i--)stack.push({id:children[i],depth:current.depth+1,exit:false});}
      else{maxDepth=Math.max(maxDepth,current.depth);const x=children.length?(positions.get(children[0]).x+positions.get(children.at(-1)).x)/2:255+(lane++)*350;positions.set(current.id,{x,y:130+current.depth*118});}
    }
  }
  return {positions,edges,width:Math.max(510,510+(lane-1)*350),height:Math.max(550,260+maxDepth*118)};
}
export function metroLayout(graph) {
  const positions=new Map();const order=breadthFirst(graph);
  order.forEach((id,index)=>{const row=Math.floor(index/6),col=index%6;positions.set(id,{x:135+(row%2?5-col:col)*184,y:118+row*132});});
  return {positions,edges:edgesOf(graph),width:1220,height:Math.max(400,270+Math.floor((order.length-1)/6)*132)};
}
export function atlasLayout(graph) {
  const positions=new Map();const order=breadthFirst(graph);
  order.forEach((id,index)=>{const row=Math.floor(index/12),col=index%12;positions.set(id,{x:38+col*32,y:48+row*36});});
  return {positions,edges:edgesOf(graph),width:445,height:Math.max(240,110+Math.floor((order.length-1)/12)*36)};
}
export function focusNeighborhood(graph,id) {
  const node=graph.nodes.get(id);
  if(!node)return null;
  return {parent:graph.nodes.get(node.parentId)??null,node,children:node.children.map(child=>graph.nodes.get(child))};
}
