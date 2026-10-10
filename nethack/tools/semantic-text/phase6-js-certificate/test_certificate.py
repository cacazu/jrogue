"""Added 2026-10-02, NGPL: separate certificate source regressions only."""
import hashlib,json,unittest
import certify as c

class CertificateContracts(unittest.TestCase):
    def test_exact_windows_text_reader_difference(self):
        raw=b'public text\r\nloader()\nend\r\n'
        proof=c.normalization(raw,c.sha(raw.replace(b'\r\n',b'\n')))
        self.assertEqual(proof['crlf_offsets'],[11,25])
        self.assertEqual(proof['normalized_bytes'],len(raw)-2)
    def test_changed_text_and_bare_CR_fail_closed(self):
        original=b'public text\r\n'
        with self.assertRaises(ValueError):c.normalization(b'changed text\r\n',c.sha(original.replace(b'\r\n',b'\n')))
        with self.assertRaises(ValueError):c.normalization(b'bare\rreturn',c.sha(b'bare\nreturn'))
    def test_duplicate_or_failed_actual_compile_is_rejected(self):
        def command_hash(argv):return c.sha(json.dumps(argv,separators=(',',':')).encode())
        row={'source':'src/example.c','status':'passed','source_sha256':'observed','argv':['emcc','-c','src/example.c'],'command_sha256':command_hash(['emcc','-c','src/example.c'])}
        manifest={'compile_evidence':{'units':[row]},'compiled_input_hashes':[{'path':'src/example.c','sha256':'observed'}]}
        self.assertEqual(c.validate_units(manifest,command_hash)['units'],1)
        manifest['compile_evidence']['units']=[row,row]
        with self.assertRaises(ValueError):c.validate_units(manifest,command_hash)
        manifest['compile_evidence']['units']=[dict(row,status='attempted')]
        with self.assertRaises(ValueError):c.validate_units(manifest,command_hash)

if __name__=='__main__':unittest.main(verbosity=2)
