// SPDX-License-Identifier: GPL-3.0-or-later
// Called after original native init creates its Lua state, before original start.
import { SemanticTransportError, validateTemplate } from './semantic-text-wasm.mjs';

export function installNativeSemanticBridge(module, resolver) {
  if (!resolver?.ready || typeof resolver.resolve !== 'function' || typeof resolver.supplement !== 'function' || typeof resolver.formatPolicy !== 'function') {
    throw new SemanticTransportError('resolver_not_ready');
  }
  if (typeof module?.ccall !== 'function' || typeof module._tome_native_semantic_register !== 'function') {
    throw new SemanticTransportError('missing_native_semantic_exports');
  }
  const leases = new Map();
  let nextLease = 1;
  const lease = response => {
    if (leases.size >= 32) return 0;
    const handle = nextLease;
    nextLease = nextLease >= 0x7fffffff ? 1 : nextLease + 1;
    if (leases.has(handle)) return 0;
    leases.set(handle, response);
    return handle;
  };
  module.tomeSemanticResolver = {
    ready: true,
    beginResolve(source, tag, file, line, locale) {
      try {
        const response = resolver.resolve(source, tag, file || null, line, locale);
        if (response.ok) validateTemplate(response.result);
        return lease(response);
      } catch (error) { return lease({ ok: false, reason: error.reason || 'semantic_host_error' }); }
    },
    beginSupplement(id) {
      try { return lease(resolver.supplement(id)); }
      catch (error) { return lease({ ok: false, reason: error.reason || 'semantic_host_error' }); }
    },
    beginPolicy(id) {
      try { return lease(resolver.formatPolicy(id)); }
      catch (error) { return lease({ ok: false, reason: error.reason || 'semantic_host_error' }); }
    },
    hasResult(handle) { return Boolean(leases.get(handle)?.ok && leases.get(handle)?.result); },
    hasSupplement(handle) { return typeof leases.get(handle)?.supplement === 'string'; },
    hasPolicy(handle) { return Boolean(leases.get(handle)?.ok && leases.get(handle)?.policy); },
    string(handle, field) {
      const response = leases.get(handle);
      if (!response) return null;
      const value = field >= 6 ? response.policy?.[['kind', 'review_status', 'source', 'tag', 'target', 'semantic_id'][field - 6]] : field === 0 ? response.reason : field === 5 ? response.supplement :
        response.result?.[['', 'id', 'template', 'owner', 'tag'][field]];
      return typeof value === 'string' ? value : null;
    },
    orderLength(handle) { return leases.get(handle)?.result?.args_order?.length || 0; },
    order(handle, index) { return leases.get(handle)?.result?.args_order?.[index] || 0; },
    policyArgument(handle) { return leases.get(handle)?.policy?.argument_index || 0; },
    policyArray(handle, array) {
      return leases.get(handle)?.policy?.[['source_specifiers', 'target_specifiers', 'source_types', 'target_types'][array]] || [];
    },
    flag(handle, field) {
      return Boolean(leases.get(handle)?.result?.[
        ['missing_official_japanese', 'delegate_native_special', 'delegate_native_format_review'][field]
      ]);
    },
    release(handle) { leases.delete(handle); },
    outstandingLeases() { return leases.size; },
  };
  if (module.ccall('tome_native_semantic_register', 'number', [], []) !== 1) {
    const detail = typeof module._tome_native_semantic_last_error === 'function' ?
      module.ccall('tome_native_semantic_last_error', 'string', [], []) : '';
    throw new SemanticTransportError(detail || 'native_semantic_registration_failed');
  }
  return module.tomeSemanticResolver;
}
