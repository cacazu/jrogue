-- SPDX-License-Identifier: GPL-3.0-or-later
-- Actual post-birth presentation diagnostics. No actors/resources/locale tables
-- are created or modified. This invokes real text/name/font lookup functions;
-- observer telemetry changes, while simulation/RNG must remain unchanged.
local M={}
local function native_value(values,source,tag)
	local tagged=values[tag or "nil"]
	return tagged and tagged[source] or values["nil"] and values["nil"][source]
end
local function copy_order(order)
	local out={present=order~=nil,length=type(order)=="table" and #order or 0,entries={}}
	if type(order)=="table" then for index,value in pairs(order) do
		if type(index)=="number" and type(value)=="number" then out.entries[#out.entries+1]={index=index,argument=value} end
	end end
	table.sort(out.entries,function(left,right)return left.index<right.index end)
	return out
end
local function typed_arguments(source)
	local args={}
	local index=1
	while index<=#source do
		local start=source:find("%",index,true)
		if not start then break end
		if source:sub(start+1,start+1)=="%" then index=start+2
		else
			local spec,conversion=source:sub(start):match("^(%%[-+ #0%d%.]*([cdiouxXeEfgGqs]))")
			if not spec then return nil,"unsupported_original_printf_specifier" end
			local number=#args+1
			args[number]=(conversion=="s" or conversion=="q") and ("external_arg_"..number.."_bat") or (100+number)
			index=start+#spec
		end
	end
	if #args==0 or #args>12 then return nil,"unbounded_or_empty_original_arguments" end
	return args
end
function M.collect(observer)
	assert(type(observer)=="table" and observer.installation and observer.i18n,"Actual semantic observer must be installed")
	assert(type(game)=="table" and type(game.player)=="table","Actual original birth required")
	local player=game.player
	local locale,texts,orders,specials=observer.i18n:getLocalesData()
	local out={scope="actual_original_post_birth_text_diagnostics",locale=locale,
		complete_campaign_coverage=false,actor_graph_modified=false,original_gui_rendered_by_this_probe=false}
	local FontPackage=assert(package.loaded["engine.FontPackage"],"Actual FontPackage must already be loaded")
	local japanese
	for _,package in ipairs(FontPackage:list()) do if package.id=="japanese" then japanese=package end end
	local actual_font,size=FontPackage:getFont("default")
	out.font={japanese_package_loaded=japanese~=nil,actual_default_font=actual_font,size=size,
		actual_font_exists=type(actual_font)=="string" and fs.exists(actual_font) or false,
		matches_japanese_package=japanese and japanese.default and actual_font==japanese.default.font or false,
		break_text_all_character=not not _getFlagI18N("break_text_all_character")}
	out.player={name=player.name,get_name=player:getName(),native_entity_name_translation=_t(player.name,"entity name"),
		subclass=player.descriptor and player.descriptor.subclass,
		translated_subclass=player.descriptor and _t(player.descriptor.subclass,"birth descriptor name")}
	-- Use the existing original resource definitions. Pick a real translated
	-- resource whose UTF-8 length makes the original %.8s problem observable.
	local resource
	for _,definition in ipairs(player.resources_def or {}) do
		if type(definition.name)=="string" and #definition.name>8 and definition.name:find("[\128-\255]") then resource=definition;break end
	end
	out.precision={available=resource~=nil,probes={}}
	if resource then
		local probes={
			{id="game.modules.tome.mod.class.uiset.classicplayerdisplay.method.display.maketexturebar.tformat.parameter",source="%-8.8s:",
				file="game/modules/tome/mod/class/uiset/ClassicPlayerDisplay.lua",line=338,args={resource.name},expected=resource.name..string.char(239,188,154)},
			{id="game.modules.tome.mod.dialogs.charactersheet.method.drawdialog.tformat.parameter_parameter_parameter",source="%s%-8.8s: #00ff00#%s ",
				file="game/modules/tome/mod/dialogs/CharacterSheet.lua",line=673,args={resource.color or "#WHITE#",resource.name,"external_value_bat"},
				expected=(resource.color or "#WHITE#")..resource.name..string.char(239,188,154).." #00ff00#external_value_bat "},
		}
		for _,probe in ipairs(probes) do
			local resolved,reason=__TOME_SEMANTIC_RESOLVE(probe.source,"tformat",probe.file,probe.line,locale)
			local ok,value=pcall(string.tformat,probe.source,unpack(probe.args))
			out.precision.probes[#out.precision.probes+1]={id=probe.id,resolved_id=resolved and resolved.id,reason=reason,
				source=probe.source,source_file=probe.file,source_line=probe.line,arguments=probe.args,
				resource_name=resource.name,original_resource_key=resource.short_name,expected=probe.expected,
				ok=ok,result=value,unchanged_arguments=probe.args,passed=ok and value==probe.expected}
		end
	end
	-- Select actual active native special/order metadata, never manufacture it.
	-- Only finite original sources with known primitive printf types are probed.
	local candidates,seen={},{}
	local special_count,order_count=0,0
	for _,bucket in pairs(specials) do if type(bucket)=="table" then for source,value in pairs(bucket) do
		if value and type(source)=="string" and not seen[source] then seen[source]=true;candidates[#candidates+1]=source end
	end end end
	for _,bucket in pairs(orders) do if type(bucket)=="table" then for source,order in pairs(bucket) do
		if type(source)=="string" and type(order)=="table" and not seen[source] then seen[source]=true;candidates[#candidates+1]=source end
	end end end
	table.sort(candidates)
	local contracts={attempts={},verified_special=0,verified_order=0}
	for _,source in ipairs(candidates) do
		local special=not not native_value(specials,source,nil)
		local order=native_value(orders,source,"tformat")
		if special then order=native_value(orders,source,nil) end
		if special then special_count=special_count+1 end
		if type(order)=="table" then order_count=order_count+1 end
		if #contracts.attempts<12 then
			local resolved=__TOME_SEMANTIC_RESOLVE(source,"tformat",nil,nil,locale)
			local args,reason=typed_arguments(source)
			if resolved and not resolved.missing_official_japanese and args then
				local native_ok,native_result=pcall(observer.installation.original_tformat,source,unpack(args))
				local wrapped_ok,wrapped_result=pcall(string.tformat,source,unpack(args))
				local same=native_ok and wrapped_ok and native_result==wrapped_result
				contracts.attempts[#contracts.attempts+1]={source=source,id=resolved.id,arguments=args,active_native_special=special,
					active_native_order=copy_order(order),native_ok=native_ok,native_result=native_result,
					wrapped_ok=wrapped_ok,wrapped_result=wrapped_result,passed=same}
				if same and special then contracts.verified_special=contracts.verified_special+1 end
				if same and type(order)=="table" then contracts.verified_order=contracts.verified_order+1 end
			elseif reason then contracts.last_unprobed_reason=reason end
		end
	end
	contracts.active_special_sources=special_count
	contracts.active_order_sources=order_count
	contracts.no_synthetic_locale_metadata=true
	out.contracts=contracts
	return out
end
return M
