  // Reviewed synchronous presentation import: fixed11, dynamic12, HUD22.
  dcss_host_startup_text__deps: ['$lengthBytesUTF8', '$stringToUTF8'],
  dcss_host_startup_text: function(idPtr, paramsPtr, destination, capacity) {
    try {
      const reviewed = /* GENERATED_REVIEWED_IMPORT */;
      if (capacity !== 512 || !Number.isInteger(destination) || destination <= 0 || destination + capacity > HEAPU8.length)
        throw new Error('invalid native display destination');
      const decoder = new TextDecoder('utf-8', {fatal:true});
      function string(pointer, maximum) {
        if (!Number.isInteger(pointer) || pointer <= 0 || pointer + maximum > HEAPU8.length) throw new Error('invalid native display pointer');
        let length = 0;
        while (length < maximum && HEAPU8[pointer + length] !== 0) length++;
        if (length === maximum) throw new Error('unterminated native display descriptor');
        return decoder.decode(HEAPU8.slice(pointer, pointer + length));
      }
      function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
      function keys(value, expected) { return object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value,key)); }
      const id = string(idPtr,81), rawParams = string(paramsPtr,2048), params = JSON.parse(rawParams);
      if (!Object.hasOwn(reviewed.messages,id) || JSON.stringify(params) !== rawParams) throw new Error('unreviewed native display descriptor encoding');
      const message = reviewed.messages[id], schemas = message.parameters;
      if (!keys(params,Object.keys(schemas))) throw new Error('unreviewed native display parameter keys');
      const values = {};
      for (const key of Object.keys(schemas)) {
        const schema = schemas[key], value = params[key];
        if (schema.type === 'entity_label') {
          if (!keys(value,['kind','version','upstream','domain','id','form']) || value.kind !== 'entity_label' || value.version !== 1
              || value.upstream !== reviewed.upstream || value.domain !== schema.role || value.form !== 'name'
              || !Object.hasOwn(reviewed.entities[schema.role],value.id)) throw new Error('unreviewed native entity label');
          values[key] = reviewed.entities[schema.role][value.id];
        } else if (schema.type === 'actor_label') {
          if (!keys(value,['kind','version','upstream','form','identity']) || value.kind !== 'actor_label' || value.version !== 1 || value.upstream !== reviewed.upstream
              || value.form !== 'name' || !keys(value.identity,['visibility','name']) || value.identity.visibility !== 'external'
              || typeof value.identity.name !== 'string' || !value.identity.name.length || /\p{Cc}/u.test(value.identity.name)
              || lengthBytesUTF8(value.identity.name) > 128) throw new Error('unreviewed native external actor');
          values[key] = {en:value.identity.name,ja:value.identity.name};
        } else throw new Error('unreviewed native display parameter type');
      }
      const expected = ['en','ja'].map(language => message[language].replace(/\{([a-z][a-z0-9_]*)\}/g,function(_,key) {
        if (!Object.hasOwn(values,key)) throw new Error('unreviewed native template placeholder');
        return values[key][language];
      }));
      if (typeof Module.dcssFormatStartup !== 'function') throw new Error('native display formatter unavailable');
      const text = Module.dcssFormatStartup(id,params);
      if (typeof text !== 'string' || text.indexOf('\0') !== -1 || !expected.includes(text)) throw new Error('native display differs from reviewed catalog');
      const length = lengthBytesUTF8(text);
      if (length <= 0 || length >= capacity || destination + capacity > HEAPU8.length) throw new Error('native display exceeds destination');
      stringToUTF8(text,destination,capacity);
      return length;
    } catch (error) {
      try { if (typeof Module.dcssStartupTextError === 'function') Module.dcssStartupTextError(String(error)); }
      catch (_) { /* Preserve native end(1), with no fabricated input. */ }
      return -1;
    }
  },
