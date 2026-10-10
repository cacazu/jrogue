# Observed Windows process-time precision

The first actual revised counter probe stopped safely before Chrome. The recorded
CIM creation times were 3, 4, 5 and 8 100 ns ticks below their corresponding
Get-Process StartTime witnesses. All four recorded identities and the outer job
closed; source fingerprints were unchanged. This was a cross-provider comparison
defect, not a resource-limit failure or game exception.

[Microsoft CIM_DATETIME documentation](https://learn.microsoft.com/en-us/windows/win32/wmisdk/cim-datetime)
defines six fractional microsecond digits.
[Win32_Process](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process)
defines CreationDate as a read-only CIM datetime. The downward conversion is
observed in the actual probe; no general time tolerance is inferred.

The prepared v3 must convert the higher-precision UTC tick witness by exact
integer truncation to the 10-tick CIM quantum. Full 100 ns witnesses remain in
diagnostics. Noncanonical CIM times and cross-quantum mismatches must fail.
CIM-to-CIM root, ledger and cleanup identity checks remain exact. Mandatory
private accounting, parent verification and all-sample cleanup remain required.
The browser7/9 launch gate,5GiB private cap and2GiB floors are unchanged.

V2 sources and counter-probe-1 evidence remain immutable. V3 and a separate
actual prerequisite probe require source review and an explicitly released
window before any game-browser candidate can run. The browser candidate is
still unconsumed. See `browser-qa/guard-counter-probe/counter-probe-1-summary.json`.

## Actual v3 prerequisite result

The independently reviewed v3 correction passed the separately released second
Node counter probe. All three samples accounted for all four recorded owned
processes. Exact native remainders of 1, 9, 3 and 3 ticks mapped into the same
canonical CIM microseconds; full native witnesses were retained as decimal
strings. Fourteen exact outer FILETIME identities and every owned root/job
closed with no remaining identities or cleanup errors. The kernel job private
peak was 207,777,792 bytes over 11.325 seconds.

The immutable summary is
`browser-qa/guard-counter-probe-v3/counter-probe-2-summary.json`
(SHA-256 `762232d320a776c54fa81bafc3f665db3c0baa2efd3ea3205a1c3bb4a42fa75c`).
Root audited seven artifact hashes, all fourteen outer identities and twelve
native/CIM/private witnesses in `evidence/browser-counter-probe-v3-audit.json`.
This validates the small counter prerequisite. Game-browser acceptance still
requires the separate candidate source review and decisive fresh 7/9 GiB gate.
