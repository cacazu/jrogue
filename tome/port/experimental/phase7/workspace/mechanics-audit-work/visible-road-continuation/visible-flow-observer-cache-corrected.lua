-- SPDX-License-Identifier: GPL-3.0-or-later
-- Additive finite diagnostic reads; never calls original getters/rules/draw/FOV,
-- name resolution, reaction functions, callbacks, serialization or RNG.
-- Load/install only in a parent-approved isolated profile. Own allocations,
-- observer IDs and JSON scratch are outside the pure Rust/native heap bracket.
local M, arrays = {}, setmetatable({}, {__mode="k"})
local trace,trace_sequence,trace_omitted,hooks_installed={},0,0,false
local identities, next_identity = setmetatable({}, {__mode="k"}), 0
local function array(t) arrays[t]=true; return t end
local function object_id(object)
  if type(object)~="table" then return nil end
  if not identities[object] then next_identity=next_identity+1; identities[object]=next_identity end
  return identities[object] -- process-local diagnostic identity, not semantic ID
end
local function raw_resolve(object,key)
  local visited={}
  for _=1,32 do
    if type(object)~="table" or visited[object] then return nil end
    visited[object]=true
    local value=rawget(object,key); if value~=nil then return value end
    local mt=getmetatable(object)
    if type(mt)~="table" then return nil end
    object=rawget(mt,"__index")
    if type(object)~="table" then return nil end
  end
end
local function scalar(value)
  local t=type(value)
  if t=="string" or t=="boolean" then return value end
  if t=="number" and value==value and value~=math.huge and value~=-math.huge then return value end
end
local function fields(source,names)
  local out={}
  if type(source)=="table" then for _,name in ipairs(names) do out[name]=scalar(raw_resolve(source,name)) end end
  return out
end
local function cache_allow(player,actor)
  local cache=rawget(player,"can_see_cache")
  local entry=type(cache)=="table" and rawget(cache,actor)
  if type(entry)~="table" then return false end
  local ordinary,esp=rawget(entry,"nil/nil"),rawget(entry,"false/0")
  return (type(ordinary)=="table" and rawget(ordinary,1)==true) or
         (type(esp)=="table" and rawget(esp,1)==true)
end
-- A finite local navigation preflight, not pathfinding or production visibility.
-- Unknown/unseen tiles contain no terrain/actor facts. Absent actor disclosure
-- never proves an empty/passable tile. No canSee/FOV/block-move function runs.
local function visible_navigation(p,l,map,map_class)
  local out={available=false,production_visibility_complete=false,
    complete_actor_occupancy=false,passability_computed=false,cells=array({})}
  if type(p)~="table" or type(map)~="table" or type(map_class)~="table" then return out end
  local w,h,x,y=rawget(map,"w"),rawget(map,"h"),rawget(p,"x"),rawget(p,"y")
  local function integer(n) return type(n)=="number" and scalar(n)~=nil and n==math.floor(n) end
  if not integer(w) or not integer(h) or w<1 or h<1 or w>4096 or h>4096 or
    not integer(x) or not integer(y) or x<0 or y<0 or x>=w or y>=h then return out end
  local grids,seens=rawget(map,"map"),rawget(map,"seens")
  local terrain_layer,actor_layer=rawget(map_class,"TERRAIN"),rawget(map_class,"ACTOR")
  if type(grids)~="table" or type(seens)~="table" or not integer(terrain_layer) or not integer(actor_layer) then return out end
  out.available=true;out.width=w;out.height=h
  out.policy="current_seen_terrain_and_existing_cached_actor_allow_only"
  local offsets={{"left",-1,0},{"right",1,0},{"up",0,-1},{"down",0,1},
    {"left_up",-1,-1},{"right_up",1,-1},{"left_down",-1,1},{"right_down",1,1}}
  for _,d in ipairs(offsets) do
    local nx,ny=x+d[2],y+d[3]
    local cell={direction=d[1],x=nx,y=ny,in_bounds=nx>=0 and ny>=0 and nx<w and ny<h,visible=false}
    if cell.in_bounds then
      local index=nx+ny*w;local amount=rawget(seens,index)
      cell.visible=amount==true or (type(amount)=="number" and scalar(amount)~=nil and amount>0)
      if cell.visible then
        local tile=rawget(grids,index)
        if type(tile)=="table" then
          local terrain=rawget(tile,terrain_layer)
          cell.terrain=fields(terrain,{"uid","define_as","name","display","block_move",
            "change_level","change_zone","change_level_abs","force_down"})
          cell.passability="unknown_without_original_rule_call"
          local actor=rawget(tile,actor_layer)
          -- Missing/false cached results and absence of an actor both omit this
          -- object. No hidden occupancy bit or unreviewed hostile reaction.
          if type(actor)=="table" and cache_allow(p,actor) then
            local ax,ay=rawget(actor,"x"),rawget(actor,"y")
            if ax==nx and ay==ny then
              cell.actor=fields(actor,{"uid","name","x","y","life","max_life","die_at","dead","level"})
              cell.actor.visibility_confirmed=true;cell.actor.hostile_reaction_verified=false
            end
          end
        end
      end
    end
    out.cells[#out.cells+1]=cell
  end
  return out
end
function M.snapshot(target_uid)
  local g=rawget(_G,"game")
  local out={protocol=1,available=type(g)=="table",scope="original_flow_diagnostic_raw_reads",
    production_visibility_complete=false,actor_graph_serialization=false}
  if type(g)~="table" then return out end
  local p,l,z=rawget(g,"player"),rawget(g,"level"),rawget(g,"zone")
  out.game=fields(g,{"turn","paused","difficulty","permadeath","winner","energy_to_act"})
  out.game.identity=object_id(g)
  out.zone=fields(z,{"name","short_name","is_eidolon_plane"})
  out.zone.identity=object_id(z)
  out.level=fields(l,{"level","old_level","max_level"})
  out.level.identity=object_id(l)
  out.player=fields(p,{"uid","name","x","y","life","max_life","die_at","dead","died",
    "last_kill_turn","easy_mode_lifes","infinite_lifes","winner","level","can_change_level","can_change_zone"})
  if type(p)=="table" then
    out.player.energy=fields(rawget(p,"energy"),{"value","mod","used"})
    out.player.descriptor=fields(rawget(p,"descriptor"),{"world","difficulty","permadeath","subrace","subclass"})
    local deaths=rawget(p,"died_times")
    if type(deaths)=="table" then
      out.player.death_count=#deaths
      out.player.last_death=fields(rawget(deaths,#deaths),{"name","level","turn"})
    end
    out.player.killed_by=fields(rawget(p,"killedBy"),{"uid","name"})
  end
  local dialogs=rawget(g,"dialogs")
  out.dialogs=array({})
  if type(dialogs)=="table" then
    out.dialog_count=#dialogs
    for i=1,math.min(#dialogs,16) do
      local d=rawget(dialogs,i)
      local item=fields(d,{"__CLASSNAME","title","dont_show"})
      item.identity=object_id(d); out.dialogs[#out.dialogs+1]=item
    end
  end
  local map=type(l)=="table" and rawget(l,"map")
  local package_table=rawget(_G,"package")
  local loaded=type(package_table)=="table" and rawget(package_table,"loaded")
  local map_class=type(loaded)=="table" and rawget(loaded,"engine.Map")
  if type(map)=="table" and type(p)=="table" and type(map_class)=="table" then
    out.level.map_identity=object_id(map)
    local w,x,y=rawget(map,"w"),rawget(p,"x"),rawget(p,"y")
    local grids=rawget(map,"map")
    local terrain_layer,actor_layer=rawget(map_class,"TERRAIN"),rawget(map_class,"ACTOR")
    if type(w)=="number" and type(x)=="number" and type(y)=="number" and type(grids)=="table" and type(terrain_layer)=="number" then
      local tile=rawget(grids,x+y*w)
      out.current_terrain=fields(type(tile)=="table" and rawget(tile,terrain_layer),
        {"uid","define_as","name","display","change_level","change_zone","change_level_abs",
         "keep_old_lev","force_down","change_zone_auto_stairs","change_level_auto_stairs"})
    end
    out.target={requested_uid=scalar(target_uid),available=false,
      visibility_policy="existing_cached_allow_and_current_seen_only_not_complete_native_display_policy"}
    local entities=rawget(l,"entities")
    local actor=type(target_uid)=="number" and type(entities)=="table" and rawget(entities,target_uid)
    if type(actor)=="table" and type(actor_layer)=="number" and type(grids)=="table" then
      local ax,ay=rawget(actor,"x"),rawget(actor,"y")
      local seen=rawget(map,"seens")
      local index=type(ax)=="number" and type(ay)=="number" and type(w)=="number" and ax+ay*w
      local amount=index and type(seen)=="table" and rawget(seen,index)
      local tile=index and rawget(grids,index)
      if amount and amount~=0 and type(tile)=="table" and rawget(tile,actor_layer)==actor and cache_allow(p,actor) then
        out.target=fields(actor,{"uid","name","x","y","life","max_life","die_at","dead","level"})
        out.target.requested_uid=target_uid;out.target.available=true
        out.target.visibility_policy="existing_cached_allow_and_current_seen_only_not_complete_native_display_policy"
        out.target.hostile_reaction_verified=false -- no reaction callback in views
      end
    end
  end
  out.navigation=visible_navigation(p,l,map,map_class)
  out.causal_hooks_installed=hooks_installed
  out.trace_sequence=trace_sequence;out.trace_omitted=trace_omitted
  out.trace=array({})
  for i,event in ipairs(trace) do
    local copy={};for key,value in pairs(event) do copy[key]=scalar(value) end
    out.trace[i]=copy
  end
  return out
end
-- Explicit optional diagnostic preparation, NOT a view/query operation.
-- Uses original documented hook API, adds no actor fields and returns nil from
-- every listener. It never writes hook data, replaces methods or consumes RNG.
function M.install_causal_hooks()
  if hooks_installed then error("game_flow.error.observer",0) end
  local package_table=rawget(_G,"package")
  local loaded=type(package_table)=="table" and rawget(package_table,"loaded")
  local class=type(loaded)=="table" and rawget(loaded,"engine.class")
  local bind=type(class)=="table" and rawget(class,"bindHook")
  if type(bind)~="function" then error("game_flow.error.observer",0) end
  local function record(kind,self,data)
    local g=rawget(_G,"game")
    local event={sequence=trace_sequence+1,kind=kind,turn=type(g)=="table" and scalar(rawget(g,"turn")),
      actor_uid=type(self)=="table" and scalar(rawget(self,"uid"))}
    local target=type(data)=="table" and rawget(data,"target")
    local src=type(data)=="table" and rawget(data,"src")
    event.target_uid=type(target)=="table" and scalar(rawget(target,"uid"))
    event.source_uid=type(src)=="table" and scalar(rawget(src,"uid"))
    if type(data)=="table" then
      for _,key in ipairs({"hitted","crit","dam","value","noenergy","damtype","mult"}) do event[key]=scalar(rawget(data,key)) end
    end
    trace_sequence=trace_sequence+1
    if #trace>=256 then table.remove(trace,1);trace_omitted=trace_omitted+1 end
    trace[#trace+1]=event
    return nil -- preserves original hook aggregate/contract
  end
  bind(class,"Combat:attackTarget",function(self,data) return record("attack_target",self,data) end)
  bind(class,"Combat:attackTargetWith",function(self,data) return record("attack_result",self,data) end)
  bind(class,"Actor:takeHit",function(self,data) return record("incoming_damage_request",self,data) end)
  hooks_installed=true
  return true
end
local function quote(text)
  return '"'..text:gsub('[%z\1-\31\\"]',function(c)
    if c=='"' then return '\\"' end
    if c=='\\' then return '\\\\' end
    return ("\\u%04x"):format(c:byte())
  end)..'"'
end
local function encode(value,depth)
  if depth>12 then error("game_flow.error.observer",0) end
  local t=type(value)
  if t=="nil" then return "null"
  elseif t=="boolean" then return value and "true" or "false"
  elseif t=="number" then
    if scalar(value)==nil then error("game_flow.error.observer",0) end
    return tostring(value)
  elseif t=="string" then return quote(value)
  elseif t~="table" then error("game_flow.error.observer",0) end
  local parts={}
  if arrays[value] then
    for i=1,#value do parts[i]=encode(rawget(value,i),depth+1) end
    return "["..table.concat(parts,",").."]"
  end
  local keys={}; for key in pairs(value) do
    if type(key)~="string" then error("game_flow.error.observer",0) end
    keys[#keys+1]=key
  end
  table.sort(keys)
  for _,key in ipairs(keys) do parts[#parts+1]=quote(key)..":"..encode(rawget(value,key),depth+1) end
  return "{"..table.concat(parts,",").."}"
end
function M.snapshot_json(target_uid) return encode(M.snapshot(target_uid),0) end
function M.install()
  if rawget(_G,"__TOME_WEB_GAME_FLOW")~=nil then error("game_flow.error.observer",0) end
  _G.__TOME_WEB_GAME_FLOW=M
  return M
end
return M