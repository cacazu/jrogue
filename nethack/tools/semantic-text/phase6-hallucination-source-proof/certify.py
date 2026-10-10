"""Added 2026-10-02, NGPL: readonly public-random name source certificate.

No generator, compiler, Node, browser or C execution. The locked candidate and
its historical failing acceptance report remain immutable.
"""
from __future__ import annotations
import hashlib,json,re,sys
from pathlib import Path
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
STAGE=ROOT/'build/phase6'
SOURCE=ROOT/'work/phase6/NetHack-5.0.0'
TOKENS=re.compile(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|[A-Za-z_]\w*|\d+|\S',re.S)


def sha(data):return hashlib.sha256(data if isinstance(data,bytes) else data.encode('utf8')).hexdigest()
def read(path):return json.loads(path.read_text('utf8'))
def record(path):return {'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size}
def function(text,name):
    match=re.search(r'\b'+re.escape(name)+r'\s*\([^;{}]*\)\s*\{',text,re.S)
    if not match:raise ValueError('source function missing: '+name)
    depth=0
    for token in TOKENS.finditer(text,match.end()-1):
        if token.group()=='{':depth+=1
        elif token.group()=='}':
            depth-=1
            if not depth:return text[match.start():token.end()]
    raise ValueError('source function unterminated: '+name)
def require(text,fragment):
    if text.count(fragment)!=1:raise ValueError('exact source contract absent/ambiguous: '+fragment[:100])
def restore_random(actual):
    edits=[('    const char *nh_random_name = NULL;\n',''),
           ('    nh_text_name_invalidate_range(buf, sizeof buf);\n',''),
           ('(nh_random_name = pmname(&mons[name], rn2_on_display_rng(2)))','pmname(&mons[name], rn2_on_display_rng(2))'),
           ('        nh_text_monster_selected_random(mnam, &mons[name], nh_random_name);\n','')]
    for original,replacement in edits:
        require(actual,original);actual=actual.replace(original,replacement,1)
    return actual

def ordered_rng_calls(text):
    ts=[m.group() for m in TOKENS.finditer(text) if not m.group().startswith(('/*','//'))]
    calls=[]
    for i,name in enumerate(ts[:-1]):
        if not (name.startswith('rn2') or name.startswith('rnd') or name.startswith('random')) or ts[i+1]!='(':continue
        if name=='rndmonnam':continue # source definition, not a call
        depth=1;args=[];j=i+2
        while j<len(ts) and depth:
            if ts[j]=='(':depth+=1
            elif ts[j]==')':depth-=1
            if depth:args.append(ts[j])
            j+=1
        if depth:raise ValueError('RNG call unterminated')
        calls.append({'name':name,'argument_tokens':args})
    return calls

def wire_contract(envelope,catalog):
    if set(envelope)!= {'event','context'} or envelope['context']!={'api':'pline','helperVariant':'plain'}:
        raise ValueError('observed context changed')
    root=envelope['event']
    if root['id']!='nethack.message.lock.pick_lock.pline.i_don_t_think_s_would_appreciate.96869543af' or set(root['args'])!={'arg_1'}:
        raise ValueError('original public argument union changed')
    leaves=[];ids=[]
    def event(value):
        if set(value)!= {'id','args'}:raise ValueError('wire event exports unknown fields')
        identifier=value['id'];args=value['args'];ids.append(identifier)
        if identifier=='nethack.name.empty':
            if args:raise ValueError('empty event union changed')
            return
        if identifier=='nethack.name.monster.phase6.composite':
            if set(args)!= {'original','ownership','adjective','invisible','saddled','body'}:
                raise ValueError('monster composite exported unknown/private fields')
            if args['original']['type']!='text':raise ValueError('original public text missing')
            for name in ('ownership','invisible','saddled'):
                if args[name]!={'type':'text_id','value':'nethack.name.empty'}:raise ValueError('unobserved qualifier in captured case')
            for name in ('adjective','body'):
                if args[name]['type']!='event':raise ValueError('owned nested producer missing')
                event(args[name]['value'])
            return
        if identifier=='nethack.name.monster.phase6.label':
            if set(args)!= {'original','name'} or args['original']['type']!='text' or args['name']['type']!='text_id':
                raise ValueError('public random label union changed')
            leaf=args['name']['value'];original=args['original']['value']
            if catalog['en'].get(leaf)!=original:raise ValueError('selected public literal does not equal source label')
            leaves.append({'id':leaf,'original':original});ids.append(leaf)
            return
        raise ValueError('unsupported nested/private descriptor: '+identifier)
    argument=root['args']['arg_1']
    if argument['type']!='event':raise ValueError('captured public name lacks owning event')
    event(argument['value'])
    if len(leaves)!=1:raise ValueError('selected public label is ambiguous')
    return {'public_original':argument['value']['args']['original']['value'],
            'selected_leaf':leaves[0],'wire_ids':ids,
            'no_pointer_index_monster_state_fields':True,'exact_public_union':True}


def certify():
    manifest_path=STAGE/'engine-manifest.json';manifest=read(manifest_path)
    lock_path=ROOT/'tools/semantic-text/phase6-integration/inputs.lock.json';lock=read(lock_path)
    if sha(lock_path.read_bytes())!=manifest['isolated_phase6']['input_lock_sha256']:raise ValueError('frozen lock changed')
    report_path=STAGE/'acceptance-r2/native-name-verification.json';report=read(report_path)
    paths=['src/do_name.c','src/nh-semantic-name.c']
    compiled={row['source']:row for row in manifest['compile_evidence']['units']}
    inputs={row['path']:row['sha256'] for row in manifest['compiled_input_hashes']}
    actual=[]
    for name in paths:
        row=compiled[name];path=SOURCE/name
        if row['status']!='passed' or sha(path.read_bytes())!=row['source_sha256'] or inputs[name]!=row['source_sha256']:
            raise ValueError('compiled source provenance mismatch: '+name)
        command=sha(json.dumps(row['argv'],ensure_ascii=False,separators=(',',':')))
        if '-c' not in row['argv'] or command!=row['command_sha256']:raise ValueError('actual compiler argv mismatch')
        actual.append({'source':record(path),'actual_argv':row['argv'],'command_sha256':row['command_sha256'],'status':row['status']})
    headers={row['path']:row['sha256'] for row in manifest['compiled_header_hashes']}
    header_records=[]
    for name in ('nh-semantic-monster-composite.h','nh-semantic-monster-labels.h','nh-semantic-name.h','nh-semantic-name-grammar.h','config.h'):
        path=SOURCE/'include'/name
        if sha(path.read_bytes())!=headers['include/'+name]:raise ValueError('compiled header changed')
        header_records.append(record(path))
    upstream=ROOT/'upstream/NetHack-5.0.0/src/do_name.c';source=(SOURCE/'src/do_name.c').read_text('utf8')
    bridge=(SOURCE/'src/nh-semantic-name.c').read_text('utf8')
    original=function(upstream.read_text('utf8'),'rndmonnam');random=function(source,'rndmonnam')
    if restore_random(random)!=original:raise ValueError('original rndmonnam bytes were not preserved')
    rng=ordered_rng_calls(original)
    if rng!=ordered_rng_calls(random) or len(rng)!=2:raise ValueError('ordered original RNG call contract changed')
    if random.index('nh_text_name_invalidate_range(buf, sizeof buf);')>=random.index('rn2_on_display_rng('):raise ValueError('static buffer invalidation is late')
    require(random,'mnam = strcpy(buf, (nh_random_name = pmname(&mons[name], rn2_on_display_rng(2))));\n        nh_text_monster_selected_random(mnam, &mons[name], nh_random_name);')
    require(random,'if (name >= SPECIAL_PM) {\n        mnam = bogusmon(buf, code);\n    } else {')
    hallu='if (do_hallu) {\n        char rnamecode;\n        char *rname = rndmonnam(&rnamecode);\n\n        Strcat(buf, rname);\n        nh_text_monster_nested(&nh_monster, buf, rname);\n        name_at_start = bogon_is_pname(rnamecode);'
    require(source,hallu)
    observer=function(bridge,'nh_text_monster_selected_random')
    for forbidden in ('mtmp','mdat','rn2','pmname','monsndx','canspotmon','Hallucination'):
        if re.search(r'\b'+forbidden+r'\b',observer):raise ValueError('random observer performs extra native query')
    require(observer,'nh_text_monster_label(&owner, result, selected, selected_name);')
    label=function(bridge,'nh_monster_label')
    for fragment in ('selected != &mons[index]','selected->pmnames[gender] != public_name','if (result && strcmp(result, candidate)) return NULL;'):require(label,fragment)
    nested=function(bridge,'nh_text_monster_nested');require(nested,'nh_text_name_grammar_capture(&selected, selected_public_result);')
    if nested.index('owner->body_valid = 0;')>nested.index('nh_text_name_grammar_capture'):raise ValueError('nested failure does not clear owner')
    finish=function(bridge,'nh_text_monster_finish');require(finish,'if (!owner || !owner->prefix_valid || !owner->body_valid) return;')
    capture=function(bridge,'nh_text_name_grammar_capture')
    proposal=ROOT/'tools/semantic-text/phase6-monster-producers'
    audit=read(proposal/'generated/source-audit.json');verification=read(proposal/'generated/source-verification.json')
    functions=audit['native_token_preservation']
    if len(functions)!=8 or verification['passed']!=24 or verification['failed'] or verification['errors'] or verification['compiled']:
        raise ValueError('frozen source-only checks do not match declared history')
    catalog=read(STAGE/'web/gameplay-core.json')
    rows=[row for row in report['captures'] if row.get('envelope',{}).get('event',{}).get('id','').endswith('.96869543af')]
    observed=rows[-1];wire=wire_contract(observed['envelope'],catalog)
    if 'I don\'t think %s would appreciate that.' % wire['public_original']!=observed['sourceText']:
        raise ValueError('original public name does not reconstruct the observed native message')
    prior=wire_contract(rows[0]['envelope'],catalog)
    if wire['selected_leaf']['id']==prior['selected_leaf']['id']:
        raise ValueError('this specific evidence does not distinguish random name from prior publicly named creature')
    if prior['selected_leaf']['id'] in wire['wire_ids']:raise ValueError('prior public creature label entered hallucinated wire')
    return {'schema_version':1,'date':'2026-10-02','status':'source-contract-passed',
            'compiler_executed':False,'generator_executed':False,'node_executed':False,'browser_executed':False,
            'runtime_acceptance_passed':False,'candidate_manifest':record(manifest_path),'locked_inputs':record(lock_path),
            'historical_failed_runtime_report':record(report_path),'original_source':record(upstream),
            'actual_compiled_inputs':actual,'actual_compiled_headers':header_records,
            'certificate_source':record(Path(__file__).resolve()),
            'frozen_proposal':{'audit':record(proposal/'generated/source-audit.json'),'verification':record(proposal/'generated/source-verification.json'),
                'eight_function_proofs':functions,'historical_passing_source_checks':24,'generated_C_executed_by_those_checks':False,
                'helper_source':record(proposal/'bridge-extension.c.in'),'helper_header':record(proposal/'bridge-extension.h.in')},
            'random_source_contract':{'pristine_function_restored_bytes_exact':True,'original_function_sha256':sha(original),
                'actual_function_sha256':sha(random),'ordered_original_RNG_call_sites':rng,
                'original_rejection_loop_preserved':True,'original_pmname_call_preserved_once_per_native_branch':True,
                'selected_pointer':'&mons[name] from original display RNG local name; original selected pmname return cached once',
                'target_pointer_not_used_by_random_observer':True,'pointer_identity_and_ambiguous_gender_rejection':True,
                'static_output_invalidated_before_original_RNG':True,'bogus_branch_has_no_binding':True,
                'nested_missing_owner_and_final_invalid_body_fail_closed':True},
            'observed_native_message':{'source_text':observed['sourceText'],'callback':observed['callback'],'window':observed['window'],
                **wire,'prior_public_creature_leaf':prior['selected_leaf'],'prior_label_absent_from_observed_wire':True},
            'conclusion':'The observed baby gray dragon ID describes the original public random name, not the target real species. The blanket null-envelope expectation conflicts with the frozen real-random producer contract.',
            'recommended_acceptance':'Verify certified real-random events with exact English replay and immutable repaint; separately require whole English/null when the original selected bogus/resource name has no producer event.',
            'unverified':['fresh real-random/bogus runtime acceptance','all hallucination source branches and long campaigns','new C memory/ABI execution'],
            'immutable_candidate_changed':False}


def main():
    output=STAGE/'hallucination-source-proof.json';result=certify()
    regressions=read(HERE/'test-results.json')
    if regressions['run']!=3 or regressions['failures'] or regressions['errors']:
        raise ValueError('source mutation regressions did not pass')
    result['source_regressions']={'source':record(HERE/'test_certificate.py'),'results':record(HERE/'test-results.json'),**regressions}
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
    print(json.dumps({'status':result['status'],'sha256':sha(output.read_bytes()),'functions':8,'historical_source_checks':24}))
if __name__=='__main__':main()
