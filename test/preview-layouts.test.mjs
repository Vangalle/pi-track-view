import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoSession, demoOverlay } from '../web/preview-data.mjs';
import { toGraph, filterGraph, gapKey, groveLayout, metroLayout, atlasLayout, focusNeighborhood } from '../web/preview-layouts.mjs';

test('demo offers a long chain, real forks and a separately keyed overlay', () => {
  const session = demoSession();
  const graph = toGraph(session);
  assert.ok(session.entries.length > 25);
  assert.ok([...graph.nodes.values()].some(node => node.children.length > 1));
  assert.ok(demoOverlay().nodes.every(note => graph.nodes.has(note.id)));
  assert.ok(demoOverlay().edges.every(note => graph.nodes.get(note.from)?.children.includes(note.to)));
});

test('all three views retain every entry and only true tree edges', () => {
  const graph = toGraph(demoSession());
  const expected = [...graph.nodes.values()].flatMap(node => node.children.map(child => `${node.id}->${child}`)).sort();
  for (const layout of [groveLayout, metroLayout, atlasLayout]) {
    const result = layout(graph);
    assert.deepEqual([...result.positions.keys()].sort(), [...graph.nodes.keys()].sort());
    assert.deepEqual(result.edges.map(edge => `${edge.from}->${edge.to}`).sort(), expected);
    assert.ok(result.width > 0 && result.height > 0);
  }
});

test('grove grows down while metro wraps a long chain into distinct rows', () => {
  const graph = toGraph(demoSession());
  const grove = groveLayout(graph), metro = metroLayout(graph);
  assert.ok(grove.positions.get('trunk-14').y > grove.positions.get('trunk-1').y);
  assert.ok(new Set([...metro.positions.values()].map(position => position.y)).size > 2);
  assert.ok(metro.width < grove.height);
});

test('side branches stay near their fork in compact layouts', () => {
  const graph=toGraph(demoSession());
  for(const layout of [metroLayout,atlasLayout]){
    const positions=layout(graph).positions;
    assert.ok(Math.abs(positions.get('alt-1').y-positions.get('trunk-8').y)<180);
    assert.ok(Math.abs(positions.get('alt-1').y-positions.get('trunk-9').y)<180);
  }
});

test('atlas focus uses exact parent and children and retains orphan roots', () => {
  const session = demoSession();
  session.entries.push({id:'orphan',type:'unrecognized_type',parentId:'lost'});
  session.roots.push('orphan');
  const graph = toGraph(session);
  assert.equal(atlasLayout(graph).positions.size, session.entries.length);
  assert.equal(focusNeighborhood(graph,'orphan').parent,null);
  assert.equal(focusNeighborhood(graph,'trunk-14').parent.id,'trunk-13');
  assert.deepEqual(focusNeighborhood(graph,'trunk-14').children.map(child => child.id),['trunk-15']);
});

test('type projection adds one direct parent and all direct children without changing the source', () => {
  const graph=toGraph({entries:[
    {id:'a',type:'usage',parentId:null},{id:'b',type:'usage',parentId:'a'},
    {id:'c',type:'message',parentId:'b'},{id:'d',type:'usage',parentId:'c'},
    {id:'e',type:'usage',parentId:'c'},{id:'g',type:'message',parentId:'c'},
    {id:'f',type:'usage',parentId:'d'},{id:'h',type:'message',parentId:'b'}
  ]});
  assert.equal(filterGraph(graph,null),graph);
  const projected=filterGraph(graph,new Set(['message']));
  assert.deepEqual(projected.roots,['b']);
  assert.deepEqual([...projected.nodes.keys()],['b','c','d','e','g','h']);
  assert.deepEqual(projected.nodes.get('b').children,['c','h']);
  assert.deepEqual(projected.nodes.get('c').children,['d','e','g']);
  assert.equal(projected.nodes.get('b').context,true);
  assert.equal(projected.nodes.get('d').context,true);
  assert.equal(projected.nodes.get('g').context,false);
  assert.equal(projected.nodes.get('h').context,false);
  assert.deepEqual(graph.nodes.get('b').children,['c','h']);
  assert.equal(graph.nodes.get('b').context,undefined);
  assert.equal(filterGraph(graph,new Set()).nodes.size,0);
});

test('gaps beyond one context step stay hidden and receive a dashed skip edge', () => {
  const graph=toGraph({entries:[
    {id:'a',type:'message',parentId:null},{id:'b',type:'usage',parentId:'a'},
    {id:'x',type:'usage',parentId:'b'},{id:'y',type:'usage',parentId:'x'},
    {id:'z',type:'usage',parentId:'y'},{id:'c',type:'message',parentId:'z'}
  ]});
  const shown=filterGraph(graph,new Set(['message']));
  assert.deepEqual([...shown.nodes.keys()],['a','b','z','c']);
  assert.deepEqual(groveLayout(shown).edges.map(({from,to,skipped})=>[from,to,skipped]),[
    ['a','b',false],['b','z',true],['z','c',false]
  ]);
});

test('expanding one omitted edge restores only its ancestor path and can collapse back', () => {
  const graph=toGraph({entries:[
    {id:'a',type:'message',parentId:null},{id:'b',type:'usage',parentId:'a'},
    {id:'x',type:'usage',parentId:'b'},{id:'y',type:'usage',parentId:'x'},
    {id:'z',type:'usage',parentId:'y'},{id:'c',type:'message',parentId:'z'},
    {id:'side',type:'usage',parentId:'x'}
  ]});
  const types=new Set(['message']),key=gapKey('b','z');
  const collapsed=filterGraph(graph,types);
  assert.deepEqual([...collapsed.nodes.keys()],['a','b','z','c']);
  const expanded=filterGraph(graph,types,new Set([key]));
  assert.deepEqual([...expanded.nodes.keys()],['a','b','x','y','z','c']);
  assert.deepEqual(expanded.nodes.get('b').children,['x']);
  assert.equal(expanded.nodes.get('x').context,true);
  assert.equal(expanded.nodes.has('side'),false);
  assert.deepEqual(groveLayout(expanded).edges.filter(edge=>edge.collapseKey).map(edge=>[edge.from,edge.to,edge.collapseKey,edge.skipped]),[['b','x',key,false]]);
  assert.deepEqual(groveLayout(filterGraph(graph,types,new Set())).edges.map(edge=>[edge.from,edge.to,edge.skipped]),groveLayout(collapsed).edges.map(edge=>[edge.from,edge.to,edge.skipped]));
  assert.deepEqual(graph.nodes.get('x').children,['y','side']);
  assert.equal(graph.nodes.get('x').context,undefined);
  assert.equal(filterGraph(graph,null,new Set([key])),graph);
});

test('invalid gap keys do not reveal nodes and separate gaps expand independently', () => {
  const graph=toGraph({entries:[
    {id:'a',type:'message',parentId:null},{id:'b',type:'usage',parentId:'a'},
    {id:'x',type:'usage',parentId:'b'},{id:'y',type:'usage',parentId:'x'},
    {id:'z',type:'usage',parentId:'y'},{id:'c',type:'message',parentId:'z'},
    {id:'p',type:'message',parentId:null},{id:'q',type:'usage',parentId:'p'},
    {id:'r',type:'usage',parentId:'q'},{id:'s',type:'usage',parentId:'r'},
    {id:'t',type:'usage',parentId:'s'},{id:'u',type:'message',parentId:'t'}
  ]});
  const types=new Set(['message']),first=gapKey('b','z'),second=gapKey('q','t');
  const ignored=filterGraph(graph,types,new Set(['not-json',gapKey('a','b'),gapKey('z','b'),gapKey('b','c')]));
  assert.deepEqual([...ignored.nodes.keys()],['a','b','z','c','p','q','t','u']);
  const both=filterGraph(graph,types,new Set([first,second]));
  assert.equal(both.nodes.has('x'),true);assert.equal(both.nodes.has('r'),true);
  const onlySecond=filterGraph(graph,types,new Set([second]));
  assert.equal(onlySecond.nodes.has('x'),false);assert.equal(onlySecond.nodes.has('r'),true);
  assert.deepEqual(groveLayout(onlySecond).edges.filter(edge=>edge.collapseKey).map(edge=>edge.collapseKey),[second]);
});

test('one thousand-entry session remains laid out without recursion', () => {
  const entries=Array.from({length:1000},(_,i)=>({id:`n${i}`,type:'message',parentId:i?`n${i-1}`:null}));
  const graph=toGraph({entries,roots:['n0']});
  assert.equal(groveLayout(graph).positions.size,1000);
  assert.equal(atlasLayout(graph).positions.size,1000);
  assert.ok(new Set([...metroLayout(graph).positions.values()].map(p=>p.y)).size>100);
});
