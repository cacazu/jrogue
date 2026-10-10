mergeInto(LibraryManager.library, {
  // Synchronous presentation import. Rust and C++ have separate memories.
  dcss_host_startup_text__deps: ['$UTF8ToString', '$lengthBytesUTF8', '$stringToUTF8'],
  dcss_host_startup_text: function(idPtr, paramsPtr, destination, capacity) {
    try {
      if (!Number.isInteger(capacity) || capacity !== 512 || !destination
          || destination < 0 || destination + capacity > HEAPU8.length) {
        throw new Error('invalid native startup destination');
      }
      if (!idPtr || idPtr < 0 || idPtr + 22 > HEAPU8.length
          || !paramsPtr || paramsPtr < 0 || paramsPtr + 3 > HEAPU8.length) {
        throw new Error('invalid native startup descriptor');
      }
      const id = UTF8ToString(idPtr, 22);
      const paramsJson = UTF8ToString(paramsPtr, 3);
      if (id !== 'startup.weapon.prompt' || paramsJson !== '{}'
          || HEAPU8[idPtr + 21] !== 0 || HEAPU8[paramsPtr + 2] !== 0) {
        throw new Error('unreviewed native startup descriptor');
      }
      if (typeof Module.dcssFormatStartup !== 'function') throw new Error('native startup formatter unavailable');
      const text = Module.dcssFormatStartup(id, {});
      if (typeof text !== 'string' || !text.length || text.indexOf('\0') !== -1) {
        throw new Error('native startup formatter must return plain text synchronously');
      }
      if (text !== 'You have a choice of weapons.'
          && text !== '\u6b66\u5668\u3092\u9078\u3079\u307e\u3059\u3002') {
        throw new Error('native startup text differs from the reviewed en/ja slice');
      }
      const length = lengthBytesUTF8(text);
      if (length >= capacity) throw new Error('native startup text exceeds destination');
      // Re-read the current heap after the callback; never use Module.HEAPU8.
      if (destination + capacity > HEAPU8.length) throw new Error('native startup destination changed');
      stringToUTF8(text, destination, capacity);
      return length;
    } catch (error) {
      try { if (typeof Module.dcssStartupTextError === 'function') Module.dcssStartupTextError(String(error)); }
      catch (_) { /* No diagnostic may throw into the native fatal route. */ }
      return -1;
    }
  },
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
