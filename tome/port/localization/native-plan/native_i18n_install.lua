-- GPL-3.0-or-later. Source-only integration adapter; not yet runtime-verified.
-- Call observer:on_required(name, result) from the platform's existing require
-- wrapper, AFTER original require returns. This file does not replace require,
-- C/Lua gameplay, native locale loaders, RNG, or parameter values.
local M = {}

-- Two source-reviewed UI layouts only. Lua's %.8s precision counts bytes and
-- can split a Japanese resource name. All parameter order and native special
-- semantics remain unchanged; no general printf contract relaxation exists.
local fullwidth_colon = string.char(239, 188, 154)
local precision_owners = {
  ["game.modules.tome.mod.class.uiset.classicplayerdisplay.method.display.maketexturebar.tformat.parameter"] = {
    source="%-8.8s:", target="%s" .. fullwidth_colon, argument_index=1,
    source_specifiers={"%-8.8s"}, target_specifiers={"%s"},
    source_types={"s"}, target_types={"s"},
  },
  ["game.modules.tome.mod.dialogs.charactersheet.method.drawdialog.tformat.parameter_parameter_parameter"] = {
    source="%s%-8.8s: #00ff00#%s ", target="%s%s" .. fullwidth_colon .. " #00ff00#%s ", argument_index=2,
    source_specifiers={"%s", "%-8.8s", "%s"}, target_specifiers={"%s", "%s", "%s"},
    source_types={"s", "s", "s"}, target_types={"s", "s", "s"},
  },
}

local function same_array(left, right)
  if type(left) ~= "table" or #left ~= #right then return false end
  local count = 0
  for key, value in pairs(left) do
    if type(key) ~= "number" or key % 1 ~= 0 or key < 1 or key > #right or right[key] ~= value then return false end
    count = count + 1
  end
  return count == #right
end

local function checked_precision_policy(id, policy, source, tag, template, args_order)
  local owner = precision_owners[id]
  assert(owner and type(policy) == "table", "format policy outside the two reviewed semantic owners")
  assert(policy.semantic_id == id and policy.kind == "removeByteStringPrecision" and policy.review_status == "reviewed", "reviewed exact-ID format policy required")
  assert(policy.source == owner.source and source == owner.source and policy.tag == "tformat" and tag == "tformat", "format policy source/tag mismatch")
  assert(policy.target == owner.target and template == owner.target and policy.argument_index == owner.argument_index, "format policy target/argument mismatch")
  assert(policy.delegate_native_format_review == false and policy.native_special_and_effective_order_checks_required == true, "native formatter protections must remain active")
  assert(same_array(policy.source_specifiers, owner.source_specifiers) and same_array(policy.target_specifiers, owner.target_specifiers), "format policy printf specifier mismatch")
  assert(same_array(policy.source_types, owner.source_types) and same_array(policy.target_types, owner.target_types), "format policy typed argument mismatch")
  assert(same_array(args_order, {}), "reviewed byte precision policy requires unchanged argument order")
end

local function checked_result(result)
  if result == nil then return nil end
  assert(type(result) == "table", "Rust semantic resolver must return a Lua table")
  assert(type(result.id) == "string" and type(result.template) == "string", "semantic ID/template required")
  assert(type(result.owner) == "string" and type(result.tag) == "string", "semantic owner/tag required")
  assert(type(result.args_order) == "table", "semantic formatter argument-order table required")
  assert(type(result.missing_official_japanese) == "boolean", "official translation provenance required")
  assert(type(result.delegate_native_special) == "boolean" and type(result.delegate_native_format_review) == "boolean", "native formatter delegation flags required")
  return result
end

function M.new(options)
  assert(type(options) == "table", "native localization options required")
  local semantic = assert(options.semantic, "load reviewed semantic_i18n.lua first")
  assert(type(semantic.install) == "function" and type(semantic.native_contracts) == "function", "semantic seam module required")
  assert(type(options.resolve) == "function", "actual Rust/native semantic resolver callback required")
  local default_locale = options.default_locale or "ja_JP"
  assert(default_locale == "ja_JP" or default_locale == "en_US", "unsupported product default locale")
  -- The platform must read its persisted locale (or establish a fresh profile)
  -- BEFORE early Japanese font/class priming. A later unobserved English config
  -- file must not silently leave prematurely translated constants/forced fonts.
  assert(options.locale_preferences_ready == true, "load persisted locale before installing native localization")
  local preferred_locale = options.preferred_locale
  assert(preferred_locale == nil or type(preferred_locale) == "string", "persisted native locale must be a string or absent")

  -- Exact semantic-ID whitelist produced by source/provenance review. Empty
  -- targets are valid. No text-key replacement or unreviewed fallback occurs.
  local supplements = options.supplements or {}
  local format_policies = options.format_policies or {}
  assert(type(supplements) == "table" and type(format_policies) == "table", "exact-ID supplement/policy lookup tables required")
  local observer = {configuration=nil, i18n=nil, installation=nil, loaded_engine_file=nil, external_player_names_protected=false}
  local trace_limit = options.trace_limit or 128
  assert(type(trace_limit) == "number" and trace_limit >= 0 and trace_limit <= 1000 and trace_limit % 1 == 0, "bounded integer trace limit required")
  local unknown_limit = options.unknown_callsite_limit or 1024
  assert(type(unknown_limit) == "number" and unknown_limit >= 0 and unknown_limit <= 1024 and unknown_limit % 1 == 0, "bounded unknown callsite limit required")
  local source_copy_limit = 8192
  local trace_quotas = {first_resolved_id=math.floor(trace_limit/4), native_delegate=math.floor(trace_limit/4)}
  trace_quotas.unmapped = trace_limit - trace_quotas.first_resolved_id - trace_quotas.native_delegate
  local trace_retained = {first_resolved_id=0, native_delegate=0, unmapped=0}
  local trace_omitted = {first_resolved_id=0, native_delegate=0, unmapped=0}
  local coverage = {requests=0, resolved=0, unmapped=0, authored_supplement=0,
    remaining_english_fallback=0, native_delegated=0, official_missing=0,
    distinct_ids=0, trace_omitted=0, reviewed_utf8_layout=0,
    unmapped_callsites_retained=0, unmapped_occurrences_retained=0, unmapped_occurrences_omitted=0,
    unmapped_source_bytes=0, unmapped_source_copy_truncated_callsites=0}
  local seen_ids, trace = {}, {}
  local unknown_index, unknown_records, unknown_nil = {}, {}, {}

  local function record(event)
    local kind = event.kind
    assert(trace_quotas[kind] ~= nil, "unknown diagnostic trace kind")
    if trace_retained[kind] < trace_quotas[kind] then
      trace[#trace+1] = event
      trace_retained[kind] = trace_retained[kind] + 1
    else
      trace_omitted[kind] = trace_omitted[kind] + 1
      coverage.trace_omitted = coverage.trace_omitted + 1
    end
  end

  local function bounded_source_copy(source)
    if type(source) ~= "string" then return source, false, 0 end
    local length = #source
    if length <= source_copy_limit then return source, false, length end
    local ending = source_copy_limit
    -- Avoid introducing a partial UTF-8 character into the JSON diagnostic.
    while ending > 0 do
      local next_byte = source:byte(ending+1)
      if not next_byte or next_byte < 128 or next_byte >= 192 then break end
      ending = ending - 1
    end
    return source:sub(1, ending), true, length
  end

  local function record_unknown(source, tag, file, line, reason, locale)
    -- Exact tuple identity uses original immutable values as bounded table
    -- keys. No copied full-source concatenation or text-ID hash is created.
    -- Only up to unknown_limit identities are retained. Snapshot source copies
    -- are limited to 8 KiB; the original source value is retained by this index
    -- solely to distinguish long sources with identical truncated prefixes.
    local keys = {source == nil and unknown_nil or source, tag == nil and unknown_nil or tag,
      file == nil and unknown_nil or file, line == nil and unknown_nil or line,
      reason == nil and unknown_nil or reason}
    if type(source) == "string" then coverage.unmapped_source_bytes = coverage.unmapped_source_bytes + #source end
    local bucket = unknown_index
    for index=1,4 do bucket = bucket and bucket[keys[index]] end
    local existing = bucket and bucket[keys[5]]
    if existing then
      existing.occurrences = existing.occurrences + 1
      coverage.unmapped_occurrences_retained = coverage.unmapped_occurrences_retained + 1
      return
    end
    if #unknown_records >= unknown_limit then
      -- Without an unbounded set, repeated overflow identities cannot be
      -- distinguished from new ones. Count all omitted occurrences honestly.
      coverage.unmapped_occurrences_omitted = coverage.unmapped_occurrences_omitted + 1
      return
    end
    local copy, truncated, source_bytes = bounded_source_copy(source)
    local entry = {source=copy, tag=tag, file=file, line=line, reason=reason,
      occurrences=1, source_bytes=source_bytes, source_copy_bytes=type(copy)=="string" and #copy or 0,
      source_truncated=truncated, first_seen_request=coverage.requests, locale=locale}
    bucket = unknown_index
    for index=1,4 do
      bucket[keys[index]] = bucket[keys[index]] or {}
      bucket = bucket[keys[index]]
    end
    bucket[keys[5]] = entry
    unknown_records[#unknown_records+1] = entry
    coverage.unmapped_callsites_retained = coverage.unmapped_callsites_retained + 1
    coverage.unmapped_occurrences_retained = coverage.unmapped_occurrences_retained + 1
    if truncated then coverage.unmapped_source_copy_truncated_callsites = coverage.unmapped_source_copy_truncated_callsites + 1 end
  end

  local function active_locale()
    if observer.i18n then return observer.i18n:getLocalesData() end
    return observer.configuration and rawget(observer.configuration.settings, "locale") or default_locale
  end

  local function make_api(i18n)
    return {
      resolve = function(source, tag, file, line)
        coverage.requests = coverage.requests + 1
        local locale = active_locale()
        -- Preserve the original engine's other language choices; this EN/JA
        -- semantic catalogue has no authority over their native translations.
        if locale ~= "ja_JP" and locale ~= "en_US" then return nil, "native_locale_outside_semantic_catalogue" end
        local result, reason = options.resolve(source, tag, file, line, locale)
        result = checked_result(result)
        if not result then return nil, reason end
        coverage.resolved = coverage.resolved + 1
        if not seen_ids[result.id] then
          seen_ids[result.id] = true
          coverage.distinct_ids = coverage.distinct_ids + 1
          record{kind="first_resolved_id", id=result.id, tag=tag, file=file, line=line, locale=locale}
        end
        local supplement = supplements[result.id]
        if locale == "ja_JP" and supplement ~= nil then
          assert(type(supplement) == "string", "reviewed supplement must be string; null stays absent")
          -- Copy the finite result only. The host's immutable catalogue stays
          -- unchanged, and the original official-missing flag stays accurate.
          local selected = {}
          for key, value in pairs(result) do selected[key] = value end
          selected.template = supplement
          selected.authored_japanese_supplement = true
          local policy = format_policies[result.id]
          if policy ~= nil then
            checked_precision_policy(result.id, policy, source, tag, supplement, result.args_order)
            assert(result.tag == "tformat", "reviewed format policy result tag mismatch")
            selected.delegate_native_format_review = false
            selected.reviewed_utf8_layout = true
            -- delegate_native_special is retained. semantic_i18n also checks
            -- the effective native special gate and argument order afterwards.
            coverage.reviewed_utf8_layout = coverage.reviewed_utf8_layout + 1
          end
          result = selected
          coverage.authored_supplement = coverage.authored_supplement + 1
        elseif locale == "ja_JP" and result.missing_official_japanese then
          coverage.remaining_english_fallback = coverage.remaining_english_fallback + 1
        end
        return result
      end,
      native_contract = semantic.native_contracts(i18n),
      allow_native_template_override = function(result)
        return active_locale() == "ja_JP" and result.authored_japanese_supplement == true
          and type(supplements[result.id]) == "string" and supplements[result.id] == result.template
      end,
      on_unmapped = function(source, tag, file, line, reason)
        coverage.unmapped = coverage.unmapped + 1
        record_unknown(source, tag, file, line, reason, active_locale())
        local source_copy, source_truncated, source_bytes = bounded_source_copy(source)
        record{kind="unmapped", source=source_copy, source_bytes=source_bytes, source_truncated=source_truncated,
          tag=tag, file=file, line=line, reason=reason, locale=active_locale()}
        if options.on_unmapped then options.on_unmapped(source, tag, file, line, reason) end
      end,
      on_missing_japanese = function(id)
        coverage.official_missing = coverage.official_missing + 1
        if options.on_missing_japanese then options.on_missing_japanese(id) end
      end,
      on_native_delegate = function(id, reason)
        coverage.native_delegated = coverage.native_delegated + 1
        record{kind="native_delegate", id=id, reason=reason, locale=active_locale()}
        if options.on_native_delegate then options.on_native_delegate(id, reason) end
      end,
    }
  end

  function observer:on_required(module_name, result)
    if module_name == "config" then
      assert(type(result) == "table" and type(result.settings) == "table", "actual thirdparty config required")
      self.configuration = result
      -- Runtime configuration only: no write to native original/user settings.
      -- Saved preferences loaded later by engine/init.lua remain authoritative.
      if rawget(result.settings, "locale") == nil then result.settings.locale = preferred_locale or default_locale end
    elseif module_name == "engine.I18N" and not self.installation then
      assert(self.configuration, "observe original config before engine.I18N")
      assert(type(result) == "table" and type(result.loadLocale) == "function" and type(result.setLocale) == "function", "actual engine.I18N required")
      self.i18n = result
      local locale = rawget(self.configuration.settings, "locale") or default_locale
      -- Early engine classes may translate constants during require. Prime the
      -- original Japanese engine locale before those classes load. The native
      -- engine/init.lua repeats its own canonical load later; do not suppress it.
      -- This is presentation sequencing only, using the actual original loader.
      if locale == "ja_JP" then
        local file = "/data/locales/engine/ja_JP.lua"
        assert(type(fs) == "table" and type(fs.exists) == "function" and fs.exists(file), "original engine Japanese locale is not mounted")
        result:loadLocale(file)
        self.loaded_engine_file = file
      end
      result:setLocale(locale)
      self.installation = semantic.install(make_api(result))
    elseif module_name == "mod.class.Player" and not self.external_player_names_protected then
      -- Original Player inherits Actor:getName, which translates self.name as
      -- an NPC entity name. A user-given "bat" must remain "bat" while actual
      -- NPC bats still translate. Bind only this Player presentation method;
      -- never suppress matching strings globally or touch Actor/NPC methods.
      assert(type(result) == "table" and type(result.getName) == "function", "actual ToME Player class required")
      local original_player_get_name = result.getName
      result.getName = function(player, ...)
        if type(player.name) == "string" then return player.name end
        return original_player_get_name(player, ...)
      end
      self.external_player_names_protected = true
    end
    return result
  end

  function observer:status()
    return {installed=self.installation ~= nil, locale=active_locale(), loaded_engine_file=self.loaded_engine_file,
      external_player_names_protected=self.external_player_names_protected,
      semantic_host_required=true, runtime_verified=false}
  end

  -- Diagnostic presentation state only. This does not read any actor graph,
  -- call rendering, inspect RNG, or pretend observed IDs cover all declarations.
  function observer:coverage_snapshot()
    local counters, ids, events, unknown, quotas, retained, omitted = {}, {}, {}, {}, {}, {}, {}
    for key, value in pairs(coverage) do counters[key] = value end
    for id in pairs(seen_ids) do ids[#ids+1] = id end
    table.sort(ids)
    for index, event in ipairs(trace) do
      local copy = {}
      for key, value in pairs(event) do copy[key] = value end
      events[index] = copy
    end
    for index, entry in ipairs(unknown_records) do
      local copy = {}
      for key, value in pairs(entry) do copy[key] = value end
      unknown[index] = copy
    end
    for kind, quota in pairs(trace_quotas) do
      quotas[kind], retained[kind], omitted[kind] = quota, trace_retained[kind], trace_omitted[kind]
    end
    return {counters=counters, observed_semantic_ids=ids, bounded_events=events,
      event_quotas=quotas, events_retained_by_kind=retained, events_omitted_by_kind=omitted,
      unknown_callsite_inventory={entries=unknown, distinct_limit=unknown_limit, source_copy_limit_bytes=source_copy_limit,
        retained_distinct_count=#unknown, retained_occurrences=coverage.unmapped_occurrences_retained,
        omitted_occurrences=coverage.unmapped_occurrences_omitted,
        distinct_count_is_lower_bound=coverage.unmapped_occurrences_omitted > 0,
        exact_total_distinct_count_available=coverage.unmapped_occurrences_omitted == 0,
        full_source_bytes_observed=coverage.unmapped_source_bytes,
        source_copy_truncation="8192_byte_limit_at_utf8_boundary", long_source_identity_retains_original_string_key=true},
      locale=active_locale(), full_corpus_runtime_coverage_claimed=false}
  end

  -- A locale change in the original LanguageSelect saves/reboots the Lua state.
  -- Recreate this observer in that new VM. Do not relabel persisted actors or
  -- roll new random artifact names during rendering or language switching.
  return observer
end

return M
