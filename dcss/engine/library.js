mergeInto(LibraryManager.library, {
  dcss_host_frame: function(ptr, cols, rows, x, y, cursor) {
    if (Module.dcssFrame) {
      const clusters = JSON.parse(UTF8ToString(_dcss_clusters_json()));
      Module.dcssFrame(HEAPU32.slice(ptr >> 2, (ptr >> 2) + cols * rows * 3), cols, rows, x, y, !!cursor, clusters);
    }
  },
  dcss_host_semantic: function(ptr) {
    if (!Module.dcssSemantic) return;
    try { Module.dcssSemantic(JSON.parse(UTF8ToString(ptr))); }
    catch (error) {
      // Locale transport must never throw into canonical gameplay/control.
      try { if (Module.dcssSemanticError) Module.dcssSemanticError(String(error)); }
      catch (_) { /* The original console/control route still runs. */ }
    }
  },
  dcss_host_has_key: function() {
    return Module.dcssHasKey ? Module.dcssHasKey() : 0;
  },
  dcss_host_read_key__async: true,
  dcss_host_read_key__deps: ['$Asyncify'],
  dcss_host_read_key: function() {
    return Asyncify.handleSleep(function(wakeUp) {
      if (!Module.dcssReadKey) throw new Error('DCSS host must provide dcssReadKey(wakeUp)');
      Module.dcssReadKey(wakeUp);
    });
  },
  dcss_host_delay__async: true,
  dcss_host_delay__deps: ['$Asyncify'],
  dcss_host_delay: function(ms) {
    return Asyncify.handleSleep(function(wakeUp) { setTimeout(wakeUp, Math.min(ms, 1000)); });
  }
});
