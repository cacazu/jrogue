"""Lightweight recipe guards and actual staged CPP inverses; no game execution."""
from pathlib import Path
import ast
import copy
import json
import tempfile
import unittest
import candidate_common as common
from candidate_common import base

HERE = Path(__file__).resolve().parent
STAGE = HERE.parent
GAME = Path(r'C:\Users\kit\gameme\jnethack\jrouge\dcss')

class Guards(unittest.TestCase):
    def test_syntax(self):
        for file in HERE.glob('*.py'):
            ast.parse(file.read_text(encoding='utf-8'),filename=str(file))

    def test_sha_requires_reviewed_value(self):
        for value in (None,'pending','0'*63,'A'*64,False):
            with self.assertRaises(ValueError):common.require_sha(value)

    def test_path_and_receipt(self):
        with tempfile.TemporaryDirectory(dir=HERE) as directory:
            root=Path(directory).resolve()
            (root/'safe.txt').write_text('source',encoding='utf-8')
            record={'path':'safe.txt',**base.receipt(root/'safe.txt')}
            self.assertEqual(common.checked_file(root,record),root/'safe.txt')
            for name in ('../safe.txt','/safe.txt','a\\b','a//b','a/./b','C:/other'):
                with self.assertRaises(ValueError):base.under(root,name)
            with self.assertRaises(ValueError):common.checked_file(root,dict(record,bytes=1))

    def test_duplicate_json_rejected(self):
        with tempfile.TemporaryDirectory(dir=HERE) as directory:
            path=Path(directory)/'duplicate.json'
            path.write_text('{"source":1,"source":2}',encoding='utf-8')
            with self.assertRaises(ValueError):common.load_json(path)

    def test_inverse_preserves_complete_source(self):
        original='#include "core.h"\r\nvoid f(){ print("Canon"); }\r\n'
        helper='// helper\n'
        patched=original.replace('\r\n','\n').replace('"Canon"','text()',1)
        patched=helper+patched
        common.inverse(original,patched,[{'before':'','after':helper},{'before':'"Canon"','after':'text()'}])
        with self.assertRaises(ValueError):common.inverse(original,patched+'extra();\n',[{'before':'','after':helper},{'before':'"Canon"','after':'text()'}])
        with self.assertRaises(ValueError):common.inverse(original,patched.replace('core.h','other.h'),[{'before':'','after':helper},{'before':'"Canon"','after':'text()'}])
        with self.assertRaises(ValueError):common.inverse(original,patched+helper,[{'before':'','after':helper},{'before':'"Canon"','after':'text()'}])

    def test_allowed_graph_indices(self):
        self.assertEqual(set(common.ALLOWED_OVERRIDES),{170,181})
        self.assertEqual(common.ALLOWED_OVERRIDES[170][0],'newgame.cc')
        self.assertEqual(common.ALLOWED_OVERRIDES[181][0],'output.cc')

    def test_preserved_exact_audits(self):
        for name,sha in common.AUDITS.items():base.require_hash(HERE/'audit'/name,sha)

    def test_actual_fixed11_inverse(self):
        root=STAGE/'dcss-startup-v2-work'
        receipts=common.load_json(root/'fixed-source-receipts.json')
        override=receipts['native_overrides'][0]
        actions=[{key:action[key] for key in ('before','after')} for action in override['inverse_actions']]
        original=(GAME/base.NATIVE_SOURCE/'newgame.cc').read_text(encoding='utf-8')
        frozen=GAME/'engine/migration-staging/startup-fixed-weapon-labels/engine/newgame.cc'
        base.require_hash(frozen,override['final_sha256'])
        patched=frozen.read_text(encoding='utf-8')
        common.inverse(original,patched,actions)

    def test_actual_dynamic12_inverse(self):
        root=STAGE/'dcss-startup-v2-work'
        receipts=common.load_json(root/'native-dynamic-receipts.json')
        actions=[{key:action[key] for key in ('before','after')} for action in receipts['inverse_actions']]
        file=root/'engine/newgame.cc'
        base.require_hash(file,receipts['final_sha256'])
        original=(GAME/base.NATIVE_SOURCE/'newgame.cc').read_text(encoding='utf-8')
        common.inverse(original,file.read_text(encoding='utf-8'),actions)

    def test_actual_hud22_inverse(self):
        root=STAGE/'dcss-native-path-work'
        receipts=common.load_json(root/'source-receipts.json')
        transform=receipts['transformations']['engine/output.cc']
        actions=[{key:action[key] for key in ('before','after')} for action in transform['patches']]
        original=(GAME/base.NATIVE_SOURCE/'output.cc').read_text(encoding='utf-8')
        patched=(root/'engine/output.cc').read_text(encoding='utf-8')
        common.inverse(original,patched,actions)

    def test_immutable_validator_extraction_is_exact(self):
        original=ast.parse((HERE/'audit/v1-reproduce-font-free-package.py').read_text(encoding='utf-8'))
        extracted=ast.parse((HERE/'immutable_baseline.py').read_text(encoding='utf-8'))
        functions=lambda tree:{node.name:ast.dump(node,include_attributes=False) for node in tree.body if isinstance(node,ast.FunctionDef)}
        old,new=functions(original),functions(extracted)
        self.assertNotIn('validate_startup_candidate',new)
        self.assertNotIn('main',new)
        for name,body in new.items():self.assertEqual(body,old[name],name)

    def dynamic_fixture(self,id):
        root=STAGE/'dcss-dynamic-schema-work/locales/dynamic'
        catalogs={language:common.load_json(root/(language+'.json')) for language in ('en','ja')}
        source=common.load_json(root/'source-map.json')
        record=next(item for item in source['messages'] if item['id']==id)
        params=record['params']
        shape='typed' if id!='startup.dynamic.welcome.empty' else 'string'
        message={'catalog_shape':shape,'source_params':params,
            **{language:catalogs[language][id]['text'] if shape=='typed' else catalogs[language][id]
               for language in ('en','ja')}}
        schema={'category':'dynamic','parameters':{name:{'type':parameter['kind'],
            'role':parameter['domain'] if parameter['kind']=='entity_label' else 'external_username'}
            for name,parameter in params.items()}}
        return catalogs,message,schema

    def test_actual_typed11_and_primitive_empty_catalogs(self):
        counts={'typed':0,'string':0}
        for id in common.DYNAMIC_IDS:
            catalogs,message,schema=self.dynamic_fixture(id)
            counts[message['catalog_shape']]+=1
            for language in ('en','ja'):
                common.validate_catalog_entry(id,language,catalogs[language][id],message,schema)
        self.assertEqual(counts,{'typed':11,'string':1})

    def test_typed_catalog_wrong_shape_surplus_and_params(self):
        id='startup.dynamic.species_name'
        catalogs,message,schema=self.dynamic_fixture(id)
        original=catalogs['en'][id]
        invalid=[original['text'],dict(original,surplus=True),dict(original,text='changed'),
                 dict(original,params={}),dict(original,params={'species':dict(original['params']['species'],form='abbrev')})]
        for entry in invalid:
            with self.assertRaises(ValueError):common.validate_catalog_entry(id,'en',entry,message,schema)
        with self.assertRaises(ValueError):
            common.validate_catalog_entry(id,'en',original,dict(message,catalog_shape='string'),schema)

    def test_primitive_empty_cannot_inherit_typed_shape(self):
        id='startup.dynamic.welcome.empty'
        catalogs,message,schema=self.dynamic_fixture(id)
        entry=catalogs['en'][id]
        for bad in ({'text':entry,'params':{}},None):
            with self.assertRaises(ValueError):common.validate_catalog_entry(id,'en',bad,message,schema)
        with self.assertRaises(ValueError):
            common.validate_catalog_entry(id,'en',entry,dict(message,catalog_shape='typed'),schema)

    def test_actor_catalog_schema_is_sealed(self):
        id='startup.dynamic.welcome.named_only'
        catalogs,message,schema=self.dynamic_fixture(id)
        entry=copy.deepcopy(catalogs['en'][id])
        entry['params']['player_name']['visibility']='local'
        with self.assertRaises(ValueError):common.validate_catalog_entry(id,'en',entry,message,schema)
        bad=copy.deepcopy(schema);bad['parameters']['player_name']['type']='string'
        with self.assertRaises(ValueError):common.validate_catalog_entry(id,'en',catalogs['en'][id],message,bad)

if __name__=='__main__':
    unittest.main()
