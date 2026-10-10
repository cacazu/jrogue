-- SPDX-License-Identifier: GPL-3.0-or-later
-- Read actual registered definitions; never instantiate/register a talent,
-- rename an actor, alter a locale table, run gameplay, draw, or consume RNG.
local M={}
local routes=assert(loadfile("/adapter/semantic-display/reviewed-routes.lua"))()
function M.collect(bridge)
  assert(type(bridge)=="table" and bridge.ready,"Actual original birth required")
  local Talents=assert(package.loaded["engine.interface.ActorTalents"],"Actual original ActorTalents required")
  local Faction=assert(package.loaded["engine.Faction"],"Actual original Faction required")
  local ObjectUse=assert(package.loaded["mod.class.interface.ActorObjectUse"],"Actual original object activation interface required")
  local I18N=assert(package.loaded["engine.I18N"],"Actual original I18N required")
  local locale=I18N:getLocalesData()
  local out={scope="actual_original_registered_display_names",source_commit=routes.source_commit,
    overlay_mounted=bridge.semantic_display_overlay_mounted==true,locale=locale,
    constant_seed=ObjectUse.base_object_talent_name,activation_limit=ObjectUse.max_object_use_talents,
    actor_graph_modified=false,gameplay_called=false,rng_called=false,synthetic_registration=false,
    actual_player={name=game.player.name,get_name=game.player:getName()},labels={},opaque_placeholders={}}
  for _,route in ipairs(routes.labels) do
    local row={semantic_id=route.semantic_id,source=route.source,tag=route.tag,native_identities={}}
    for _,short_name in ipairs(route.stable_short_names) do
      if route.tag=="faction name" then
        local definition=Faction.factions[short_name]
        row.native_identities[#row.native_identities+1]={present=definition~=nil,short_name=definition and definition.short_name,
          name=definition and definition.name,lookup_key=short_name,kind="faction"}
      else
        local id="T_"..short_name
        local definition=Talents.talents_def[id]
        row.native_identities[#row.native_identities+1]={present=definition~=nil,short_name=definition and definition.short_name,
          id=definition and definition.id,name=definition and definition.name,lookup_key=id,
          class_constant=Talents[id],class_constant_source="actual_original_talent_registration_owner",inherited_player_constant=game.player[id],kind="talent"}
      end
    end
    -- A genuine _t call in THIS diagnostic module must not acquire a built-in
    -- display owner's translation merely because the English value is equal.
    row.actual_wrong_context_translation=_t(route.source,route.tag)
    -- Exercise the actual C/Lua resolver transport with only the native tag
    -- changed. Caller coordinates are explicit negative-test parameters; they
    -- do not pretend this is another positive production registration call.
    local negative,reason=__TOME_SEMANTIC_RESOLVE(route.source,"entity name",
      route.overlay_consumer.file,route.overlay_consumer.line,locale)
    row.native_wrong_tag={resolved=negative~=nil,reason=reason,explicit_negative_transport_probe=true}
    out.labels[#out.labels+1]=row
  end
  for _,source in ipairs(routes.opaque_placeholders) do
    local short_name=source:upper():gsub("[ ']","_")
    local id="T_"..short_name
    local definition=Talents.talents_def[id]
    out.opaque_placeholders[#out.opaque_placeholders+1]={source=source,id=id,present=definition~=nil,
      name=definition and definition.name,short_name=definition and definition.short_name,
      policy="retain_exact_original_opaque_name",finished_name_or_mechanics_invented=false}
  end
  return out
end
return M
