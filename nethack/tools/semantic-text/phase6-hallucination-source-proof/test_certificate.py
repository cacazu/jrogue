"""Added 2026-10-02, NGPL: source-proof regressions; no C execution."""
import copy,json,unittest
import certify as c

class PublicRandomContracts(unittest.TestCase):
    def test_pristine_random_body_and_original_rng_arguments(self):
        before=c.function((c.ROOT/'upstream/NetHack-5.0.0/src/do_name.c').read_text('utf8'),'rndmonnam')
        actual=c.function((c.SOURCE/'src/do_name.c').read_text('utf8'),'rndmonnam')
        self.assertEqual(c.restore_random(actual),before)
        self.assertEqual(c.ordered_rng_calls(actual),c.ordered_rng_calls(before))
        altered=actual.replace('rn2_on_display_rng(2)','rn2_on_display_rng(3)',1)
        with self.assertRaises(ValueError):c.restore_random(altered)
        self.assertNotEqual(c.ordered_rng_calls(altered),c.ordered_rng_calls(before))
        with self.assertRaises(ValueError):c.restore_random(actual.replace('nh_text_monster_selected_random(mnam, &mons[name], nh_random_name);','unapproved_observer();',1))
    def test_actual_public_wire_rejects_target_fields_or_mismatched_leaf(self):
        report=c.read(c.STAGE/'acceptance-r2/native-name-verification.json');catalog=c.read(c.STAGE/'web/gameplay-core.json')
        actual=report['captures'][-1]['envelope'];proof=c.wire_contract(actual,catalog)
        self.assertEqual(proof['selected_leaf']['original'],'baby gray dragon')
        altered=copy.deepcopy(actual)
        altered['event']['args']['arg_1']['value']['args']['true_species']={'type':'integer','value':1}
        with self.assertRaises(ValueError):c.wire_contract(altered,catalog)
        altered=copy.deepcopy(actual)
        leaf=altered['event']['args']['arg_1']['value']['args']['body']['value']['args']['body']['value']['args']
        leaf['name']['value']='nethack.entity.monster.kitten.name_neutral'
        with self.assertRaises(ValueError):c.wire_contract(altered,catalog)
    def test_current_certificate_pins_source_not_new_runtime_execution(self):
        result=c.certify()
        self.assertEqual(result['frozen_proposal']['historical_passing_source_checks'],24)
        self.assertEqual(len(result['frozen_proposal']['eight_function_proofs']),8)
        for key in ('compiler_executed','generator_executed','node_executed','browser_executed','runtime_acceptance_passed','immutable_candidate_changed'):
            self.assertFalse(result[key])
        self.assertTrue(result['random_source_contract']['bogus_branch_has_no_binding'])
        self.assertTrue(result['observed_native_message']['prior_label_absent_from_observed_wire'])

if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(PublicRandomContracts))
    (c.HERE/'test-results.json').write_text(json.dumps({'source_only':True,'run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'generated_C_executed':False},indent=2)+'\n',encoding='utf8',newline='\n')
    raise SystemExit(0 if result.wasSuccessful() else 1)
