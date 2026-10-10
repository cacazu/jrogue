"""Added 2026-10-02, NGPL: observe actual compiler/link boundaries and
verify the Emscripten WASM embedded file table without executing WASM/JS.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import re
import struct


def sha(data):return hashlib.sha256(data).hexdigest()
def command_hash(argv):return sha(json.dumps(argv,ensure_ascii=False,separators=(',',':')).encode('utf8'))


def read_leb(data,position,signed=False):
    value=0;shift=0
    for _ in range(10):
        if position>=len(data):raise ValueError('truncated WASM LEB')
        byte=data[position];position+=1;value|=(byte&127)<<shift;shift+=7
        if not byte&128:
            if signed and byte&64:value-=1<<shift
            return value,position
    raise ValueError('oversized WASM LEB')


def data_segments(wasm):
    if wasm[:8]!=b'\0asm\x01\0\0\0':raise ValueError('unexpected WASM header')
    position=8;segments=[]
    while position<len(wasm):
        section=wasm[position];position+=1;size,position=read_leb(wasm,position)
        end=position+size
        if end>len(wasm):raise ValueError('truncated WASM section')
        if section==11:
            count,position=read_leb(wasm,position)
            for _ in range(count):
                flags,position=read_leb(wasm,position)
                if flags==1:raise ValueError('passive data requires runtime proof')
                if flags==2:
                    memory,position=read_leb(wasm,position)
                    if memory:raise ValueError('unexpected memory index')
                elif flags!=0:raise ValueError('unexpected data flags')
                if wasm[position]!=0x41:raise ValueError('nonconstant data offset requires runtime proof')
                offset,position=read_leb(wasm,position+1,signed=True)
                if offset<0 or wasm[position]!=0x0b:raise ValueError('invalid data offset expression')
                length,position=read_leb(wasm,position+1)
                payload=wasm[position:position+length];position+=length
                if len(payload)!=length:raise ValueError('truncated data segment')
                segments.append((offset,payload))
            if position!=end:raise ValueError('unexpected data section suffix')
        position=end
    if not segments:raise ValueError('WASM has no active embedded data')
    return segments


def embedded_archive(js,wasm,archive):
    pattern=r'var __emscripten_fs_load_embedded_files=ptr=>\{do\{.*?\}while\(HEAPU32\[ptr>>2\]\)\};'
    loader=re.findall(pattern,js,re.S)
    if len(loader)!=1:raise ValueError('embedded JS loader changed')
    for required in ('var name_addr=HEAPU32[ptr>>2]','var len=HEAPU32[ptr>>2]','var content=HEAPU32[ptr>>2]',
                     'HEAP8.subarray(content,content+len)'):
        if required not in loader[0]:raise ValueError('embedded loader table ABI changed')
    segments=data_segments(wasm)
    def memory(address,length):
        matches=[payload[address-offset:address-offset+length] for offset,payload in segments
                 if offset<=address and address+length<=offset+len(payload)]
        if len(matches)!=1:raise ValueError('embedded memory region is ambiguous/missing')
        return matches[0]
    names=[]
    for offset,payload in segments:
        start=0
        while True:
            found=payload.find(b'/nhdat\0',start)
            if found<0:break
            names.append(offset+found);start=found+1
    candidates=[]
    for name_address in names:
        pointer=struct.pack('<I',name_address)
        for offset,payload in segments:
            start=0
            while True:
                found=payload.find(pointer,start)
                if found<0:break
                start=found+1
                address=offset+found
                if address%4 or found+12>len(payload):continue
                _,length,content=struct.unpack_from('<III',payload,found)
                if length!=len(archive):continue
                try:actual=memory(content,length)
                except ValueError:continue
                if actual==archive:
                    candidates.append({'name':'/nhdat','table_address':address,'name_address':name_address,
                        'content_address':content,'expected_bytes':len(archive),'actual_bytes':length,'actual_sha256':sha(actual)})
    if len(candidates)!=1:raise ValueError('unique actual WASM nhdat entry/payload was not proved')
    return {'datafile_entry':candidates[0],'emitted_js':{'sha256':sha(js.encode('utf8')),'loader_sha256':sha(loader[0].encode('utf8'))},
            'emitted_wasm':{'sha256':sha(wasm)},'runtime_fs_verified':False}


class Boundaries:
    def __init__(self,builder):
        self.builder=builder;self.units={};self.link=None;self.headers=None
        previous=builder.BUILD/'compile-boundary.json'
        if previous.is_file():
            old=json.loads(previous.read_text('utf8'))
            self.units={row['source']:row for row in old.get('units',[])}
        self.original_run=builder.run
    def header_snapshot(self):
        rows={path.relative_to(self.builder.SOURCE).as_posix():sha(path.read_bytes())
              for directory in ('include','sys','win','lib/lua-5.4.8/src')
              for path in sorted((self.builder.SOURCE/directory).rglob('*.h'))}
        return {'files':rows,'sha256':sha(json.dumps(rows,sort_keys=True,separators=(',',':')).encode('utf8'))}
    def begin(self):
        self.headers=self.header_snapshot();expected_flags=[str(value) for value in self.builder.target_flags()]
        object_root=(self.builder.WORK/'objects').resolve()
        by_object={row['object']:row for row in self.units.values()}
        if object_root.exists():
            for obj in object_root.glob('*.o'):
                if not obj.resolve().is_relative_to(object_root):raise ValueError('object cache path escapes Phase6')
                row=by_object.get(obj.relative_to(self.builder.WORK).as_posix())
                valid=bool(row and row.get('status')=='passed' and row.get('headers_sha256')==self.headers['sha256']
                           and row.get('target_flags')==expected_flags and row.get('command_sha256')==command_hash(row['argv'])
                           and (self.builder.SOURCE/row['source']).is_file()
                           and row.get('source_sha256')==sha((self.builder.SOURCE/row['source']).read_bytes())
                           and row.get('object_sha256')==sha(obj.read_bytes()))
                if not valid:obj.unlink() # only owned compiler output; failure logs are preserved
    def save(self):
        value={'units':[self.units[key] for key in sorted(self.units)],'link':self.link}
        (self.builder.BUILD/'compile-boundary.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf8',newline='\n')
    def run(self,command,**kwargs):
        argv=[str(value) for value in command];record=None
        if '-c' in argv and '-o' in argv:
            source=Path(argv[argv.index('-c')+1]).resolve();obj=Path(argv[argv.index('-o')+1]).resolve()
            if source.is_relative_to(self.builder.SOURCE.resolve()) and obj.is_relative_to((self.builder.WORK/'objects').resolve()):
                flags=argv[2:argv.index('-c')]
                record={'source':source.relative_to(self.builder.SOURCE).as_posix(),'object':obj.relative_to(self.builder.WORK).as_posix(),
                    'argv':argv,'command_sha256':command_hash(argv),'source_sha256':sha(source.read_bytes()),
                    'target_flags':flags,'headers_sha256':self.headers['sha256'],'status':'attempted'}
                self.units[record['source']]=record;self.save()
        if '--embed-file' in argv:
            argument=argv[argv.index('--embed-file')+1]
            data_root=Path(argument.rsplit('@',1)[0]);archive=data_root/'nhdat'
            self.link={'argv':argv,'command_sha256':command_hash(argv),'embed_argument':argument,
                       'archive_sha256_at_link':sha(archive.read_bytes()),'archive_bytes_at_link':archive.stat().st_size}
            self.save()
        output=self.original_run(command,**kwargs)
        if record:
            record['status']='passed';record['object_sha256']=sha(obj.read_bytes());self.save()
        return output
    def final(self,paths,data):
        if self.header_snapshot()!=self.headers:raise ValueError('headers changed during engine compilation')
        rows=[]
        for path in paths:
            name=path.relative_to(self.builder.SOURCE).as_posix();row=self.units.get(name)
            if not row or row['status']!='passed' or row['source_sha256']!=sha(path.read_bytes()):
                raise ValueError('actual compile command evidence missing/stale: '+name)
            obj=self.builder.WORK/row['object']
            if row['object_sha256']!=sha(obj.read_bytes()):raise ValueError('compiled object evidence changed: '+name)
            rows.append(row)
        flags=rows[0]['target_flags']
        if any(row['target_flags']!=flags for row in rows):raise ValueError('engine units used different target flags')
        if not self.link:raise ValueError('actual embed/link boundary was not captured')
        archive=data/'nhdat';content=archive.read_bytes()
        if self.link['archive_sha256_at_link']!=sha(content):raise ValueError('archive changed after link boundary')
        evidence=embedded_archive((self.builder.BUILD/'nethack.js').read_text('utf8'),(self.builder.BUILD/'nethack.wasm').read_bytes(),content)
        evidence.update({'archive':{'source_path':str(archive),'sha256':sha(content),'bytes':len(content)},'link':self.link,
            'generator_manifest_sha256':sha((self.builder.BUILD/'target-data-manifest.json').read_bytes())})
        generator=json.loads((self.builder.BUILD/'target-data-manifest.json').read_text('utf8'))
        if generator['target_flags']!=flags:raise ValueError('actual engine flags differ from observed macro utility target')
        macro=generator['macro_evidence']
        for name in ('include/config.h','include/config1.h'):
            if generator['working_headers_before'].get(name)!=self.headers['files'].get(name):raise ValueError('macro-defining header changed: '+name)
        result={'target_flags':flags,'target_macros':macro['values'],'target_macro_evidence':{**macro,
            'generator_manifest_sha256':evidence['generator_manifest_sha256'],'utility':generator['utility'],
            'shared_headers':{name:self.headers['files'][name] for name in ('include/config.h','include/config1.h')}},
            'compile_evidence':{'units':rows,'compile_jobs':1,'headers':self.headers},'embedded_data':evidence}
        (self.builder.BUILD/'compile-embed-evidence.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8',newline='\n')
        return result
