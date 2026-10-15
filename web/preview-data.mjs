const actions = [
  'Map the workspace and identify the entry point', 'Read the current API routes',
  'Trace how sessions are loaded', 'Check the existing unit tests',
  'Compare two ways to display the timeline', 'Run a focused browser check',
  'Inspect a tool result and continue', 'Locate the branch decision',
  'Explore a compact alternate layout', 'Return to the primary path',
  'Build the first layout model', 'Check spacing and contrast',
  'Inspect all children of this node', 'Measure the size of the tree',
  'Choose the next focused entry', 'Read the rendered record',
  'Review external annotations', 'Check the cache-usage event',
  'Switch intrinsic labels to ID', 'Validate the selected edge',
  'Compare the second branch', 'Keep the original source untouched',
  'Record the outcome', 'Mark a checkpoint',
  'Continue to the next user turn', 'Review the session branch',
  'Recheck the local viewer', 'Summarize the visible structure'
];
export function demoSession() {
  const entries = actions.map((text,i) => {
    const base={id:`trunk-${i+1}`,parentId:i?`trunk-${i}`:null,timestamp:new Date(Date.UTC(2026,8,14,10,i)).toISOString()};
    if(i===11)return {...base,type:'compaction',summary:'The previous steps are condensed; original entries remain visible.',firstKeptEntryId:'trunk-8'};
    if(i===17)return {...base,type:'usage',kind:'cache_warm',usage:{totalTokens:3200}};
    if(i===23)return {...base,type:'label',targetId:'trunk-8',label:'milestone'};
    const role=i%5===2?'toolResult':i%5===0?'user':'assistant';
    return {...base,type:'message',message:{role,content:role==='user'?text:[{type:'text',text}],...(role==='toolResult'?{toolName:'read',toolCallId:`call-${i}`,isError:false}:{})}};
  });
  entries.push(
    {type:'branch_summary',id:'alt-1',parentId:'trunk-8',summary:'Alternate path: favor a dense overview first.'},
    {type:'message',id:'alt-2',parentId:'alt-1',message:{role:'user',content:'What if this were a map instead of a transcript?'}},
    {type:'message',id:'alt-3',parentId:'alt-2',message:{role:'assistant',content:[{type:'text',text:'Keep the overview and magnify a selected neighborhood.'}]}},
    {type:'message',id:'side-1',parentId:'trunk-20',message:{role:'assistant',content:[{type:'text',text:'Try a transit-style lane for the second variation.'}]}},
    {type:'message',id:'side-2',parentId:'side-1',message:{role:'toolResult',content:[{type:'text',text:'Both paths remain available.'}],toolName:'bash',toolCallId:'demo',isError:false}},
    {type:'custom',id:'side-3',parentId:'side-2',customType:'demo-note',data:{status:'reviewed'}}
  );
  return {id:'demo',header:{type:'session',id:'synthetic-session',version:3,cwd:'Synthetic comparison data'},entries,roots:['trunk-1'],warnings:[]};
}
export function demoOverlay() {
  return {nodes:[{id:'trunk-8',label:'decision',highlight:true,source:'demo'},{id:'alt-2',label:'alternate',source:'demo'}],edges:[{from:'trunk-8',to:'alt-1',label:'explore',highlight:true,source:'demo'}]};
}
