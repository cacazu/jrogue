mergeInto(LibraryManager.library, {
  // Future fixed weapon texts. No dynamic entities or arbitrary parameters.
  dcss_host_startup_text__deps: ['$UTF8ToString', '$lengthBytesUTF8', '$stringToUTF8'],
  dcss_host_startup_text: function(idPtr, paramsPtr, destination, capacity) {
    try {
      if (!Number.isInteger(capacity) || capacity !== 512 || !destination || destination < 0
          || destination + capacity > HEAPU8.length || !idPtr || idPtr < 0 || idPtr + 81 > HEAPU8.length
          || !paramsPtr || paramsPtr < 0 || paramsPtr + 3 > HEAPU8.length) throw new Error('invalid fixed startup pointers');
      const known = {"startup.weapon.prompt":["You have a choice of weapons.","武器を選べます。"],"startup.weapon.recommended.label":["+ - Recommended random choice","+ - おすすめからランダム選択"],"startup.weapon.recommended.description":["Picks a random recommended weapon","おすすめの武器からランダムに選びます"],"startup.weapon.aptitudes.label":["% - List aptitudes","% - 適性一覧"],"startup.weapon.aptitudes.description":["Lists the numerical skill train aptitudes for all races","全種族の技能訓練適性を数値で表示します"],"startup.weapon.help.label":["? - Help","? - ヘルプ"],"startup.weapon.help.description":["Opens the help screen","ヘルプ画面を開きます"],"startup.weapon.random.label":["* - Random weapon","* - ランダムな武器"],"startup.weapon.random.description":["Picks a random weapon","武器をランダムに選びます"],"startup.weapon.back.label":["Bksp - Return to character menu","Bksp - キャラクター選択に戻る"],"startup.weapon.back.description":["Lets you return back to Character choice menu","キャラクター選択メニューに戻ります"]};
      const id = UTF8ToString(idPtr, 81);
      const params = UTF8ToString(paramsPtr, 3);
      if (!Object.prototype.hasOwnProperty.call(known,id) || HEAPU8[idPtr+id.length] !== 0
          || params !== '{}' || HEAPU8[paramsPtr+2] !== 0) throw new Error('unreviewed fixed startup descriptor');
      if (typeof Module.dcssFormatStartup !== 'function') throw new Error('startup formatter unavailable');
      const text = Module.dcssFormatStartup(id, {});
      if (typeof text !== 'string' || text.indexOf('\0') !== -1
          || (text !== known[id][0] && text !== known[id][1])) throw new Error('unreviewed fixed startup text');
      const length = lengthBytesUTF8(text);
      if (length >= capacity || destination+capacity > HEAPU8.length) throw new Error('fixed startup text exceeds destination');
      stringToUTF8(text,destination,capacity);
      return length;
    } catch (error) {
      try { if (typeof Module.dcssStartupTextError === 'function') Module.dcssStartupTextError(String(error)); }
      catch (_) { /* Preserve native end(1), with no fabricated input. */ }
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
