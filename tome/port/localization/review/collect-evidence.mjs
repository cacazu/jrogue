// GPL-3.0-or-later. Static evidence gathering only; no build or runtime execution.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
const project=path.dirname(import.meta.dirname);
const roots=JSON.parse(fs.readFileSync(path.join(project,'inventory-work/inventory-output/summary.json'),'utf8')).sourceRoots;
const needles=['Stamina','ghoul','ghast','ghoulking','tinker','Imperium','Paradox','Cosmic Cycle','Pity','Ego','Korbek','Gumlarat','Animated Blade','dream','day','days','hour','hours','minute','minutes','second','seconds'];
const registrations=[];
for await(const line of readline.createInterface({input:fs.createReadStream(path.join(project,'inventory-work/inventory-output/upstream-ja-catalogue.jsonl'),'utf8'),crlfDelay:Infinity})){
 const row=JSON.parse(line); const source=row.source??row.src??row.english??'';
 if(needles.some(needle=>source.toLowerCase()===needle.toLowerCase()) || source.startsWith('%s the level %d %s %s was ') || source.startsWith('%s(%d %s %s) was ') || source.startsWith('Sustain %s cost:'))registrations.push(row);
}
const occurrences=[];
const files=[];
const scanRoot=roots.find(root=>fs.existsSync(path.join(root,'game/modules/tome/mod/class/Actor.lua')));
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
 const absolute=path.join(directory,entry.name);
 if(entry.isDirectory()){if(entry.name!=='locales')walk(absolute);}
 else if(entry.name.endsWith('.lua'))files.push(path.relative(scanRoot,absolute).replaceAll('\\','/'));
}}
walk(path.join(scanRoot,'game/modules/tome'));
for(const file of files){
 const root=roots.find(root=>fs.existsSync(path.join(root,file))); if(!root)continue;
 const lines=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/);
 for(let i=0;i<lines.length;i++)if(/killer_message|name = "WEAK_GODMODE"|name = "INVIGORATED"|self\.pity|target\.pity/.test(lines[i])){
  const start=Math.max(0,i-4),end=Math.min(lines.length,i+5);
  occurrences.push({file,line:i+1,excerpt:lines.slice(start,end).map((value,index)=>`${start+index+1}: ${value}`).join('\n')});
 }
}
const report={schema_version:1,official_registrations:registrations,source_occurrences:occurrences,memory:process.memoryUsage()};
fs.writeFileSync(path.join(import.meta.dirname,'composition-evidence.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({registrations:registrations.length,occurrences:occurrences.length,memory:report.memory}));
for(const row of registrations)if(row.english.startsWith('%s the level')||row.english.startsWith('%s(%d'))console.log(JSON.stringify({english:row.english,japanese:row.translated,file:row.file,line:row.line}).replace(/[^\x00-\x7f]/g,character=>'\\u'+character.charCodeAt(0).toString(16).padStart(4,'0')));
