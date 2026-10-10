# Initial trial stopped before compilation

The single authorized `cpp2-initial` trial ended with exit code 1 and terminal
status `failed-terminal-input-audit`. It made no compiler-launch attempt, created
no returned driver root or owned job, and recorded no stage/resource samples.
No objects or MMD files were produced. All 207 reviewed file-byte pins remained
unchanged, including pristine/baseline source and objects. Original evidence
under `execution/cpp2-initial` remains unchanged; no automatic retry occurred.

All archived metadata differences were classified:

| Tree | Before/after entries | Changed entries | Added/removed | Regular-file/other changes |
| --- | ---: | ---: | ---: | ---: |
| Existing SDK cache | 2,824 / 2,824 | 90 | 0 / 0 | 0 |
| Existing official ports | 8,335 / 8,335 | 358 | 0 / 0 | 0 |

All **448** changes are directory `st_size` alone: zero became values such as
4,096, 8,192 or 24,576. Every recorded mtime, mode, attribute and entry name stayed
identical. Six bounded read-only probes measured `Path.lstat()` directory sizes
of 4,096/8,192 while `DirEntry.stat()` for the same entries reported zero, with
matching other fields. Two regular-file probes retained their reviewed hashes.
[metadata-diagnosis.json](execution/cpp2-initial/metadata-diagnosis.json) records
every changed entry and those probes.

Python documents `st_size` as byte size for regular files or symbolic links;
it does not promise a directory byte length. [Python 3.13 stat-result contract](https://docs.python.org/3.13/library/os.html#os.stat_result).
The measured API representation difference demonstrates why directory length is
unsuitable for this equality invariant. The specific reason the initial
`Path.lstat()` snapshot returned zero is **not established**; this diagnosis
does not attribute it to helper import. Independent source review found no cache
or ports writer/stat monkeypatch reachable before the first metadata gate.

The narrow correction emits `null` only for directory size, using the same
record's `stat.S_ISDIR(st_mode)`. It retains full entry membership, directory
mtime/mode/attributes/type, regular-file sizes, reparse rejection and all 207
byte pins at both pre-stage and terminal comparisons. The raw failure snapshots
are retained. This is a comparison-field correction, not a changed baseline.
Metadata equality still cannot prove every unpinned file's content identity.

Eleven light source/filesystem assertions passed. New regressions normalize all
448 archived differences while rejecting directory mtime/mode/attribute mutations;
an isolated owned fixture verifies regular-file size, directory mtime and new-entry
detection. Those tests launch no Windows guard or compiler. Both TU validity and
memory fit remain pending a separately reserved corrected trial.

Preserved initial terminal SHA-256:
`0273eed2a98aba61441e80c587781c10cd362e9dacbb647b28755954d69816fe`.
Diagnostic SHA-256:
`2fe326b65945a86867527260fd1bb31c9dc411598e07d8f415c1fba469ecc8b0`.
