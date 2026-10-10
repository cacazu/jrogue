import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
const args=process.argv, option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const root=option('--source-root');if(!root)throw new Error('--source-root required');
const sections=new Map();let peak=process.memoryUsage().rss;
for await(const line of readline.createInterface({input:fs.createReadStream(new URL('../inventory-work/inventory-output/upstream-ja-catalogue.jsonl',import.meta.url),'utf8'),crlfDelay:Infinity})){
 const {file,section}=JSON.parse(line);if(section)sections.set(file+'\0'+section,{catalogue:file,section});
 peak=Math.max(peak,process.memoryUsage().rss);
}
const prefixCounts={},result={schema_version:1,unique_catalogue_sections:sections.size,mapped_existing:[],unresolved:[],sentinels:[],memory:{sampled_peak_rss_bytes:0}};
for(const item of sections.values()){
 const {catalogue,section}=item;prefixCounts[section.split('/').slice(0,2).join('/')]=(prefixCounts[section.split('/').slice(0,2).join('/')]??0)+1;
 if(section.startsWith('.')){result.sentinels.push(item);continue;}
 const addon=/game\/addons\/([^/]+)/.exec(catalogue),module=/game\/modules\/([^/]+)/.exec(catalogue);
 const candidates=[];
 if(section.startsWith('game/'))candidates.push(section);
 else if(addon&&section.startsWith(addon[1]+'/'))candidates.push('game/addons/'+section);
 else if(section.startsWith('engine/modules/boot/')){
  const suffix=section.slice('engine/modules/boot/'.length);
  candidates.push('game/modules/boot/'+(/^(data|mod)\//.test(suffix)?'':'mod/')+suffix);
 }else if(section.startsWith('engine/engine/')||section.startsWith('engine/data/'))candidates.push('game/engines/default/'+section.slice(7));
 else if(section.startsWith('mod-tome/')||section.startsWith('mod-boot/')){
  const name=section.startsWith('mod-tome/')?'tome':'boot',suffix=section.slice(9);
  candidates.push(`game/modules/${name}/`+(/^(data|mod)\//.test(suffix)?'':'mod/')+suffix);
 }else if(section.startsWith('engine/'))candidates.push('game/engines/default/'+section);
 else if(addon)candidates.push(`game/addons/${addon[1]}/${section}`);
 else if(module)candidates.push(`game/modules/${module[1]}/${section}`);
 else candidates.push('game/engines/default/'+section);
 const existing=candidates.filter(candidate=>fs.existsSync(path.join(root,candidate)));
 if(existing.length===1)result.mapped_existing.push({...item,physical_file:existing[0]});else result.unresolved.push({...item,candidates,existing});
}
result.memory.sampled_peak_rss_bytes=peak;result.prefix_counts=prefixCounts;
const output=option('--output');if(output)fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({unique_catalogue_sections:result.unique_catalogue_sections,mapped_existing:result.mapped_existing.length,unresolved:result.unresolved,sentinels:result.sentinels,prefix_counts:prefixCounts,memory:result.memory},null,2));
