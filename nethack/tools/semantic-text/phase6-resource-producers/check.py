"""Read-only source/offset/ownership checks. No native compiler or browser."""
import collections
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=HERE/'generated'
SOURCE=ROOT.parent/'official-source-audit/NetHack-5.0.0'
checks=collections.Counter()
errors=[]


def check(condition, context):
    checks['assertions']+=1
    if not condition:errors.append(context)


def load(path):return json.loads(path.read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def module(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);sys.modules[name]=mod;spec.loader.exec_module(mod);return mod


def main():
    manifest=load(OUT/'manifest.json')
    catalog=load(OUT/'catalog.source-reviewed.json')
    lib=module(ROOT/'locales/build-gameplay-catalog.py','resource_catalog_check')
    for name,digest in manifest['artifacts'].items():check(sha(OUT/name)==digest,name+' exact generated hash')
    for entry in manifest['author_inputs']:
        check(sha(ROOT/entry['input'])==entry['input_sha256'],entry['input']+' fixed input hash')
        check(sha(ROOT/entry['authored'])==entry['authored_sha256'],entry['authored']+' authored hash')
    for ident,en in catalog['en'].items():
        check(len(ident)<=160,ident+' bounded ID')
        union=set(catalog['argument_schemas'].get(ident,[]))
        check(lib.names(en).issubset(union),ident+' EN full original union')
        if ident in catalog['ja']:check(lib.names(catalog['ja'][ident]).issubset(union),ident+' JA original union')
        check('.tru.' not in ident and '.fal.' not in ident,ident+' no truth bucket in public ID')
        check('[cookie]' not in en,ident+' no private cookie control in public template')
    offsets=load(OUT/'offsets.private.json');cert=load(OUT/'certificates.json')
    data=Path(cert['generated_data_snapshot'])
    seen=set()
    for row in offsets['records']:
        key=(row['member'],row['start'],row['end'])
        check(key not in seen,str(key)+' unique native read interval');seen.add(key)
        raw=(data/row['member']).read_bytes()
        check(0<=row['start']<row['end']<=len(raw),str(key)+' bounded original read')
        check(raw[row['end']-1:row['end']]==b'\n',str(key)+' complete original line')
        check(row['id'] in catalog['en'],row['id']+' catalog original source identity')
    for row in offsets['groups']:
        native=[r for r in offsets['records'] if r['member']==row['member'] and r.get('group_start')==row['start']]
        check(len(native)==row['row_count']+1,row['id']+' complete paragraph plus native delimiter')
        check([r['ordinal'] for r in native]==list(range(row['row_count']+1)),row['id']+' original order')
        check(native[-1]['kind']=='group-delimiter',row['id']+' original terminator required')
        check(native[0]['start']==row['start'] and native[-1]['end']==row['end'],row['id']+' complete owner interval')
    for row in load(OUT/'source-observers.json')['entries']:
        original=(SOURCE/row['source']).read_text(encoding='utf-8')
        generated=(OUT/'source'/row['source']).read_text(encoding='utf-8')
        check(sha(SOURCE/row['source'])==row['source_sha256'],row['source']+' original source hash')
        for edit in reversed(row['edits']):
            check(generated.count(edit['replacement'])==1,row['source']+' exact observer unwrap position')
            generated=generated.replace(edit['replacement'],edit['needle'])
        check(generated==original,row['source']+' byte-exact original restored after all additive observers')
    bridge=(HERE/'nh_resource_origin.c').read_text(encoding='utf-8')
    for forbidden in ['rn2(', 'rnd(', 'getrumor(', 'get_rnd_line(', 'dlb_fgets(', 'dlb_ftell(', 'xcrypt(', 'strcmp(buf', 'strcmp(text', 'strcmp(line']:
        check(forbidden not in bridge,'bridge never replays native operation or text match '+forbidden)
    check('if (!original_line_complete)' in bridge,'partial native reads fail closed')
    check('last->kind == 3' in bridge and 'nh_group.rows == group->rows' in bridge,'oracle owner needs original complete delimiter and row count')
    check('nh_last_selected->control_pending || nh_last_control_removed' in bridge,'control-prefix descriptor requires original removal branch')
    check('nh_resource_disable_all();' in bridge and 'NH_RESOURCE_EXPECTED_ARCHIVE_SHA' in bridge,'uncertified archive disabled by default')
    for relative,digest in load(ROOT/'locales/phase4/reviewed-translations.metadata.json')['frozen_phase3_sha256'].items():
        check(sha(ROOT/relative)==digest,relative+' frozen phase3 unchanged')
    check(sha(ROOT/'locales/phase6/resource-authoring-batches.json')=='a860641aca07e53b78c055ad3e67085aa05ef0ed226a8e5ccee35593258b61a8','frozen resource queue unchanged')
    check(manifest['counts']['runtime_approved']==0 and not manifest['integration_applied'],'no compiled/runtime approval claim')
    report={'status':'source-evidence-verified' if not errors else 'failed','checks':dict(checks),'error_count':len(errors),'errors':errors,
            'runtime_approved':0,'native_or_browser_execution':False,
            'scope':'source/byte offsets/guard contracts only; no C compilation, loaded bundle verification, Japanese display fidelity or runtime lifetime proof'}
    if '--report' in sys.argv:(OUT/'verification.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode())
    print(json.dumps(report,ensure_ascii=False))
    raise SystemExit(bool(errors))


if __name__=='__main__':main()
