import test from 'node:test';
import assert from 'node:assert/strict';
import {collectCharacterExport,MAX_CHARACTER_EXPORT_BYTES} from '../web/character-export.js';
import {parsePresentationModel,renderPresentationModel} from '../web/semantic-view.js';
const paragraph=(key,text,extras={})=>({kind:'paragraph',key,text,selected:false,color:null,activation_key:null,...extras});
function exportModel(lines=['山田 {hero} <img>','火炎耐性 +'],locale='ja') {
 const rows=lines.map((text,index)=>paragraph(`export.row.${index}.label`,text));
 const widgets=rows.map(row=>({event:{id:'test.row',context:'character-export',widget:row.key},text:row.text}));
 widgets.push({event:{id:'',context:'character-export',widget:'__export_ready',params:{expected_rows:{type:'integer',value:rows.length}}},text:null});
 return {schema_version:1,locale,sections:[{key:'character-export',heading:'人物情報',blocks:rows}],semantic:{scopes:[{context:'character-export',widgets}],messages:[]}};
}
test('completed character export copies Rust Unicode text and opaque names literally',()=>{
 const model=exportModel(); const before=JSON.stringify(model);const result=collectCharacterExport(model);
 assert.equal(result.text,'山田 {hero} <img>\n火炎耐性 +\n');assert.equal(result.filename,'angband-character-ja.txt');assert.ok(Object.isFrozen(result));assert.equal(JSON.stringify(model),before);
 assert.equal(collectCharacterExport(exportModel(['English Ω'],'en')).text,'English Ω\n');
});
test('incomplete or gapped character captures cannot become downloads',()=>{
 const missing=exportModel();missing.semantic.scopes[0].widgets.pop();assert.throws(()=>collectCharacterExport(missing),/capture_rejected/);
 const tail=exportModel();tail.sections[0].blocks.pop();tail.semantic.scopes[0].widgets.splice(1,1);assert.throws(()=>collectCharacterExport(tail));
 const unavailable=exportModel();unavailable.semantic.scopes[0].widgets[0].text=null;assert.throws(()=>collectCharacterExport(unavailable));
 for(const key of ['export.row.2.label','wrong.row.0.label','export.row.16384.label']){const m=exportModel(['a']);m.sections[0].blocks[0].key=key;assert.throws(()=>collectCharacterExport(m));}
 const nul=exportModel(['bad\0text']);assert.throws(()=>collectCharacterExport(nul));
 const limit=exportModel(['x'.repeat(MAX_CHARACTER_EXPORT_BYTES)]);assert.throws(()=>collectCharacterExport(limit));
});
test('owned recall segments keep original source row order within an export',()=>{
 const m=exportModel(['最新','前']);m.sections[0].blocks.splice(1,0,paragraph('export.row.0.label.part.1','（2回繰り返し）'));
 assert.equal(collectCharacterExport(m).text,'最新\n（2回繰り返し）\n前\n');
 const reverse=exportModel(['a','b']);reverse.sections[0].blocks.reverse();assert.throws(()=>collectCharacterExport(reverse));
});
class Element{children=[];style={};attributes={};listeners={};textContent='';constructor(tag=''){this.tag=tag;}append(child){this.children.push(child);}replaceChildren(...children){this.children=children;}setAttribute(name,value){this.attributes[name]=value;}addEventListener(name,cb){this.listeners[name]=cb;}}
const doc={createElement:tag=>new Element(tag)};
function model(blocks){return{schema_version:1,locale:'ja',state_summary:'',sections:[{key:'character-matrix',heading:'耐性',blocks}],messages:[],message_ids:[],missing_ids:[],semantic:{scopes:[],messages:[]}};}
test('CJK matrix renders captured cells and colors inside a keyboard-scrollable container',()=>{
 const table={kind:'table',key:'matrix',class_name:'semantic-matrix',headers:['属性','a','@'],rows:[['火炎','+ 耐性','? 未知'],['冷気','','. なし']],colors:[[null,9,4],[null,null,1]]};
 const captured=parsePresentationModel(model([table])),container=new Element();renderPresentationModel(container,captured,null,doc);
 const scroll=container.children[0].children[1];assert.equal(scroll.tabIndex,0);const rendered=scroll.children[0];assert.equal(rendered.children[1].children[2].textContent,'? 未知');assert.equal(rendered.children[2].children[1].textContent,'');assert.ok(rendered.children[1].children[1].style.color);
 const bad=structuredClone(table);bad.colors[0][1]=99;assert.throws(()=>parsePresentationModel(model([bad])));
 const shape=structuredClone(table);shape.colors.pop();assert.throws(()=>parsePresentationModel(model([shape])));
});