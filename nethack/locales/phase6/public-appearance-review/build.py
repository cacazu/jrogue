"""Author only public phrase equivalents; no private object identity in IDs.

This overlay is deliberately separate from frozen source catalogs/composition.
Parent integration must select original public-class grammar from already
captured original naming branches, rather than append hidden true-type nouns.
"""
from pathlib import Path
import hashlib
import json
import re

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SOURCE=ROOT.parent/'official-source-audit/NetHack-5.0.0'
PHRASES={
    'black':'黒色','brass':'真鍮','bronze':'青銅','copper':'銅',
    'cyan':'シアン色','dark green':'濃緑色','emerald':'エメラルド',
    'gold':'金','gray':'灰色','hexagonal':'六角形','iron':'鉄',
    'magenta':'マゼンタ色','orange':'橙色','pink':'ピンク色','red':'赤色',
    'ruby':'ルビー','silver':'銀','steel':'鋼鉄','violet':'スミレ色',
    'white':'白色','yellow':'黄色',
}


def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(path):return json.loads(path.read_text(encoding='utf-8'))


def main():
    ledger_path=ROOT/'work/phase6/semantic-generated/public-appearance-audit.json'
    raw=ledger_path.read_bytes();ledger=json.loads(raw)
    frozen_path=ROOT/'locales/gameplay-core.metadata.json'
    frozen=load(frozen_path);metadata={e['id']:e for e in frozen['entries']}
    rows=[r for r in ledger['source_mapping'] if r.get('reason')]
    assert {r['public_phrase'] for r in rows}==set(PHRASES)
    en={};ja={};entries=[];source_slots=0
    for row in rows:
        phrase=row['public_phrase'];ident=row['public_alias']
        suffix=sha(phrase.encode())[:10]
        slug=re.sub(r'[^a-z0-9]+','_',phrase.lower()).strip('_')
        assert ident=='nethack.public.appearance.'+slug+'.'+suffix
        en[ident]=phrase;ja[ident]=PHRASES[phrase]
        evidence=[]
        for old in row['private_source_ids']:
            e=metadata[old]
            assert e['source_field']=='appearance' and e['en']==phrase
            path=SOURCE/e['source'];s=path.read_text(encoding='utf-8')
            original_line=s.splitlines()[e['official_line']-1]
            assert json.dumps(phrase) in original_line,(old,original_line)
            evidence.append({'private_source_id':old,'source':e['source'],
                'official_line':e['official_line'],'source_sha256':sha(path.read_bytes()),
                'exact_original_line':original_line,'original_public_english_literal':phrase,
                'existing_japanese':e['ja'],'existing_japanese_origin':e['origin'],
                'source_enum_kept_private':e['source_enum']})
        source_slots+=len(evidence)
        entries.append({'id':ident,'public_english_phrase':phrase,'whole_message_ja':PHRASES[phrase],
            'argument_schemas':[],'source_review_status':'faithful-public-phrase-equivalent',
            'source_translation_approved':True,'runtime_binding_approved':False,
            'private_source_evidence':evidence,
            'semantic_guard':'Translation names only the already visible English color/material/shape; no class noun, hidden effect, value, true type or selection query is introduced.',
            'composition_guard':'This is a bare public attribute phrase, not a complete Japanese object name. Original captured public class/name recipe must add its legitimate noun/connector. Existing recipes relying on full JNetHack leaf nouns cannot adopt these strings silently.',
            'ambiguity_guard':'emerald/ruby remain jewel-word phrases; color/material interpretation belongs to the original already visible class grammar, not a hidden type lookup.' if phrase in {'emerald','ruby'} else None,
            'authoring_credit':'Japanese public phrase authored from official English on 2026-10-02; imported candidates retained as provenance evidence only.'})
    out={'schema_version':1,'source_only':True,'runtime_verified':False,
        'input_ledger_sha256':sha(raw),'frozen_metadata_sha256':sha(frozen_path.read_bytes()),
        'counts':{'reviewed_public_phrases':len(entries),'original_appearance_slots':source_slots,'runtime_approved':0},
        'catalog_overlay':{'en':en,'ja':ja,'argument_schemas':{ident:[] for ident in en}},
        'entries':entries,
        'integration_policy':'Emit the public EN-derived alias even when JA is absent. Old true-type IDs remain private source audit only; never retain them as a missing-translation fallback.',
        'native_source_calls_or_frozen_catalogs_modified':False}
    target=HERE/'public-appearance-phrases.authored.json'
    encoded=(json.dumps(out,ensure_ascii=False,indent=2)+'\n').encode()
    target.write_bytes(encoded)
    print(json.dumps({'sha256':sha(encoded),**out['counts']}))


if __name__=='__main__':main()
