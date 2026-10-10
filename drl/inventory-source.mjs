import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Read-only source analysis. No upstream script is imported or executed.
const root=path.resolve('upstream/drl');
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.name==='.git'?[]:e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const files=walk(root).sort();
const lineAt=(text,offset)=>text.slice(0,offset).split('\n').length;
function tokenize(text){
  const out=[];out.comments=[];let i=0;
  const longAt=p=>text.slice(p).match(/^\[(=*)\[/);
  while(i<text.length){
    if(/\s/.test(text[i])){i++;continue;}
    if(text.startsWith('--',i)){
      const start=i;
      const m=longAt(i+2);
      if(m){const end=text.indexOf(`]${m[1]}]`,i+2+m[0].length);i=end<0?text.length:end+m[1].length+2;}
      else{const end=text.indexOf('\n',i);i=end<0?text.length:end;}
      if(m)out.comments.push({v:text.slice(start,i),i:start,header_length:m[0].length+2,trailer_length:m[1].length+2});
      continue;
    }
    const start=i,m=longAt(i);
    if(m){const end=text.indexOf(`]${m[1]}]`,i+m[0].length);i=end<0?text.length:end+m[1].length+2;out.push({v:text.slice(start,i),i:start,kind:'string'});continue;}
    if(text[i]==='"'||text[i]==="'"){
      const q=text[i++];while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]===q)break;}
      out.push({v:text.slice(start,i),i:start,kind:'string'});continue;
    }
    const word=text.slice(i).match(/^[A-Za-z_][A-Za-z_0-9]*|^\d+(?:\.\d+)?/);
    if(word)i+=word[0].length;else i++;
    out.push({v:text.slice(start,i),i:start,kind:word?'word':'symbol'});
  }
  return out;
}
const str=t=>t.v[0]==='"'||t.v[0]==="'"?t.v.slice(1,-1).replace(/\\(["'\\])/g,'$1'):t.v;
function tableEnd(ts,start){let d=0;for(let k=start;k<ts.length;k++){if(ts[k].kind==='symbol'&&ts[k].v==='{')d++;if(ts[k].kind==='symbol'&&ts[k].v==='}'&&--d===0)return k;}throw Error('Unclosed table');}
function topFields(ts,start,end){
  const fields={};let braces=0,parens=0,brackets=0;const blocks=[];
  for(let k=start;k<=end;k++){
    const t=ts[k],v=t.v;
    if(t.kind==='symbol'){
      if(v==='{')braces++;if(v==='}')braces--;if(v==='(')parens++;if(v===')')parens--;if(v==='[')brackets++;if(v===']')brackets--;
    }
    if(braces===1&&parens===0&&brackets===0&&blocks.length===0&&t.kind==='word'&&ts[k+1]?.v==='='){
      const val=ts[k+2];fields[v]=val.kind==='string'?str(val):['-','+'].includes(val.v)&&/^\d/.test(ts[k+3]?.v??'')?val.v+ts[k+3].v:val.v;
      if(v==='weapon'&&val.v==='{')fields.embedded_weapon=topFields(ts,k+2,tableEnd(ts,k+2));
    }
    if(t.kind==='word'){
      if(['function','if','for','while','repeat'].includes(v))blocks.push({type:v,awaitDo:v==='for'||v==='while'});
      else if(v==='do'){const pending=blocks.findLast(b=>b.awaitDo);if(pending)pending.awaitDo=false;else blocks.push({type:'do'});}
      else if(v==='end'||v==='until')blocks.pop();
    }
  }
  return fields;
}
const declarations=[],anonymous=[],inactive=[],computed=[],storages=[],literalCounts=[];
for(const file of files.filter(p=>p.endsWith('.lua'))){
  const text=fs.readFileSync(file,'utf8'),ts=tokenize(text),fileRel=rel(file);
  const scope=fileRel.startsWith('bin/data/drl/')?'base_game':fileRel.startsWith('bin/data/core/')?'engine_core':fileRel.startsWith('bin/modules/classic.module/')?'bundled_classic':'tooling_or_metadata';
  literalCounts.push({file:fileRel,literals:ts.filter(t=>t.kind==='string').length});
  for(const comment of ts.comments){
    const body=comment.v.slice(comment.header_length,-comment.trailer_length),ct=tokenize(body);
    for(let ci=0;ci<ct.length;ci++){
      const match=ct[ci].v.match(/^register_([a-z_]+)$/);if(!match||ct[ci-1]?.v==='function')continue;
      let cj=ci+1;if(ct[cj]?.v==='(')cj++;
      if(ct[cj]?.kind!=='string')continue;
      const id=str(ct[cj++]);if(ct[cj]?.v===')')cj++;
      if(ct[cj]?.v!=='{')continue;
      const ce=tableEnd(ct,cj),fields=topFields(ct,cj,ce);
      inactive.push({category:match[1],id,name:fields.name??null,file:fileRel,line:lineAt(text,comment.i+comment.header_length+ct[ci].i),scope,reason:'inside Lua long comment; not registered by this source',fields,table_source:body.slice(ct[cj].i,ct[ce].i+1)});
    }
  }
  for(let i=0;i<ts.length;i++){
    const t=ts[i],m=t.v.match(/^register_([a-z_]+)$/);if(!m||ts[i-1]?.v==='function'||ts[i+1]?.v==='=')continue;
    const category=m[1];let j=i+1;if(ts[j]?.v==='(')j++;
    if(['storage','array_storage'].includes(category)&&ts[j]?.kind==='string'&&ts[j+1]?.v===','&&ts[j+2]?.kind==='string'){
      storages.push({storage:str(ts[j]),blueprint:str(ts[j+2]),array:category==='array_storage',file:fileRel,line:lineAt(text,t.i)});continue;
    }
    let id=null;if(ts[j]?.kind==='string'){id=str(ts[j]);j++;if(ts[j]?.v===')')j++;}
    if(ts[j]?.v!=='{'){
      if(ts[i-1]?.v!=='.')computed.push({category,id_fragment:id,expression:ts.slice(i,i+10).map(t=>t.v).join(' '),file:fileRel,line:lineAt(text,t.i),scope});
      continue;
    }
    const end=tableEnd(ts,j),fields=topFields(ts,j,end),entry={category,id,name:category==='blueprint'?null:fields.name??null,file:fileRel,line:lineAt(text,t.i),scope,fields,table_source:text.slice(ts[j].i,ts[end].i+1)};
    if(id===null){entry.array_index=anonymous.filter(e=>e.category===category&&e.scope===scope).length+1;anonymous.push(entry);}else declarations.push(entry);
  }
}
const categories=[...new Set([...declarations.map(e=>e.category),...anonymous.map(e=>e.category),...storages.map(e=>e.blueprint)])].sort().map(category=>{
  const entries=declarations.filter(e=>e.category===category);
  return {category,literal_declaration_count:entries.length,anonymous_declaration_count:anonymous.filter(e=>e.category===category).length,unique_literal_id_count:new Set(entries.map(e=>e.id)).size,counts_by_scope:Object.fromEntries([...new Set(entries.map(e=>e.scope))].map(s=>[s,entries.filter(e=>e.scope===s).length])),entries};
});
const generated=[];
for(const b of declarations.filter(e=>e.category==='being'&&e.scope==='base_game')){
  if(b.fields.weapon==='{')generated.push({category:'item',id:`nat_${b.id}`,name:b.fields.embedded_weapon?.name??'ranged attack',origin_being:b.id,embedded_fields:b.fields.embedded_weapon,generator:'bin/data/core/main.lua:register_being',file:b.file,line:b.line});
  if(b.fields.corpse==='true'||b.fields.corpse==='{'||/^\d+$/.test(b.fields.corpse??''))generated.push({category:'cell',id:`${b.id}corpse`,name:`${b.name} corpse`,origin_being:b.id,generator:'bin/data/core/main.lua:register_corpse',file:b.file,line:b.line});
}
const byExtension=[...new Set(files.map(p=>path.extname(p)))].sort().map(extension=>{
  const subset=files.filter(p=>path.extname(p)===extension);return {extension,files:subset.length,bytes:subset.reduce((s,p)=>s+fs.statSync(p).size,0),lines:['.pas','.lpr','.lua','.txt','.hlp','.asc','.md'].includes(extension)?subset.reduce((s,p)=>{const t=fs.readFileSync(p,'utf8');return s+(t.length?t.split('\n').length-(t.endsWith('\n')?1:0):0);},0):null};
});
const pascalUnits=files.filter(p=>rel(p).startsWith('src/')&&['.pas','.lpr'].includes(path.extname(p))).map(file=>{
  const text=fs.readFileSync(file,'utf8');return {file:rel(file),lines:text.split('\n').length-(text.endsWith('\n')?1:0),bytes:fs.statSync(file).size,methods:[...new Set([...text.matchAll(/^\s*(?:class\s+)?(?:function|procedure|constructor|destructor)\s+([A-Za-z_][A-Za-z_0-9]*\.[A-Za-z_][A-Za-z_0-9]*)/gmi)].map(m=>m[1]))]};
});
const hookText=fs.readFileSync(path.join(root,'src/drlhooks.pas'),'utf8');
const hooks=[...hookText.matchAll(/^\s*Hook_([A-Za-z_0-9]+)\s*=\s*(\d+);\s*(?:\/\/\s*([^\r\n]*))?/gm)].map(m=>({id:Number(m[2]),name:m[1],recipients:m[3]??'',file:'src/drlhooks.pas',line:lineAt(hookText,m.index)}));
const dataText=fs.readFileSync(path.join(root,'src/dfdata.pas'),'utf8');
const enums=Object.fromEntries([...dataText.matchAll(/^\s*(TItemType|TBodyTarget|TEqSlot|TDamageType|TResistance|TStatusEffect|TMoveResult|TCellHook)\s*=\s*\(([^)]+)\)/gm)].map(m=>[m[1],m[2].split(',').map(x=>x.trim())]));
const inputText=fs.readFileSync(path.join(root,'src/drlkeybindings.pas'),'utf8');
const inputs=[...inputText.matchAll(/\(ID:\s*'([^']*)';\s*Group:\s*'([^']*)';\s*Default:\s*([^;]+);\s*Name:\s*'((?:''|[^'])*)';\s*Description:\s*'((?:''|[^'])*)'\)/g)].map(m=>({id:m[1],group:m[2],default:m[3].trim(),name:m[4].replaceAll("''","'"),description:m[5].replaceAll("''","'"),file:'src/drlkeybindings.pas',line:lineAt(inputText,m.index)}));
const configText=fs.readFileSync(path.join(root,'src/drlconfiguration.pas'),'utf8');let group='';const settings=[];
for(const m of configText.matchAll(/iGroup\s*:=\s*AddGroup\(\s*'([^']+)'\s*\)|iGroup\.(AddInteger|AddToggle|AddString)\(\s*'([^']+)'\s*,\s*([^)]*)\)/g)){
  if(m[1])group=m[1];else settings.push({group,kind:m[2],id:m[3],default:m[4].trim(),file:'src/drlconfiguration.pas',line:lineAt(configText,m.index)});
}
assert.equal(hooks.length,73);assert.equal(new Set(hooks.map(h=>h.id)).size,73);
for(const c of categories){assert.ok(c.category);for(const e of c.entries)assert.equal(e.category,c.category);}
assert.equal(categories.find(c=>c.category==='klass').entries.find(e=>e.id==='marine').name,'Marine');
assert.equal(categories.find(c=>c.category==='challenge').entries.find(e=>e.id==='challenge_aob').name,'Angel of Berserk');
assert.equal(tokenize('--[[ register_level "excluded" { name="bad" } ]] register_level "kept" { name="good" }').filter(t=>t.v==='register_level').length,1);
assert.ok(anonymous.some(e=>e.category==='being_group'));
const result={schema_version:2,scope:'Static audit without executing upstream code. Literal, anonymous and generated definitions are separate; no port-completeness or translation-coverage claim.',upstream:{repository:'https://github.com/ChaosForge/doomrl',tag:'0_10_11a',commit:'a6f965072b3a25b768c91dbced00367f1b57d865',engine_version:'0.10.11',module_version:'0.10.11',save_version:'0.10.11'},statistics:{files:files.length,bytes:files.reduce((s,p)=>s+fs.statSync(p).size,0),by_extension:byExtension},registry_categories:categories,anonymous_registrations:anonymous,generated_being_definitions:generated,computed_registration_calls:computed,storage_definitions:storages,pascal_units:pascalUnits,hooks,engine_enums:enums,input_bindings:inputs,modern_settings:settings,lua_literal_counts:literalCounts,text_inventory:'port/catalog/text-inventory.json (separate authoritative raw-text audit)',remaining_static_limits:['Prototype fields are first-token values, not evaluated complete tables.','Computed calls and module-loading conditions require reference-runtime materialization.','Blueprint defaults and ID resolution are not a complete runtime registry dump.']};
result.inactive_comment_registrations=inactive;
fs.writeFileSync('feature-inventory.json',JSON.stringify(result,null,2)+'\n','utf8');
const appendix=['# Mechanically extracted DRL registries','','Static declaration counts are separated from runtime-generated content. See feature-inventory.md for the migration ledger.','','| Category | Base game | Core schemas | Classic module | Other |','| --- | ---: | ---: | ---: | ---: |',...categories.map(c=>`| ${c.category} | ${c.counts_by_scope.base_game??0} | ${c.counts_by_scope.engine_core??0} | ${c.counts_by_scope.bundled_classic??0} | ${c.counts_by_scope.tooling_or_metadata??0} |`),'','Anonymous definitions: '+anonymous.length+'. Generated natural attacks/corpses: '+generated.length+'.',''];
for(const c of categories)appendix.push(`## ${c.category}`,'','| ID / ordered type | Display name | Scope | Source |','| --- | --- | --- | --- |',...c.entries.map(e=>`| ${e.id} | ${(e.name??'—').replaceAll('|','\\|').replaceAll('\n',' ')} | ${e.scope} | ${e.file}:${e.line} |`),'');
appendix.push('## Anonymous and generated definitions','','| Category | ID / array index | Source |','| --- | --- | --- |',...anonymous.map(e=>`| ${e.category} | array ${e.array_index} (${e.scope}) | ${e.file}:${e.line} |`),...generated.map(e=>`| ${e.category} | ${e.id} | ${e.file}:${e.line} → ${e.generator} |`),'');
appendix.push('## Inactive declarations inside long comments','','These are source material, not live game registrations.','','| Category | ID | Display name | Source |','| --- | --- | --- | --- |',...inactive.map(e=>`| ${e.category} | ${e.id} | ${(e.name??'—').replaceAll('|','\\|')} | ${e.file}:${e.line} |`),'');
fs.writeFileSync('feature-registry-appendix.md',appendix.join('\n'),'utf8');
console.log(JSON.stringify({files:files.length,categories:categories.map(c=>({category:c.category,...c.counts_by_scope})),anonymous:anonymous.length,generated_counts:Object.fromEntries([...new Set(generated.map(e=>e.category))].map(c=>[c,generated.filter(e=>e.category===c).length])),hooks:hooks.length,input_records:inputs.length,nonempty_input_ids:inputs.filter(i=>i.id).length,explicit_modern_settings:settings.length,inactive:inactive.map(e=>({category:e.category,id:e.id,name:e.name,file:e.file,line:e.line}))},null,2));
