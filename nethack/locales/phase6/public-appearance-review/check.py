"""Read-only public identity/schema/source checks; no runtime activation."""
from pathlib import Path
import collections
import hashlib
import json
import re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SOURCE=ROOT.parent/'official-source-audit/NetHack-5.0.0'
errors=[];count=0


def check(value, context):
    global count
    count+=1
    if not value:errors.append(context)


def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(path):return json.loads(path.read_text(encoding='utf-8'))


def main():
    ledger_path=ROOT/'work/phase6/semantic-generated/public-appearance-audit.json'
    raw=ledger_path.read_bytes();ledger=json.loads(raw)
    authored_path=HERE/'public-appearance-phrases.authored.json';authored=load(authored_path)
    check(sha(raw)==authored['input_ledger_sha256'],'fixed composer ledger hash')
    originals=[];expected=[]
    frozen=load(ROOT/'work/phase4/semantic-generated/catalog.json')
    for row in ledger['source_mapping']:
        phrase=row['public_phrase'];alias=row['public_alias']
        slug=re.sub(r'[^a-z0-9]+','_',phrase.lower()).strip('_')[:72] or 'empty'
        check(alias=='nethack.public.appearance.'+slug+'.'+sha(phrase.encode())[:10],alias+' public EN bytes alone determine identity')
        check(row['public_only_identity'] is True,alias+' declared public-only')
        for old in row['private_source_ids']:
            check(frozen['en'][old]==phrase,old+' exact original selected public phrase')
            originals.append(old);expected.append(alias)
    private_table=ROOT/'work/phase6/NetHack-5.0.0/include/nh-semantic-object-labels.h'
    if private_table.exists():
        emitted=re.findall(r'\[NH_NAME_OBJECT_APPEARANCE\] = "([a-z0-9._]+)"',private_table.read_text(encoding='utf-8'))
        check(collections.Counter(emitted)==collections.Counter(expected),'all326 slots EN-first public aliases, including missing-JA entries')
        check(not any(i.startswith('nethack.entity.object.') for i in emitted),'no old hidden true-type identity in selected appearance slots')
    check(len(originals)==326 and len(set(expected))==257,'326source slots/257public phrases exact denominator')
    for entry in authored['entries']:
        ident=entry['id'];phrase=entry['public_english_phrase']
        check(authored['catalog_overlay']['en'][ident]==phrase,ident+' exact original public EN')
        japanese=authored['catalog_overlay']['ja'][ident]
        check(japanese==entry['whole_message_ja'],ident+' authored Japanese consistent')
        check(not any(noun in japanese for noun in ['指輪','杖','魔法書','宝石','薬','石']),ident+' no added hidden/class noun in bare property')
        check(entry['argument_schemas']==[] and entry['runtime_binding_approved'] is False,ident+' empty typed union/runtime false')
        for evidence in entry['private_source_evidence']:
            p=SOURCE/evidence['source'];source=p.read_bytes()
            check(sha(source)==evidence['source_sha256'],ident+' pristine official source hash')
            check(source.decode().splitlines()[evidence['official_line']-1]==evidence['exact_original_line'],ident+' exact original source line')
            check(json.dumps(phrase) in evidence['exact_original_line'],ident+' literal occurs at original source slot')
    check(authored['counts']=={'reviewed_public_phrases':21,'original_appearance_slots':65,'runtime_approved':0},'exact authored denominator')
    for relative,digest in load(ROOT/'locales/phase4/reviewed-translations.metadata.json')['frozen_phase3_sha256'].items():
        check(sha((ROOT/relative).read_bytes())==digest,relative+' frozen canonical hash')
    report={'status':'source-public-identity-verified' if not errors else 'failed','assertions':count,'error_count':len(errors),'errors':errors,
            'authored_sha256':sha(authored_path.read_bytes()),'runtime_approved':0,
            'composition_review_required':'Bare public attributes require original captured public-class noun/connector recipes; no whole-name or runtime Japanese approval.'}
    (HERE/'verification.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode())
    print(json.dumps(report,ensure_ascii=False))
    raise SystemExit(bool(errors))


if __name__=='__main__':main()
