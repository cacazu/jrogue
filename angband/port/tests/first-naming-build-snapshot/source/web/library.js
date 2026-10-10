mergeInto(LibraryManager.library, {
  ab_host_key: function() { return (Module.abKeys || []).shift() || 0; },
  ab_host_flush: function() { if (Module.abKeys) Module.abKeys.length = 0; },
  ab_host_frame: function(p) { if (Module.abFrame) Module.abFrame(JSON.parse(UTF8ToString(p))); },
  ab_host_state: function(p) { if (Module.abState) Module.abState(JSON.parse(UTF8ToString(p))); },
  ab_host_save: function(p, n) { if (Module.abSave) Module.abSave(HEAPU8.slice(p, p + n)); },
  ab_host_save_error: function(p) { if (Module.abSaveError) Module.abSaveError(UTF8ToString(p)); }
  ,ab_host_message: function(p, text) { if (Module.abMessage) Module.abMessage({id:UTF8ToString(p),text:UTF8ToString(text)}); }
  ,ab_host_semantic_event: function(p, n, localized) {
    p = p >>> 0; n = n >>> 0;
    if (!p || !n || n > 131072 || p > HEAPU8.length - n) return;
    localized = localized >>> 0;
    if (localized) {
      if (localized >= HEAPU8.length) return;
      var end = localized;
      var limit = Math.min(HEAPU8.length, localized + 32769);
      while (end < limit && HEAPU8[end]) end++;
      if (end >= limit) return;
    }
    // Both C/Rust spans are copied synchronously before their buffers change.
    if (Module.abSemanticEvent) Module.abSemanticEvent(UTF8ToString(p, n), localized ? UTF8ToString(localized, 32769) : null);
  }
});
