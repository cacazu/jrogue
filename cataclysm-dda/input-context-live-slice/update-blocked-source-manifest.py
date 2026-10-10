from pathlib import Path
p=Path('input-context-live-slice/record-current-evidence.py')
s=p.read_text(encoding='utf8')
s=s.replace("'driverAndOwnerIndependentReview':'pending'","'driverAndOwnerIndependentReview':'clear'")
marker="out=SLICE/'CURRENT-EVIDENCE.json';"
addition="""items['functionalNativeRustWasmSourcePacket']['ownerSourceChecks']={'proof':pin(ADAPTER/'wasm-build/OWNER-SOURCE-CHECKS.json'),'checks':21,'actualExecutionTestsAdded':0,'nativeSnapshotPacketsSynthesized':False}
items['functionalNativeRustWasmSourcePacket']['permissionDeadlineBlocker']=pin(ADAPTER/'wasm-build/APPROVAL-DEADLINE-BLOCKER.json')
items['functionalNativeRustWasmSourcePacket']['requestedWindowStatus']='initial-and-one-identical-approval-retry-timeout-before-CreateProcess'
items['functionalNativeRustWasmSourcePacket']['furtherNativeRequestsHeld']=True
"""
assert marker in s;s=s.replace(marker,addition+marker)
p.write_text(s,encoding='utf8',newline='\\n')
