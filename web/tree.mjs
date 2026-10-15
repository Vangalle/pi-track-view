const known = {message:'#69b7ff',usage:'#e1a456',custom:'#b08bfc',custom_message:'#b08bfc',compaction:'#e87992',branch_summary:'#e87992',context_edit:'#ee769e',label:'#8ed0a7',session_info:'#8ed0a7',model_change:'#78d4d0',thinking_level_change:'#78d4d0'};
export function nodeColor(type) {
  if (known[type]) return known[type];
  let hash = 0;
  for (const char of type) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 65% 70%)`;
}
export function nodeCaption(node, mode) {
  return mode === 'id' ? node.id : mode === 'type' ? node.type : '';
}
export function overlayFor(overlay, id, to) {
  const items = to === undefined ? overlay.nodes.filter(item => item.id === id) : overlay.edges.filter(item => item.from === id && item.to === to);
  return {labels:items.map(item => item.label).filter(Boolean),highlight:items.some(item => item.highlight === true)};
}
export function recordView(entry) {
  const blocks=[];
  if (entry.type === 'message') {
    const content=entry.message?.content;
    for (const block of typeof content === 'string' ? [{type:'text',text:content}] : Array.isArray(content) ? content : []) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'text') blocks.push({kind:'text',text:String(block.text ?? '')});
      else if (block.type === 'thinking') blocks.push({kind:'thinking',text:String(block.thinking ?? '[redacted]')});
      else if (block.type === 'toolCall') blocks.push({kind:`tool call · ${block.name ?? 'unknown'}`,text:JSON.stringify(block.arguments ?? {},null,2)});
      else if (block.type === 'image') blocks.push({kind:'image',text:`Image (${block.mimeType ?? 'unknown'})`});
      else blocks.push({kind:String(block.type ?? 'content'),text:JSON.stringify(block,null,2)});
    }
  } else if (entry.type === 'custom_message') {
    blocks.push({kind:'content',text:typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content ?? [],null,2)});
  }
  return {title:`${entry.type}${entry.message?.role ? ` · ${entry.message.role}` : ''}`,blocks,raw:JSON.stringify(entry,null,2)};
}
