"""Added 2026-10-02, NGPL: immutable artifact newline certificate.

No compiler, JS/WASM execution, candidate manifest or runtime mutation.
The existing recorder hashes Path.read_text UTF-8 universal-newline text;
this separate proof binds its recorded text to exact installed raw bytes.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]


def sha(data):return hashlib.sha256(data).hexdigest()
def read(path):return json.loads(Path(path).read_text('utf8'))
def record(path):
    data=path.read_bytes()
    return {'path':path.relative_to(ROOT).as_posix(),'sha256':sha(data),'bytes':len(data)}


def normalization(raw,recorded):
    raw.decode('utf8') # Invalid UTF-8 must never enter the proof.
    offsets=[index for index in range(len(raw)-1) if raw[index:index+2]==b'\r\n']
    if raw.count(b'\r')!=len(offsets):raise ValueError('bare CR is outside the certified narrow contract')
    normalized=raw.replace(b'\r\n',b'\n')
    if sha(normalized)!=recorded:raise ValueError('raw artifact does not reproduce captured text hash')
    return {'operation':'UTF-8 Path.read_text universal newline conversion',
            'crlf_offsets':offsets,'crlf_count':len(offsets),'bare_cr_count':0,
            'normalized_bytes':len(normalized),'normalized_sha256':sha(normalized),
            'recorded_sha256':recorded,'only_crlf_to_lf':True}


def validate_units(manifest,command_hash):
    units=manifest['compile_evidence']['units']
    names=[row['source'].replace('\\','/') for row in units]
    expected={row['path'].replace('\\','/'):row['sha256'] for row in manifest['compiled_input_hashes']}
    if len(names)!=len(set(names)) or set(names)!=set(expected):raise ValueError('actual compile membership duplicate/mismatch')
    for name,row in zip(names,units):
        if row['status']!='passed' or row['source_sha256']!=expected[name]:raise ValueError('actual compile status/source mismatch')
        if '-c' not in row['argv'] or row['command_sha256']!=command_hash(row['argv']):raise ValueError('actual compiler argv/hash mismatch')
    return {'units':len(units),'unique_sources':len(set(names)),'all_passed':True,
            'exact_compiled_input_membership':True,'command_hashes_validated':True}


def certify(stage):
    manifest_path=stage/'engine-manifest.json';evidence_path=stage/'compile-embed-evidence.json'
    manifest_bytes=manifest_path.read_bytes();evidence_bytes=evidence_path.read_bytes()
    manifest=json.loads(manifest_bytes);evidence=json.loads(evidence_bytes)
    if manifest['embedded_data']!=evidence['embedded_data']:raise ValueError('captured embedded evidence differs from manifest')
    if manifest['compile_evidence']!=evidence['compile_evidence']:raise ValueError('captured compile evidence differs from manifest')
    module_path=ROOT/'tools/semantic-text/phase6-integration/provenance.py'
    spec=importlib.util.spec_from_file_location('readonly_embed_certificate',module_path)
    provenance=importlib.util.module_from_spec(spec);spec.loader.exec_module(provenance)
    raw_path=stage/'nethack.js';installed_path=stage/'web/engine/nethack.js'
    raw=raw_path.read_bytes();installed=installed_path.read_bytes()
    if raw!=installed:raise ValueError('installed JS is not the original raw artifact')
    artifact=manifest['artifacts']['nethack.js']
    if sha(raw)!=artifact['sha256'] or len(raw)!=artifact['bytes']:raise ValueError('raw JS differs from immutable artifact manifest')
    normalized=normalization(raw,evidence['embedded_data']['emitted_js']['sha256'])
    if raw_path.read_text('utf8').encode('utf8')!=raw.replace(b'\r\n',b'\n'):
        raise ValueError('actual Python text reader differs from the exact transformation')
    wasm_path=stage/'nethack.wasm';wasm=wasm_path.read_bytes()
    if wasm!=(stage/'web/engine/nethack.wasm').read_bytes():raise ValueError('installed WASM differs')
    artifact=manifest['artifacts']['nethack.wasm']
    if sha(wasm)!=artifact['sha256'] or len(wasm)!=artifact['bytes']:raise ValueError('WASM artifact differs')
    archive=Path(evidence['embedded_data']['archive']['source_path']).read_bytes()
    exact=provenance.embedded_archive(raw.decode('utf8'),wasm,archive)
    captured=evidence['embedded_data']
    for name in ('datafile_entry','emitted_wasm'):
        if exact[name]!=captured[name]:raise ValueError('raw artifact no longer proves captured '+name)
    if exact['emitted_js']['loader_sha256']!=captured['emitted_js']['loader_sha256']:
        raise ValueError('loader bytes changed or contain normalized newlines')
    if exact['emitted_js']['sha256']!=manifest['artifacts']['nethack.js']['sha256']:
        raise ValueError('raw-byte parsing does not reproduce installed JS hash')
    if sha(archive)!=captured['archive']['sha256'] or len(archive)!=captured['archive']['bytes']:
        raise ValueError('archive bytes changed')
    generator=stage/'target-data-manifest.json'
    if sha(generator.read_bytes())!=captured['generator_manifest_sha256']:raise ValueError('generator manifest changed')
    units=validate_units(manifest,provenance.command_hash)
    result={'schema_version':1,'date':'2026-10-02','status':'passed',
        'kind':'raw-JS-to-recorded-universal-newline-text','compiler_executed':False,'runtime_executed':False,
        'candidate_manifest':record(manifest_path),'compile_embed_evidence':record(evidence_path),
        'certificate_source':record(Path(__file__).resolve()),'provenance_source':record(module_path),
        'raw_js':record(raw_path),'installed_js':record(installed_path),
        'wasm':record(wasm_path),'generator_manifest':record(generator),
        'normalization':normalized,'postprocessing_performed':False,
        'installed_identical_to_raw':True,'loader_unchanged':True,
        'raw_embedded_data':exact,'compile_membership':units,
        'manifest_preserved':True,'runtime_preserved':True,
        'note':'Recorded JS SHA is text-normalized; the immutable artifacts SHA is exact raw installed bytes. Both are certified without replacing either record.'}
    if manifest_path.read_bytes()!=manifest_bytes or evidence_path.read_bytes()!=evidence_bytes:
        raise ValueError('manifest/evidence changed during read-only certification')
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage',type=Path,default=ROOT/'build/phase6')
    parser.add_argument('--output',type=Path)
    args=parser.parse_args();stage=args.stage.resolve();output=(args.output or stage/'js-certificate-normalization-proof.json').resolve()
    if not stage.is_relative_to(ROOT/'build') or not output.is_relative_to(ROOT/'build'):
        parser.error('certificate stage/output must remain inside isolated build roots')
    result=certify(stage)
    if output.name in ('engine-manifest.json','compile-embed-evidence.json','nethack.js','nethack.wasm'):
        parser.error('immutable artifact/certificate overwrite is forbidden')
    output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8',newline='\n')
    print(json.dumps({'status':result['status'],'proof_sha256':sha(output.read_bytes()),
                      'raw_sha256':result['raw_js']['sha256'],
                      'recorded_text_sha256':result['normalization']['recorded_sha256'],
                      'actual_compile_units':result['compile_membership']['units']}))
if __name__=='__main__':main()
