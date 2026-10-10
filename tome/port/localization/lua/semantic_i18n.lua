-- GPL-3.0-or-later. Presentation adapter for the retained original I18N seam.
-- No gameplay, RNG, external parameter values or original source are modified.
local M = {}

-- The active original tables are authoritative. Their shared "nil" buckets and
-- whole-tag metadata resets depend on actual locale load order, not section IDs.
function M.native_contracts(i18n)
  assert(type(i18n) == "table" and type(i18n.getLocalesData) == "function", "original engine.I18N instance required")
  local function get(values, source, tag)
    local tagged = values[tag or "nil"]
    return tagged and tagged[source] or values["nil"] and values["nil"][source]
  end
  return function(source, tag)
    local locale, texts, arguments, specials = i18n:getLocalesData()
    return { locale=locale, template=get(texts, source, tag or "_t") or source,
      args_order=get(arguments, source, tag), special_gate=not not get(specials, source, nil),
      special_args_order=get(arguments, source, nil), special=get(specials, source, "tformat") }
  end
end

local function same_native_order(native, semantic)
  if native == nil then return #semantic == 0 end
  -- An explicitly present empty/sparse table is meaningful to native Lua.
  if type(native) ~= "table" or #native == 0 or #native ~= #semantic then return false end
  local count = 0
  for key, value in pairs(native) do
    if type(key) ~= "number" or key % 1 ~= 0 or key < 1 or key > #semantic or semantic[key] ~= value then return false end
    count = count + 1
  end
  return count == #semantic
end

local function caller()
  if not debug or not debug.getinfo then return nil, nil end
  local info = debug.getinfo(4, "Sl")
  return info and info.source, info and info.currentline
end

function M.install(api)
  assert(type(api) == "table" and type(api.resolve) == "function", "semantic text resolver required")
  assert(type(_G._t) == "function" and type(string.tformat) == "function", "install after engine.I18N")
  local original_t, original_tformat = _G._t, string.tformat
  local native_depth = 0
  local function native_format(source, ...)
    native_depth = native_depth + 1
    local count, result = 0, nil
    local function pack(...) count = select("#", ...); return {...} end
    result = pack(pcall(original_tformat, source, ...))
    native_depth = native_depth - 1
    if not result[1] then error(result[2], 0) end
    return unpack(result, 2, count)
  end
  local function allow_override(result)
    return api.allow_native_template_override and api.allow_native_template_override(result) or false
  end
  local function resolve(source, tag)
    local file, line = caller()
    local result, reason = api.resolve(source, tag, file, line)
    if not result then
      if api.on_unmapped then api.on_unmapped(source, tag, file, line, reason) end
      return nil
    end
    if result.missing_official_japanese and api.on_missing_japanese then api.on_missing_japanese(result.id) end
    return result
  end
  _G._t = function(source, tag)
    if native_depth > 0 then return original_t(source, tag) end
    if source == nil then return nil end
    if type(source) ~= "string" then return original_t(source, tag) end
    local result = resolve(source, tag or "_t")
    if result and api.native_contract then
      local contract = api.native_contract(source, tag or "_t")
      if contract.template ~= result.template and not allow_override(result) then
        if api.on_native_delegate then api.on_native_delegate(result.id, "active_native_template") end
        return original_t(source, tag)
      end
    end
    return result and result.template or original_t(source, tag)
  end
  string.tformat = function(source, ...)
    local result = resolve(source, "tformat")
    if not result then return native_format(source, ...) end
    local contract = api.native_contract and api.native_contract(source, "tformat")
    local reason = result.delegate_native_special and "special" or result.delegate_native_format_review and "format_review"
    if contract then
      reason = contract.special_gate and "special" or reason
      if contract.template ~= result.template and not allow_override(result) then reason = reason or "active_native_template" end
      if not same_native_order(contract.args_order, result.args_order or {}) then reason = reason or "active_native_argument_order" end
    end
    if reason then
      if api.on_native_delegate then api.on_native_delegate(result.id, reason) end
      return native_format(source, ...)
    end
    local count = select("#", ...)
    local arguments = {...}
    local order = result.args_order or {}
    if #order > 0 then
      local reordered = {}
      for index, original_index in ipairs(order) do
        assert(type(original_index) == "number" and original_index % 1 == 0 and original_index >= 1 and original_index <= count, "semantic printf argument index out of range")
        reordered[index] = arguments[original_index]
      end
      return string.format(result.template, unpack(reordered, 1, #order))
    end
    return string.format(result.template, unpack(arguments, 1, count))
  end
  -- _nt is deliberately unchanged: upstream documents it as catalogue-only.
  return {
    uninstall = function() _G._t = original_t; string.tformat = original_tformat end,
    original_t = original_t,
    original_tformat = original_tformat,
  }
end

-- Portable Lua host implementation of the same immutable JSON registry contract.
-- JSON decoding is supplied by the platform; generated runtime-catalog.lua can
-- also provide these tables when a native JSON binding is unavailable.
function M.catalogue(en, ja, registry, options)
  options = options or {}
  local locale = options.locale or "ja_JP"
  local routes, by_source = {}, {}
  for _, route in ipairs(registry.routes) do
    routes[route.source] = routes[route.source] or {}
    assert(not routes[route.source][route.tag], "duplicate original source/tag route")
    routes[route.source][route.tag] = route
    by_source[route.source] = by_source[route.source] or {}
    table.insert(by_source[route.source], route)
  end
  local function by_id(id)
    local entry = registry.entries[id]
    if not entry or type(en[id]) ~= "string" then return nil, "unknown_semantic_id" end
    -- JSON decoders may represent null as a sentinel object instead of nil.
    local has_japanese = type(ja[id]) == "string"
    -- Lua treats "" as a present translation (articles/pronouns/suffixes).
    local japanese = locale == "ja_JP" and has_japanese
    return { id=id, template=japanese and ja[id] or en[id], owner=entry.owner, tag=entry.tag,
      args_order=japanese and entry.japanese_args_order or {},
      missing_official_japanese=locale == "ja_JP" and not has_japanese,
      delegate_native_special=japanese and #(entry.special_tokens or {}) > 0,
      delegate_native_format_review=japanese and not entry.printf_contract.safe }
  end
  local function same_arguments(a, b)
    if #a ~= #b then return false end
    for index, value in ipairs(a) do if value ~= b[index] then return false end end
    return true
  end
  local function select_route(route, file, line)
    file = file and file:gsub("^@", ""):gsub("\\", "/"):gsub("^/+", "")
    local selected, distance
    if file then
      for _, id in ipairs(route.aliases) do
        local entry = registry.entries[id]
        for _, location in ipairs(entry.source_locations or {}) do
          if location.file == file or location.file:sub(-#file - 1) == "/" .. file or file:sub(-#location.file - 1) == "/" .. location.file then
            local delta = type(line) == "number" and type(location.line) == "number" and math.abs(line - location.line) or math.huge
            if not selected or delta < distance or delta == distance and id < selected then selected, distance = id, delta end
          end
        end
      end
    end
    selected = selected or type(route.default_id) == "string" and route.default_id
    if not selected then return nil, "ambiguous_owner_format_context" end
    return by_id(selected)
  end
  local result = {
    resolve = function(source, tag, file, line)
      local tags = routes[source]
      if tags and tags[tag] then return select_route(tags[tag], file, line) end
      local selected
      for _, route in ipairs(by_source[source] or {}) do
        local candidate, reason = select_route(route, file, line)
        if not candidate then return nil, reason end
        if selected and (selected.template ~= candidate.template or not same_arguments(selected.args_order, candidate.args_order) or selected.delegate_native_special ~= candidate.delegate_native_special or selected.delegate_native_format_review ~= candidate.delegate_native_format_review) then return nil, "ambiguous_tag_fallback" end
        selected = selected or candidate
      end
      return selected, selected and nil or "unknown_source_tag"
    end,
    resolve_id = by_id,
    get_locale = function() return locale end,
    set_locale = function(next_locale)
      assert(next_locale == "ja_JP" or next_locale == "en_US", "unsupported semantic catalogue locale")
      locale = next_locale
      if options.sync_native_locale then options.sync_native_locale(next_locale) end
    end,
    japanese_configuration = registry.japanese_configuration,
    on_unmapped = options.on_unmapped,
    on_missing_japanese = options.on_missing_japanese,
    on_native_delegate = options.on_native_delegate,
    native_contract = options.native_contract or options.native_i18n and M.native_contracts(options.native_i18n),
    allow_native_template_override = options.allow_native_template_override,
  }
  if options.sync_native_locale then options.sync_native_locale(locale) end
  return result
end

return M
