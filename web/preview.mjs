import { token } from '/bootstrap.mjs';
import { nodeColor,nodeCaption,overlayFor,recordView } from './tree.mjs';
import { demoSession,demoOverlay } from './preview-data.mjs';
import { toGraph,filterGraph,gapKey,groveLayout,metroLayout,atlasLayout,focusNeighborhood } from './preview-layouts.mjs';

const $=id=>document.getElementById(id);
const mainMode=location.pathname==='/'||location.pathname==='/index.html';
if(mainMode){document.body.classList.add('main-view');document.title='pi-track-view · session tree';$('brandSubtitle').textContent='PI SESSION VIEWER';document.querySelector('.lab-footer > span').textContent='READ-ONLY LOCAL SESSION';}
const ns='http://www.w3.org/2000/svg';
const descriptions={
  grove:['01 / CONVERSATION GROVE','Follow the conversation.','A vertical, readable path. Branches spread sideways instead of squeezing the session into one line.','SCROLL TO FOLLOW THE PATH · CLICK A CARD TO INSPECT'],
  metro:['02 / METRO TRACKS','See the route, not just the dots.','One long path folds into legible rows. Split edges take their own line, like a transit interchange.','SCROLL THE ROUTE · CLICK A STATION TO INSPECT'],
  atlas:['03 / ATLAS + FOCUS','Keep the whole tree in sight.','A compact map shows every entry; the focus lens makes one neighborhood readable at a time.','CLICK A DOT TO FOCUS · USE THE CARDS TO MOVE THROUGH THE TREE']
};
let session=demoSession(),graph=toGraph(session),visibleGraph=graph,selectedTypes=null,expandedGaps=new Set(),overlay=demoOverlay(),view='grove',labelMode='type',selected='trunk-8',real=false,pollTimer,pinned=null,comparedFocusId=null,displayedId=null;
const elt=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element;};
const svg=(tag,attrs={},text)=>{const element=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))element.setAttribute(key,String(value));if(text!==undefined)element.textContent=text;return element;};
function fail(error){$('previewError').textContent=error.message??String(error);$('previewError').hidden=false;clearTimeout(fail.timer);fail.timer=setTimeout(()=>$('previewError').hidden=true,6000);}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{authorization:`Bearer ${token}`,...options.headers}});if(!response.ok){let message=`HTTP ${response.status}`;try{message=(await response.json()).error??message;}catch{}throw new Error(message);}return response.status===204?null:response.json();}
function roleOf(node){return node.entry.message?.role??node.type;}
function textOf(node){const entry=node.entry,content=entry.message?.content??entry.content??entry.summary??entry.label??entry.kind??entry.customType;
  if(typeof content==='string')return content;
  if(Array.isArray(content))return content.map(block=>block?.text??block?.thinking??(block?.type==='toolCall'?`${block.name??'tool'}(${JSON.stringify(block.arguments??{})})`:block?.type==='image'?'[image]':'')).filter(Boolean).join(' ');
  return entry.type==='usage'?'Token / cost event':entry.type==='custom'?'Extension state':entry.type.replaceAll('_',' ');
}
function caption(node){return nodeCaption(node,labelMode);}
function nodeOverlay(node){return node.context?{labels:[],highlight:false}:overlayFor(overlay,node.id);}
function decorate(card,node){card.style.setProperty('--type-color',node.context?'#9aa7a1':nodeColor(node.type));card.dataset.id=node.id;card.title=`${node.id} · ${roleOf(node)}`;
  if(node.context)card.classList.add('context');if(nodeOverlay(node).highlight)card.classList.add('highlight');if(node.id===selected)card.classList.add('selected');
  card.addEventListener('click',()=>choose(node.id));
}
function content(card,node,stationNumber){const top=elt('div','node-top'),role=elt('span','role',roleOf(node)),label=elt('span','node-caption',caption(node));
  if(stationNumber!==undefined){const number=elt('span','station-index',String(stationNumber).padStart(2,'0'));role.prepend(number);}
  top.append(role,label);card.append(top,elt('div','snippet',textOf(node)||node.type));
  const notes=nodeOverlay(node).labels;if(notes.length)card.append(elt('span','overlay-tag',notes.join(' · ')));
}
function skipIndicator(a,b,kind,key,expanded=false){
  const width=kind==='atlas'?18:34,height=kind==='atlas'?18:26,title=expanded?'Collapse expanded nodes':'Expand omitted nodes';
  const marker=svg('g',{class:expanded?'collapse-indicator':'skip-indicator',transform:`translate(${(a.x+b.x)/2} ${(a.y+b.y)/2})`,role:'button',tabindex:'0','aria-label':title});
  marker.dataset.gapKey=key;
  marker.append(svg('rect',{x:-width/2,y:-height/2,width,height,rx:height/2}),svg('text',{x:0,y:kind==='atlas'?4:5,'text-anchor':'middle'},expanded?'−':'…'),svg('title',{},title));
  marker.addEventListener('click',event=>{event.stopPropagation();toggleGap(key);});
  marker.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleGap(key);}});
  return marker;
}
function edgeScene(layout,kind,stage){const lines=svg('svg',{class:'preview-links',width:layout.width,height:layout.height,viewBox:`0 0 ${layout.width} ${layout.height}`});
  for(const edge of layout.edges){const a=layout.positions.get(edge.from),b=layout.positions.get(edge.to),parent=visibleGraph.nodes.get(edge.from),branch=parent.children.length>1 && parent.children[0]!==edge.to,context=parent.context||visibleGraph.nodes.get(edge.to).context,decor=edge.skipped||context?{labels:[],highlight:false}:overlayFor(overlay,edge.from,edge.to);
    const path=kind==='grove'?`M ${a.x} ${a.y+55} C ${a.x} ${a.y+80}, ${b.x} ${b.y-75}, ${b.x} ${b.y-45}`:`M ${a.x} ${a.y} C ${(a.x+b.x)/2} ${a.y}, ${(a.x+b.x)/2} ${b.y}, ${b.x} ${b.y}`;
    const line=svg('path',{d:path,class:`${kind}-link${branch?' branch':''}${decor.highlight?' highlight':''}${edge.skipped?' skipped':''}${context?' context':''}`});
    if(edge.skipped)line.append(svg('title',{},'Filtered connection · hidden entries in between'));
    lines.append(line);
    if(edge.skipped)lines.append(skipIndicator(a,b,kind,gapKey(edge.from,edge.to)));
    if(edge.collapseKey)lines.append(skipIndicator(a,b,kind,edge.collapseKey,true));
    if(decor.labels.length)lines.append(svg('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-6,class:'edge-tag','text-anchor':'middle'},decor.labels.join(' · ')));
  }
  stage.append(lines);
}
function drawGrove(host){const layout=groveLayout(visibleGraph),stage=elt('div','grove-stage');stage.style.width=`${layout.width}px`;stage.style.height=`${layout.height}px`;edgeScene(layout,'grove',stage);
  for(const node of visibleGraph.nodes.values()){const p=layout.positions.get(node.id),card=elt('button','grove-node preview-node');card.type='button';card.style.left=`${p.x}px`;card.style.top=`${p.y}px`;decorate(card,node);content(card,node);stage.append(card);}host.append(stage);
  return {focusX:layout.positions.get(selected)?.x??255,focusY:layout.positions.get(selected)?.y??130};
}
function drawMetro(host){const layout=metroLayout(visibleGraph),stage=elt('div','metro-stage');stage.style.width=`${layout.width}px`;stage.style.height=`${layout.height}px`;edgeScene(layout,'metro',stage);
  let index=0;for(const node of visibleGraph.nodes.values()){const p=layout.positions.get(node.id),card=elt('button','metro-node preview-node');card.type='button';card.style.left=`${p.x}px`;card.style.top=`${p.y}px`;decorate(card,node);content(card,node,++index);stage.append(card);}host.append(stage);
  return {focusY:layout.positions.get(selected)?.y??120};
}
function focusCard(node,extra=''){const card=elt('button',`focus-card${extra?' '+extra:''}`);card.type='button';decorate(card,node);content(card,node);return card;}
function drawAtlas(host){const layout=atlasLayout(visibleGraph),shell=elt('div','atlas-shell'),left=elt('div','atlas-map-shell'),map=svg('svg',{class:'atlas-map',width:layout.width,height:layout.height,viewBox:`0 0 ${layout.width} ${layout.height}`});
  for(const edge of layout.edges){const a=layout.positions.get(edge.from),b=layout.positions.get(edge.to),parent=visibleGraph.nodes.get(edge.from),branch=parent.children.length>1&&parent.children[0]!==edge.to,context=parent.context||visibleGraph.nodes.get(edge.to).context,decoration=edge.skipped||context?{labels:[],highlight:false}:overlayFor(overlay,edge.from,edge.to);
    const line=svg('path',{d:`M ${a.x} ${a.y} L ${b.x} ${b.y}`,class:`atlas-link${branch?' branch':''}${decoration.highlight?' highlight':''}${edge.skipped?' skipped':''}${context?' context':''}`});
    if(edge.skipped)line.append(svg('title',{},'Filtered connection · hidden entries in between'));
    map.append(line);
    if(edge.skipped)map.append(skipIndicator(a,b,'atlas',gapKey(edge.from,edge.to)));
    if(edge.collapseKey)map.append(skipIndicator(a,b,'atlas',edge.collapseKey,true));
  }
  for(const node of visibleGraph.nodes.values()){const p=layout.positions.get(node.id),g=svg('g',{class:`atlas-node preview-node${node.context?' context':''}${node.id===selected?' selected':''}${nodeOverlay(node).highlight?' highlight':''}`,transform:`translate(${p.x} ${p.y})`,role:'button',tabindex:'0','aria-label':`${node.id} ${roleOf(node)}`});g.style.setProperty('--type-color',node.context?'#9aa7a1':nodeColor(node.type));g.dataset.id=node.id;
    g.append(svg('circle',{r:8}));const labels=nodeOverlay(node).labels;if(labels.length)g.append(svg('text',{x:10,y:-10,class:'atlas-annotation'},labels.join(' · ')));
    if(node.id===selected&&caption(node))g.append(svg('text',{x:11,y:4,class:'atlas-annotation'},caption(node).slice(0,12)));
    g.append(svg('title',{},`${node.id} · ${node.type}${labels.length?' · '+labels.join(', '):''}`));g.addEventListener('click',()=>choose(node.id));g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(node.id);}});map.append(g);
  }
  left.append(map);const right=elt('div','atlas-focus');right.append(elt('div','focus-kicker','CURRENT NEIGHBORHOOD'),elt('h3','focus-heading','From map to meaning.'),elt('p','focus-copy','Select any dot to move the lens. Every dot remains a real session entry.'));
  const segment=elt('div','focus-sequence'),focus=focusNeighborhood(visibleGraph,selected)??focusNeighborhood(visibleGraph,visibleGraph.roots[0]);
  if(focus.parent){segment.append(focusCard(focus.parent),elt('div','focus-connector','PARENT →'));}
  segment.append(focusCard(focus.node,'selected'));
  if(focus.children.length){segment.append(elt('div','focus-connector',`CHILDREN ↓ ${focus.children.length}`));const children=elt('div','focus-children');for(const child of focus.children)children.append(focusCard(child));segment.append(children);}
  else segment.append(elt('div','focus-connector','END OF THIS BRANCH'));
  right.append(segment);shell.append(left,right);host.append(shell);return {focusY:0};
}
function syncTypeFilter(){
  $('typeFilterButton').textContent=selectedTypes===null?'Filter type · All':selectedTypes.size===0?'Filter type · None':selectedTypes.size===1?`Filter type · ${[...selectedTypes][0]}`:`Filter type · ${selectedTypes.size} types`;
  $('typeFilterAll').setAttribute('aria-pressed',String(selectedTypes===null));
  for(const checkbox of $('typeFilterOptions').querySelectorAll('input'))checkbox.checked=selectedTypes?.has(checkbox.value)??false;
}
function buildTypeFilter(){
  const counts=new Map();for(const node of graph.nodes.values())counts.set(node.type,(counts.get(node.type)??0)+1);
  const options=$('typeFilterOptions');options.replaceChildren();
  for(const [type,count] of counts){const row=elt('label','type-filter-row'),checkbox=elt('input'),dot=elt('span','type-filter-dot'),name=elt('span','',type),number=elt('span','type-filter-count',String(count));
    checkbox.type='checkbox';checkbox.value=type;dot.style.setProperty('--type-color',nodeColor(type));
    checkbox.addEventListener('change',()=>{const next=new Set(selectedTypes??[]);if(checkbox.checked)next.add(type);else next.delete(type);applyTypes(next);});
    row.append(checkbox,dot,name,number);options.append(row);
  }
  syncTypeFilter();
}
function applyTypes(next){selectedTypes=next;expandedGaps.clear();visibleGraph=filterGraph(graph,next);
  if(!visibleGraph.nodes.has(selected)){selected=[...visibleGraph.nodes.values()].find(node=>!node.context)?.id??null;hideInspector();}
  syncTypeFilter();render({resetScroll:true});
}
function toggleGap(key){
  if(selectedTypes===null)return;
  if(expandedGaps.has(key))expandedGaps.delete(key);else expandedGaps.add(key);
  visibleGraph=filterGraph(graph,selectedTypes,expandedGaps);
  if(!visibleGraph.nodes.has(selected)){
    const [,to]=JSON.parse(key);
    selected=visibleGraph.nodes.has(to)?to:[...visibleGraph.nodes.values()].find(node=>!node.context)?.id??null;
    hideInspector();
  }
  render();
}
function visibleAnnotationCount(){
  const ids=visibleGraph.nodes;
  return overlay.nodes.filter(note=>ids.has(note.id)&&!ids.get(note.id).context).length+
    overlay.edges.filter(note=>ids.get(note.from)?.children.includes(note.to)&&!ids.get(note.from).context&&!ids.get(note.to).context&&ids.get(note.to)?.skippedParent!==true).length;
}
function render({resetScroll=false}={}){const host=$('sceneHost'),top=host.scrollTop,left=host.scrollLeft,mapTop=host.querySelector('.atlas-map-shell')?.scrollTop??0;
  host.replaceChildren();$('previewCanvas').className=`preview-canvas view-${view}`;
  const [eyebrow,title,description,hint]=descriptions[view];$('viewEyebrow').textContent=mainMode?'SESSION TREE':eyebrow;$('viewTitle').textContent=title;$('viewDescription').textContent=description;$('canvasHint').textContent=hint;
  const layout=visibleGraph.nodes.size===0
    ? (host.append(elt('div','empty-preview',graph.nodes.size===0?'No entries in this session. Open another .jsonl or use the example.':'No nodes match the selected types. Choose another type or All types.')),{focusY:0})
    : view==='grove'?drawGrove(host):view==='metro'?drawMetro(host):drawAtlas(host);
  if(resetScroll){host.scrollLeft=view==='grove'?Math.max(0,(layout.focusX??0)-host.clientWidth/2):0;host.scrollTop=view==='grove'&&session.id==='demo'?Math.max(0,layout.focusY-165):0;}
  else{host.scrollTop=top;host.scrollLeft=left;const map=host.querySelector('.atlas-map-shell');if(map)map.scrollTop=mapTop;}
  const matches=[...visibleGraph.nodes.values()].filter(node=>!node.context).length;
  $('nodeCount').textContent=selectedTypes===null?`${graph.nodes.size} nodes`:`${matches} match${matches===1?'':'es'} · ${visibleGraph.nodes.size-matches} context / ${graph.nodes.size} total`;$('overlayCount').textContent=`${overlay.nodes.length+overlay.edges.length} annotations${selectedTypes===null?'':` · ${visibleAnnotationCount()} visible`}`;$('selectionId').textContent=selected??'—';$('previewSessionId').textContent=session.id;
  for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===view));
  for(const button of document.querySelectorAll('[data-label-mode]'))button.setAttribute('aria-pressed',String(button.dataset.labelMode===labelMode));
}
function syncPin(){const active=Boolean(pinned),button=$('pinRecord'),panel=$('previewInspector');
  panel.classList.toggle('pinned',active);panel.setAttribute('aria-label',active?'Pinned and focused entries':'Single selected entry');$('comparePane').hidden=!active;
  $('inspectorMode').textContent=active?'PINNED COMPARISON':'ISOLATED ENTRY';button.textContent=active?'Unpin':'Pin';button.setAttribute('aria-label',active?'Unpin entry':'Pin entry');button.setAttribute('aria-pressed',String(active));
  if(!active){for(const id of ['pinId','pinRaw','focusId','focusRaw'])$(id).textContent='';return;}
  $('pinId').textContent=`NODE / ${pinned.id}`;$('pinRaw').textContent=pinned.raw;
  const focus=comparedFocusId?graph.nodes.get(comparedFocusId):null;
  $('focusId').textContent=focus?`NODE / ${comparedFocusId}`:'';
  $('focusRaw').textContent=focus?recordView(focus.entry).raw:'Choose another node in the tree to compare.';
}
function resetPin(){pinned=null;comparedFocusId=null;displayedId=null;$('pinRecord').disabled=true;syncPin();}
function setInspectorCentered(next,{restoreFocus=true}={}){
  const panel=$('previewInspector'),active=next&&panel.classList.contains('open'),button=$('focusInspector');
  panel.classList.toggle('centered',active);$('inspectorBackdrop').classList.toggle('active',active);document.body.classList.toggle('centered-inspector',active);
  button.setAttribute('aria-pressed',String(active));button.textContent=active?'Return to bottom':'Focus view';
  if(active){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');button.focus();}
  else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');if(restoreFocus&&panel.classList.contains('open'))button.focus();}
}
function hideInspector({restoreFocus=false}={}){const panel=$('previewInspector'),wasInside=panel.contains(document.activeElement);
  setInspectorCentered(false,{restoreFocus:false});panel.classList.remove('open');panel.setAttribute('aria-hidden','true');
  if(restoreFocus&&wasInside)document.querySelector('.preview-node.selected')?.focus();
}
function showRecord(id){const node=graph.nodes.get(id);if(!node)return;const info=recordView(node.entry);displayedId=id;$('recordTitle').textContent=info.title;$('recordId').textContent=`NODE / ${node.id}`;$('recordRaw').textContent=info.raw;$('recordContent').textContent=info.blocks.length?info.blocks.map(block=>block.text).join('\n\n'):info.raw;
  $('pinRecord').disabled=false;if(pinned){comparedFocusId=id;syncPin();}
  $('previewInspector').classList.add('open');$('previewInspector').setAttribute('aria-hidden','false');}
function choose(id){if(!visibleGraph.nodes.has(id))return;selected=id;showRecord(id);
  if(view==='atlas'){render();return;}
  const host=$('sceneHost');host.querySelector('.preview-node.selected')?.classList.remove('selected');
  for(const card of host.querySelectorAll('.preview-node'))if(card.dataset.id===id){card.classList.add('selected');break;}
  $('selectionId').textContent=id;
}
function useDemo(){clearInterval(pollTimer);session=demoSession();graph=toGraph(session);selectedTypes=null;expandedGaps.clear();resetPin();visibleGraph=graph;overlay=demoOverlay();selected='trunk-8';real=false;$('dataBadge').textContent='●   SYNTHETIC EXAMPLE';$('previewEditor').disabled=true;$('copySessionId').disabled=true;hideInspector();buildTypeFilter();render({resetScroll:true});}
async function useReal(data,label){clearInterval(pollTimer);session=data;graph=toGraph(data);selectedTypes=null;expandedGaps.clear();resetPin();visibleGraph=graph;overlay={nodes:[],edges:[]};selected=graph.roots[0]??null;real=true;$('previewEditor').disabled=false;$('dataBadge').textContent=`●   ${label.slice(0,38)}`;$('copySessionId').disabled=false;hideInspector();buildTypeFilter();render({resetScroll:true});
  const id=data.id;async function poll(){try{const current=await api(`/api/sessions/${id}/annotations`);if(real&&session.id===id&&JSON.stringify(current)!==JSON.stringify(overlay)){overlay=current;render();}}catch(error){fail(error);clearInterval(pollTimer);}}
  await poll();pollTimer=setInterval(poll,1400);
}
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{view=button.dataset.view;render({resetScroll:true});});
for(const button of document.querySelectorAll('[data-label-mode]'))button.addEventListener('click',()=>{labelMode=button.dataset.labelMode;render();});
let filterAnimation;
function setTypeFilterOpen(open){
  const panel=$('typeFilterPanel'),button=$('typeFilterButton');
  if(!open&&button.getAttribute('aria-expanded')==='false')return;
  filterAnimation?.cancel();filterAnimation=null;
  button.setAttribute('aria-expanded',String(open));
  if(open)panel.hidden=false;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){panel.hidden=!open;return;}
  filterAnimation=panel.animate(open
    ? [{opacity:0,transform:'translateY(-7px)'},{opacity:1,transform:'translateY(0)'}]
    : [{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-7px)'}],
    {duration:open?190:150,easing:'ease-out',fill:'forwards'});
  if(!open)filterAnimation.finished.then(()=>{if(button.getAttribute('aria-expanded')==='false')panel.hidden=true;}).catch(()=>{});
}
function closeTypeFilter(){setTypeFilterOpen(false);}
$('typeFilterButton').addEventListener('click',()=>setTypeFilterOpen($('typeFilterButton').getAttribute('aria-expanded')!=='true'));
$('typeFilterAll').addEventListener('click',()=>applyTypes(null));
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.type-filter'))closeTypeFilter();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeTypeFilter();});
function syncFullscreen(){const active=Boolean(document.fullscreenElement)||document.body.classList.contains('immersive');$('fullscreenButton').setAttribute('aria-pressed',String(active));$('fullscreenButton').setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');$('fullscreenButton').textContent=active?'⤡ Exit fullscreen':'⛶ Fullscreen';}
async function toggleFullscreen(){
  if(document.fullscreenElement){try{await document.exitFullscreen();}catch(error){fail(error);}syncFullscreen();return;}
  if(document.body.classList.contains('immersive')){document.body.classList.remove('immersive');syncFullscreen();return;}
  try{if(typeof document.documentElement.requestFullscreen!=='function')throw new Error('Fullscreen unavailable');await document.documentElement.requestFullscreen();}
  catch{document.body.classList.add('immersive');}
  syncFullscreen();
}
$('fullscreenButton').addEventListener('click',toggleFullscreen);
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('immersive')){document.body.classList.remove('immersive');syncFullscreen();}});
$('sampleButton').addEventListener('click',()=>{localStorage.removeItem(mainMode?'pi-track-view-session':'pi-track-view-preview-session');useDemo();});
$('copyApiKey').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(token);$('copyApiKey').textContent='Copied ✓';setTimeout(()=>$('copyApiKey').textContent='Copy local key',2000);}catch(error){fail(error);}});
$('copySessionId').addEventListener('click',async()=>{if(!real)return;try{await navigator.clipboard.writeText(session.id);$('copySessionId').textContent='Copied ✓';setTimeout(()=>$('copySessionId').textContent='Copy session ID',2000);}catch(error){fail(error);}});
$('previewFile').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{const {id}=await api('/api/sessions',{method:'POST',body:await file.text()});const data=await api(`/api/sessions/${id}`);localStorage.setItem(mainMode?'pi-track-view-session':'pi-track-view-preview-session',id);await useReal(data,file.name);}catch(error){fail(error);}finally{event.target.value='';}});
$('pinRecord').addEventListener('click',()=>{
  if(pinned){pinned=null;comparedFocusId=null;syncPin();if(selected&&visibleGraph.nodes.has(selected))showRecord(selected);else{$('pinRecord').disabled=true;$('previewInspector').classList.remove('open');$('previewInspector').setAttribute('aria-hidden','true');}}
  else if(displayedId&&graph.nodes.has(displayedId)){pinned={id:displayedId,raw:$('recordRaw').textContent};comparedFocusId=null;syncPin();}
});
$('focusInspector').addEventListener('click',()=>setInspectorCentered(!$('previewInspector').classList.contains('centered')));
$('inspectorBackdrop').addEventListener('click',()=>setInspectorCentered(false));
document.addEventListener('keydown',event=>{
  const panel=$('previewInspector');if(!panel.classList.contains('centered'))return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setInspectorCentered(false);return;}
  if(event.key!=='Tab')return;
  const controls=[...panel.querySelectorAll('button:not(:disabled),summary')].filter(element=>element.getClientRects().length>0);
  if(!controls.length){event.preventDefault();return;}
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  else if(!panel.contains(document.activeElement)){event.preventDefault();first.focus();}
},true);
$('closeInspector').addEventListener('click',()=>hideInspector({restoreFocus:true}));
$('previewEditor').addEventListener('click',async()=>{if(!real)return;try{await api(`/api/sessions/${session.id}/open-editor`,{method:'POST'});}catch(error){fail(error);}});
useDemo();
const previous=mainMode?localStorage.getItem('pi-track-view-session'):(localStorage.getItem('pi-track-view-preview-session')??localStorage.getItem('pi-track-view-session'));
if(previous)api(`/api/sessions/${previous}`).then(data=>useReal(data,localStorage.getItem('pi-track-view-preview-name')??'CURRENT SESSION')).catch(()=>{});
