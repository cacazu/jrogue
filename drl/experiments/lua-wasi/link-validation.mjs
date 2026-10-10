// Parse the retained LLD map and official-libc llvm-nm inventory without tool execution.
export function auditAllocatorMap(map,referenceText){
  const expected=['malloc','free','realloc','calloc','__libc_malloc','__libc_calloc','__libc_free'];
  const errors=[];
  const selected_libc_objects=[...new Set([...map.matchAll(/libc\.a\(([^)]+)\)/g)].map(match=>match[1]))].sort();
  const selected=new Set(selected_libc_objects),allReferences=[];
  for(const line of referenceText.split(/\r?\n/).filter(line=>line.trim())){
    const match=line.match(/libc\.a:([^:]+):\s+U\s+(\S+)$/);
    if(!match||!expected.includes(match[2]))errors.push('Unrecognized allocator inventory line: '+line);
    else allReferences.push({object:match[1],allocator:match[2]});
  }
  if(!allReferences.length)errors.push('Allocator reference inventory is empty');
  const selected_allocator_references=allReferences.filter(item=>selected.has(item.object));
  const independent_allocator_objects=selected_libc_objects.filter(name=>/dlmalloc|aligned_alloc|posix_memalign/.test(name));
  const definitions=[];let owner=null;
  for(const line of map.split(/\r?\n/)){
    if(line.includes(':('))owner=line.trim();
    const match=line.match(/\s([_A-Za-z][_A-Za-z0-9]*)$/);
    if(match&&expected.includes(match[1]))definitions.push({symbol:match[1],owner});
  }
  if(!selected_libc_objects.length)errors.push('No selected libc objects found in link map');
  if(independent_allocator_objects.length)errors.push('Independent libc allocator objects selected: '+independent_allocator_objects.join(', '));
  for(const symbol of expected){
    const found=definitions.filter(item=>item.symbol===symbol);
    if(found.length!==1||!/(?:^|[\\/])drl_c_allocator\.o:\(/.test(found[0].owner??''))errors.push('Shared allocator owner absent or ambiguous: '+symbol);
  }
  return {selected_libc_objects,selected_allocator_references,inventory_reference_count:allReferences.length,
    definitions,independent_allocator_objects,errors};
}
