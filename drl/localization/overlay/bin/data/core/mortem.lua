-- Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.
core.declare( "mortem", {} )

mortem.Pronoun = "He"

function mortem.version_string( v )
	local result = v[1].."."..v[2].."."..v[3]
	if v[4] then result = result.."."..v[4] end
	return result
end

function mortem.padded( str, size )
    return str..string.rep(" ",math.max(0,size - string.len(str)) )
end

function mortem.get_death_description( killedby, killedmelee, highscore, reasons )
	if reasons and reasons[killedby] then
		return reasons[killedby]
	end

	local killer = beings[killedby]
	if not killer then return nil end
	if not highscore then
		local description
		if killedmelee then
			description = killer.kill_desc_melee
		else
			description = killer.kill_desc
		end
		if description then return description end
	end
	return "killed by "..killer.name
end


function mortem.print_time_and_kills()
    player:mortem_print(ui.semantic_text("mortem.summary.turns-score"," {{subject}} survived {!{{turns}}} turns and scored {!{{score}}} points. ",{{name="subject",kind="string",value=(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)},{name="turns",kind="integer",value=statistics.game_time},{name="score",kind="integer",value=player.score}}))
	player:mortem_print(ui.semantic_text("mortem.summary.duration"," {{subject}} played for {!{{duration}}}. ",{{name="subject",kind="string",value=(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)},{name="duration",kind="string",value=ui.mortem_duration(math.floor(statistics.real_time))}}))
	player:mortem_print(ui.semantic_text("mortem.summary.difficulty"," {{description}}",{{name="description",kind="string",value=ui.registry_text("difficulty", diff[DIFFICULTY].id, "base_game", "description", diff[DIFFICULTY].description)}}))
	player:mortem_print(ui.semantic_text("mortem.summary.seed"," Game seed was {!{{seed}}}.",{{name="seed",kind="integer",value=GAME_SEED}}))
	player:mortem_print()


	local k   = statistics.kills
	local mk  = statistics.max_kills
	local uk  = statistics.unique_kills
	local muk = statistics.max_unique_kills
	local ratio = uk / muk

	player:mortem_print(ui.semantic_text("mortem.summary.unique-kills"," {{subject}} killed {!{{killed}}} out of {!{{encountered}}} encountered hellspawn. ({!{{percent}}%})",{{name="subject",kind="string",value=(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)},{name="killed",kind="integer",value=uk},{name="encountered",kind="integer",value=muk},{name="percent",kind="integer",value=math.floor(ratio*100)}}))
	if uk ~= k or muk ~= mk then
		player:mortem_print(ui.semantic_text("mortem.summary.total-spawns"," {{subject}} killed {!{{killed}}} out of {!{{spawned}}} enemy spawns total.",{{name="subject",kind="string",value=(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)},{name="killed",kind="integer",value=k},{name="spawned",kind="integer",value=mk}}))
	end
end

function mortem.print_challenge()
	if CHALLENGE ~= "" then
		if ARCHANGEL then
			player:mortem_print(ui.semantic_text("mortem.challenge.archangel"," {{subject}} was an {!{{challenge}}}!",{{name="subject",kind="string",value=(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)},{name="challenge",kind="string",value=ui.registry_text("challenge", chal[CHALLENGE].id, "base_game", "arch_name", chal[CHALLENGE].arch_name)}}))
		else
			player:mortem_print(ui.semantic_text("mortem.challenge.angel"," {{subject}} was an {!{{challenge}}}!",{{name="subject",kind="string",value=(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)},{name="challenge",kind="string",value=ui.registry_text("challenge", chal[CHALLENGE].id, "base_game", "name", chal[CHALLENGE].name)}}))
		end
		if SCHALLENGE ~= "" then
			player:mortem_print(ui.semantic_text("mortem.challenge.secondary"," {{subject}} was also an {!{{challenge}}}!",{{name="subject",kind="string",value=(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)},{name="challenge",kind="string",value=ui.registry_text("challenge", chal[SCHALLENGE].id, "base_game", "name", chal[SCHALLENGE].name)}}))
		end
	end
end

function mortem.print_crash_save()
    local function times( n )
		if n <= 1 then return "once" else return n.." times" end
	end

	if statistics.save_count > 0 or statistics.crash_count > 0 then
		player:mortem_print()
		if statistics.crash_count > 0 then
			player:mortem_print(ui.semantic_text("mortem.summary.crashes"," The world crashed {!{{frequency}}}.",{{name="frequency",kind="string",value=ui.mortem_times(statistics.crash_count)}}))
		end
		if statistics.save_count > 0 then
			player:mortem_print(ui.semantic_text("mortem.summary.saves"," {{subject}} saved {!{{frequency}}}.",{{name="subject",kind="string",value=(mortem.Pronoun == "He" and ui.semantic_text("mortem.subject.he", "He", {}) or mortem.Pronoun)},{name="frequency",kind="string",value=ui.mortem_times(statistics.save_count)}}))
		end
	end
end

function mortem.print_special_levels()
    player:mortem_print(ui.semantic_text("mortem.special-levels.generated","  Levels generated : {!{{count}}}",{{name="count",kind="integer",value=statistics.bonus_levels_count}}))
    player:mortem_print(ui.semantic_text("mortem.special-levels.visited","  Levels visited   : {!{{count}}}",{{name="count",kind="integer",value=statistics.bonus_levels_visited}})) 
    player:mortem_print(ui.semantic_text("mortem.special-levels.completed","  Levels completed : {!{{count}}}",{{name="count",kind="integer",value=statistics.bonus_levels_completed}}))
end

function mortem.print_awards( awards_only )
	local awarded = false

	if not awards_only then
		for k,v in ipairs( medals ) do
			if player:has_medal( v.id ) then
				player:mortem_print(ui.semantic_text("mortem.awards.medal","  {!{{name}}} {{description}}",{{name="name",kind="string",value=ui.mortem_pad(ui.registry_text("medal", v.id, "base_game", "name", v.name),26)},{name="description",kind="string",value=ui.registry_text("medal", v.id, "base_game", "desc", v.desc)}}))
				awarded = true
			end
		end

		for k,v in ipairs( badges ) do
			if player:has_badge( v.id ) then
				player:mortem_print(ui.semantic_text("mortem.awards.badge","  {!{{name}}} {{description}}",{{name="name",kind="string",value=ui.mortem_pad(ui.registry_text("badge", v.id, "base_game", "name", v.name),26)},{name="description",kind="string",value=ui.registry_text("badge", v.id, "base_game", "desc", v.desc)}}))
				awarded = true
			end
		end
	end

	for k,v in ipairs( awards ) do
		if player:has_award( v.id ) then
			player:mortem_print(ui.semantic_text("mortem.awards.rank","  {!{{name}}} ({!{{tier}}})",{{name="name",kind="string",value=ui.registry_text("award", v.id, "base_game", "name", v.name)},{name="tier",kind="string",value=ui.mortem_award_tier(v,player:get_award(v.id))}}))
			awarded = true
		end
	end

	if not awarded then
		player:mortem_print(ui.semantic_text("mortem.awards.none","  None",{}))
	end
end

function mortem.print_graveyard()
	-- TODO This would be a good place to use utf-8 expansions for the high-ascii text.
	local function get_pic( c )
		local being = level:get_being( c )
		if being then
			if string.char(being.picture) == '@' then return 'X' end
			return string.char(being.picture)
		end
		local item = level:get_item( c )
		if item then
			return string.char(item.picture)
		end
		local cell = level:get_cell( c )
		return cells[ cell ].asciilow
	end

	for vy = 1,MAXY do
		local line = "  "
		for vx = math.min( 20, math.max( 1,player.x - 30 ) ), math.min( 20, math.max(1,player.x - 30 ) ) + MAXX - 20 do
			line = line..get_pic( coord( vx, vy ) )
		end
		player:mortem_print( line )
	end
end

function mortem.print_statistics()
	local function bonus( val ) if val < 0 then return "{!"..val.."}" else return "{!+"..val.."}" end end

	player:mortem_print(ui.semantic_text("mortem.statistics.health-experience","  Health {!{{health}}}/{!{{maximum_health}}}   Experience {!{{experience}}}/{!{{level}}}",{{name="health",kind="integer",value=player.hp},{name="maximum_health",kind="integer",value=player.hpmax},{name="experience",kind="integer",value=player.exp},{name="level",kind="integer",value=player.explevel}}))
	player:mortem_print(ui.semantic_text("mortem.statistics.combat-bonuses","  ToHit Ranged {{ranged_hit}}  ToHit Melee {{melee_hit}}  ToDmg Ranged {{ranged_damage}}  ToDmg Melee {{melee_damage}}",{{name="ranged_hit",kind="string",value=bonus( player:get_tohit() )},{name="melee_hit",kind="string",value=bonus( player:get_tohit(true) )},{name="ranged_damage",kind="string",value=bonus( player:get_todam() )},{name="melee_damage",kind="string",value=bonus( player:get_todam(true) )}}))
end

function mortem.print_damage_and_spree()
	player:mortem_print()
	player:mortem_print(ui.semantic_text("mortem.statistics.damage-taken","  Damage taken       : {!{{count}}}",{{name="count",kind="integer",value=statistics.damage_taken}}))
	player:mortem_print(ui.semantic_text("mortem.statistics.longest-kill-spree","  Longest kill spree : {!{{count}}}",{{name="count",kind="integer",value=statistics.kills_non_damage}}))
end

function mortem.print_traits()
    if klasses.__counter > 1 then
        player:mortem_print(ui.semantic_text("mortem.traits.class","  Class : {!{{klass}}}",{{name="klass",kind="string",value=ui.registry_text("klass", klasses[player.klass].id, "base_game", "name", klasses[player.klass].name)}}))
	    player:mortem_print()
    end

	for i = 1,traits.__counter do
		local value = player:get_trait(i)
		if value > 0 and traits[i].name ~= "" then
			player:mortem_print(ui.semantic_text("mortem.traits.entry","    {{trait}} (Level {!{{level}}})",{{name="trait",kind="string",value=ui.mortem_pad(ui.registry_text("trait", traits[i].id, "base_game", "name", traits[i].name),16)},{name="level",kind="integer",value=value}}))
		end
	end

	if player.explevel > 1 then
		player:mortem_print()
		player:mortem_print(ui.semantic_text("mortem.traits.history","  {{history}}",{{name="history",kind="string",value=ui.mortem_trait_history(player,player:get_trait_hist())}}))
	end
end

function mortem.item_desc( item )
	return item.desc
end

function mortem.print_equipment( item_desc )
	item_desc = item_desc or mortem.item_desc
	local slot_name = { "[ Armor      ]", "[ Weapon     ]", "[ Boots      ]", "[ Prepared   ]", "[ Relic      ]" }
	local eq_size = core.options.relic_slot and MAX_EQ_SIZE or (MAX_EQ_SIZE - 1)

	for i = 0,eq_size-1 do
		local it = player.eq[i]
		if it then
			player:mortem_print(ui.semantic_text("mortem.equipment.item","    {{slot}}   {!{{item}}}",{{name="slot",kind="string",value=ui.mortem_slot(i,slot_name[i+1])},{name="item",kind="string",value=(item_desc == mortem.item_desc and ui.item_description(it) or item_desc(it))}}))
		else
			player:mortem_print(ui.semantic_text("mortem.equipment.empty","    {{slot}}   nothing",{{name="slot",kind="string",value=ui.mortem_slot(i,slot_name[i+1])}}))
		end
	end
end

function mortem.print_inventory( item_desc )
	item_desc = item_desc or mortem.item_desc
    local items = {}

	for it in player.inv:items() do
		local _mortem_itype,_mortem_nid=it.itype,it.__proto.nid
        local _mortem_desc=item_desc(it)
        local _mortem_presentation_desc=_mortem_desc
        if item_desc==mortem.item_desc then _mortem_presentation_desc=ui.item_description(it) end
        table.insert(items,{itype=_mortem_itype,nid=_mortem_nid,desc=_mortem_desc,presentation_desc=_mortem_presentation_desc})
	end

	table.sort( items, function(a,b) if (a.itype ~= b.itype) then return a.itype < b.itype else return a.nid < b.nid end end )

	for k,v in ipairs(items) do
		player:mortem_print(ui.semantic_text("mortem.inventory.item","    {{description}}",{{name="description",kind="string",value=v.presentation_desc or v.desc}}))
	end
end

mortem.resistance_count = 0

function mortem.print_resistance( name )
    local internal = player.resist[name] or 0
    local torso    = player:get_total_resistance(name, TARGET_TORSO)
    local feet     = player:get_total_resistance(name, TARGET_FEET)

    if internal == 0 and torso == 0 and feet == 0 then return end

    player:mortem_print(ui.semantic_text("mortem.resistances.entry","    {{damage}} - internal {!{{internal}}} torso {!{{torso}}} feet {!{{feet}}}",{{name="damage",kind="string",value=ui.mortem_pad(ui.mortem_damage_name(name),10)},{name="internal",kind="string",value=mortem.padded( internal.."%", 5 )},{name="torso",kind="string",value=mortem.padded( torso.."%", 5 )},{name="feet",kind="string",value=mortem.padded( feet.."%", 5 )}}))

    mortem.resistance_count = mortem.resistance_count + 1
end

function mortem.print_resistances()
    mortem.resistance_count = 0
	mortem.print_resistance( "bullet" )
	mortem.print_resistance( "melee" )
	mortem.print_resistance( "shrapnel" )
	mortem.print_resistance( "acid" )
	mortem.print_resistance( "fire" )
	mortem.print_resistance( "cold" )
	mortem.print_resistance( "poison" )
	mortem.print_resistance( "plasma" )
	if mortem.resistance_count == 0 then
		player:mortem_print(ui.semantic_text("mortem.resistances.none","    None",{}))
	end
end

function mortem.print_kills()
	for _,b in ipairs( beings ) do
		local kills = kills.get(b.id)
		if kills > 0 then
			if kills == 1 then
				player:mortem_print(ui.semantic_text("mortem.kills.singular","    {!1} {{enemy}}",{{name="enemy",kind="string",value=ui.registry_text("being", b.id, "base_game", "name", b.name)}}))
			else
				player:mortem_print(ui.semantic_text("mortem.kills.plural","    {!{{count}}} {{enemy}}",{{name="count",kind="integer",value=kills},{name="enemy",kind="string",value=ui.registry_text("being", b.id, "base_game", "name_plural", b.name_plural)}}))
			end
		end
	end
end

function mortem.print_weapon_kills( groups, names )
	for index,group in ipairs( groups ) do
		local count = core.kills_count_group( group )
		if count > 0 then
			player:mortem_print(ui.semantic_text("mortem.kills.weapon-group","    {{group}}{!{{count}}}",{{name="group",kind="string",value=ui.mortem_weapon_group(groups[index],names[index])},{name="count",kind="integer",value=count}}))
		end
	end

	local unarmed = kills.get_type( "melee" )
	local other = kills.get_type( "other" )
	if unarmed > 0 or other > 0 then
		player:mortem_print()
	end

	if unarmed > 0 then
		player:mortem_print(ui.semantic_text("mortem.kills.unarmed","    Unarmed kills  : {!{{count}}}",{{name="count",kind="integer",value=unarmed}}))
	end

	if other > 0 then
		player:mortem_print(ui.semantic_text("mortem.kills.other","    Other kills    : {!{{count}}}",{{name="count",kind="integer",value=other}}))
	end
end

function mortem.print_history()
	for history_index,v in pairs( player.__props.history ) do
		player:mortem_print( "  "..ui.presentation_history(history_index, v) )
	end
end

function mortem.print_messages()
	for i = 15,0,-1 do
		local msg = ui.msg_history(i)
		if msg then player:mortem_print( " ".. msg ) end
	end
end

-- DRL semantic presentation overlay; original mortem functions above are retained.
do
 local function semantic(id,english,params)
  return ui.semantic_text(id,english,params or {})
 end
 function ui.mortem_pad(text,columns)
  if ui.presentation_pad then return ui.presentation_pad(text,columns) end
  -- ASCII fallback only. UTF-8 text is never measured in bytes or truncated.
  if not string.find(text,"[^%z\1-\127]") then return mortem.padded(text,columns) end
  return text
 end
 function ui.mortem_times(count)
  if count <= 1 then return ui.semantic_text("mortem.frequency.once","once",{}) end
  return ui.semantic_text("mortem.frequency.multiple","{{count}} times",{{name="count",kind="integer",value=count}})
 end
 local trait_history_records={["trait_marine"]={english="",id="mortem.trait-history.trait-marine.abbreviation"},["ironman"]={english="Iro",id="mortem.trait-history.ironman.abbreviation"},["finesse"]={english="Fin",id="mortem.trait-history.finesse.abbreviation"},["hellrunner"]={english="HR",id="mortem.trait-history.hellrunner.abbreviation"},["nails"]={english="TaN",id="mortem.trait-history.nails.abbreviation"},["bitch"]={english="SoB",id="mortem.trait-history.bitch.abbreviation"},["gun"]={english="SoG",id="mortem.trait-history.gun.abbreviation"},["reloader"]={english="Rel",id="mortem.trait-history.reloader.abbreviation"},["eagle"]={english="EE",id="mortem.trait-history.eagle.abbreviation"},["brute"]={english="Bru",id="mortem.trait-history.brute.abbreviation"},["juggler"]={english="Jug",id="mortem.trait-history.juggler.abbreviation"},["berserker"]={english="Ber",id="mortem.trait-history.berserker.abbreviation"},["dualgunner"]={english="DG",id="mortem.trait-history.dualgunner.abbreviation"},["dodgemaster"]={english="DM",id="mortem.trait-history.dodgemaster.abbreviation"},["intuition"]={english="Int",id="mortem.trait-history.intuition.abbreviation"},["whizkid"]={english="WK",id="mortem.trait-history.whizkid.abbreviation"},["badass"]={english="Bad",id="mortem.trait-history.badass.abbreviation"},["shottyman"]={english="SM",id="mortem.trait-history.shottyman.abbreviation"},["triggerhappy"]={english="TH",id="mortem.trait-history.triggerhappy.abbreviation"},["blademaster"]={english="MBm",id="mortem.trait-history.blademaster.abbreviation"},["vampyre"]={english="MVm",id="mortem.trait-history.vampyre.abbreviation"},["malicious"]={english="MMB",id="mortem.trait-history.malicious.abbreviation"},["bulletdance"]={english="MBD",id="mortem.trait-history.bulletdance.abbreviation"},["gunkata"]={english="MGK",id="mortem.trait-history.gunkata.abbreviation"},["sharpshooter"]={english="MSs",id="mortem.trait-history.sharpshooter.abbreviation"},["armydead"]={english="MAD",id="mortem.trait-history.armydead.abbreviation"},["shottyhead"]={english="MSh",id="mortem.trait-history.shottyhead.abbreviation"},["fireangel"]={english="MFa",id="mortem.trait-history.fireangel.abbreviation"},["ammochain"]={english="MAc",id="mortem.trait-history.ammochain.abbreviation"},["cateye"]={english="MCe",id="mortem.trait-history.cateye.abbreviation"},["entrenchment"]={english="MEn",id="mortem.trait-history.entrenchment.abbreviation"},["survivalist"]={english="MSv",id="mortem.trait-history.survivalist.abbreviation"},["runningman"]={english="MRM",id="mortem.trait-history.runningman.abbreviation"},["gunrunner"]={english="MGr",id="mortem.trait-history.gunrunner.abbreviation"},["scavenger"]={english="MSc",id="mortem.trait-history.scavenger.abbreviation"}}
 function ui.mortem_trait_history(subject,english)
  local getter=subject.get_trait_history_ids
  if not getter then return english end
  local ids=getter(subject)
  local original_parts,records={},{}
  for _,index in ipairs(ids) do
   local trait=traits[index]
   local record=trait and trait_history_records[trait.id]
   if not record or record.english~=trait.abbr then return english end
   table.insert(original_parts,record.english.."->")
   table.insert(records,record)
  end
  if table.concat(original_parts,"")~=english then return english end
  local presentation_parts={}
  for _,record in ipairs(records) do table.insert(presentation_parts,semantic(record.id,record.english).."->") end
  return table.concat(presentation_parts,"")
 end
 function ui.mortem_duration(seconds)
  local original=core.seconds_to_string(seconds)
  if seconds <= 0 then
   if original == "0 seconds" then return ui.semantic_text("mortem.duration.zero","0 seconds",{}) end
   return original
  end
  local counts={math.floor(seconds/(60*60*24)),math.floor(seconds/(60*60))%24,math.floor(seconds/60)%60,seconds%60}
  local units={"day","hour","minute","second"}
  local original_parts,presentation_parts={},{}
  for index,count in ipairs(counts) do
   if count ~= 0 then
    local unit=units[index]
    local plural=count>1
    local english="{{count}} "..unit..(plural and "s" or "")
    table.insert(original_parts,count.." "..unit..(plural and "s" or ""))
    table.insert(presentation_parts,semantic("mortem.duration."..unit..(plural and ".plural" or ".singular"),english,{{name="count",kind="integer",value=count}}))
   end
  end
  if #original_parts>1 then
   original_parts[#original_parts-1]=original_parts[#original_parts-1].." and "..original_parts[#original_parts]
   presentation_parts[#presentation_parts-1]=presentation_parts[#presentation_parts-1]..ui.semantic_text("mortem.duration.and"," and ",{})..presentation_parts[#presentation_parts]
   table.remove(original_parts);table.remove(presentation_parts)
  end
  if table.concat(original_parts,", ") ~= original then return original end
  return table.concat(presentation_parts,ui.semantic_text("mortem.duration.separator",", ",{}))
 end
 local slot_records={{english="[ Armor      ]",id="mortem.slot.armor"},{english="[ Weapon     ]",id="mortem.slot.weapon"},{english="[ Boots      ]",id="mortem.slot.boots"},{english="[ Prepared   ]",id="mortem.slot.prepared"},{english="[ Relic      ]",id="mortem.slot.relic"}}
 function ui.mortem_slot(index,english)
  local record=slot_records[index+1]
  if record and record.english==english then return semantic(record.id,english) end
  return english
 end
 local damage_records={["bullet"]="mortem.damage.bullet",["melee"]="mortem.damage.melee",["shrapnel"]="mortem.damage.shrapnel",["acid"]="mortem.damage.acid",["fire"]="mortem.damage.fire",["cold"]="mortem.damage.cold",["poison"]="mortem.damage.poison",["plasma"]="mortem.damage.plasma"}
 function ui.mortem_damage_name(english)
  local id=damage_records[english]
  if id then return semantic(id,english) end
  return english
 end
 local group_records={["melee"]={english="Melee kills    : ",id="mortem.weapon-group.melee"},["pistol"]={english="Pistol kills   : ",id="mortem.weapon-group.pistol"},["shotgun"]={english="Shotgun kills  : ",id="mortem.weapon-group.shotgun"},["chain"]={english="Chaingun kills : ",id="mortem.weapon-group.chain"},["rocket"]={english="Rocket kills   : ",id="mortem.weapon-group.rocket"},["plasma"]={english="Plasma kills   : ",id="mortem.weapon-group.plasma"},["bfg"]={english="BFG kills      : ",id="mortem.weapon-group.bfg"}}
 function ui.mortem_weapon_group(group,english)
  local record=group_records[group]
  if record and record.english==english then return semantic(record.id,english) end
  return english
 end
 function ui.mortem_award_tier(award,index)
  local english=award.levels[index].name
  -- Shipped DRL has no register_award definitions. External module tiers keep
  -- their original fallback unless an exact scoped registry record exists.
  return ui.registry_text("award",award.id,"base_game","tier:"..index..".name",english)
 end
 local death_records={["acid"]={english="melted in acid",id="mortem.death.acid"},["barrel"]={english="was blown up by a barrel",id="mortem.death.barrel"},["blood"]={english="drowned in blood",id="mortem.death.blood"},["lava"]={english="was consumed by lava",id="mortem.death.lava"},["phase"]={english="was torn apart by phasing",id="mortem.death.phase"}}
 local result_records={
  ["unknown"]={id="mortem.result.unknown",english="was killed by something"},
  ["win"]={id="mortem.result.win",english="defeated the Mastermind"},
  ["final"]={id="mortem.result.final",english="nuked the Mastermind"},
  ["nuke"]={id="mortem.result.nuke",english="nuked himself"},
  ["sacrifice.mortem"]={id="mortem.result.sacrifice.mortem",english="sacrificed himself to kill the Mastermind"},
  ["suicide.mortem"]={id="mortem.result.suicide.mortem",english="committed a stupid suicide"},
  ["sacrifice.highscore"]={id="mortem.result.sacrifice.highscore",english="won by sacrifice"},
  ["suicide.highscore"]={id="mortem.result.suicide.highscore",english="committed suicide"}
 }
 function ui.mortem_result(result,english,highscore)
  -- Projection only: the original GetResultDescription and THOF.Add stay English.
  if result=="win" or result=="final" or result=="sacrifice" then
   local field=highscore and (ARCHANGEL and "arch_win_highscore" or "win_highscore") or (ARCHANGEL and "arch_win_mortem" or "win_mortem")
   local challenge
   if SCHALLENGE~="" and chal[SCHALLENGE][field] then challenge=chal[SCHALLENGE]
   elseif CHALLENGE~="" and chal[CHALLENGE][field] then challenge=chal[CHALLENGE] end
   if challenge and challenge[field]==english then return ui.registry_text("challenge",challenge.id,"base_game",field,english) end
  end
  if result=="killed" then
   local reason=death_records[player.killedby]
   if reason then
    if reason.english==english then return semantic(reason.id,english) end
    return english
   end
   local killer=beings[player.killedby]
   if killer then
    local field=player.killedmelee and "kill_desc_melee" or "kill_desc"
    if not highscore and killer[field] then
     if killer[field]==english then return ui.registry_text("being",killer.id,"base_game",field,english) end
     return english
    end
    local name=killer.name
    if "killed by "..name==english then return ui.semantic_text("mortem.death.by-enemy","killed by {{enemy}}",{{name="enemy",kind="string",value=ui.registry_text("being",killer.id,"base_game","name",name)}}) end
   end
  end
  local key=result
  if result=="sacrifice" or result=="suicide" then key=result..(highscore and ".highscore" or ".mortem") end
  local record=result_records[key]
  if record and record.english==english then return semantic(record.id,english) end
  local unknown=result_records.unknown
  if english==unknown.english then return semantic(unknown.id,english) end
  return english
 end
 local scripted_locations={["hellgate"]={english="the Hellgate",id="mortem.location.hellgate"},["tower_of_babel"]={english="the Tower of Babel",id="mortem.location.tower_of_babel"},["dis"]={english="the City of Dis",id="mortem.location.dis"},["hell_fortress"]={english="the Hell Fortress",id="mortem.location.hell_fortress"}}
 local regions={
  {name="Phobos L",suffix=" of the Phobos base",id="mortem.location.phobos"},
  {name="Deimos L",suffix=" of the Deimos base",id="mortem.location.deimos"},
  {name="Hell L",suffix=" of Hell",id="mortem.location.hell"},
  {name="Beyond L",suffix=" of Beyond",id="mortem.location.beyond"}
 }
 function ui.mortem_location(episode,english)
  if english=="an Unknown Location" then return ui.semantic_text("mortem.location.unknown","an Unknown Location",{}) end
  if not episode then return english end
  local script=episode.script
  local scripted=script and scripted_locations[script]
  if scripted and scripted.english==english then return semantic(scripted.id,english) end
  if script and levels[script] and levels[script].name==english then
   return ui.registry_text("level",script,"base_game","name",english)
  end
  -- Finite original producer metadata, with a whole English guard. This does
  -- not translate by replacing fragments in stored episode names/deathnames.
  local index=player.level_index
  local a100=CHALLENGE=="challenge_a100" or SCHALLENGE=="challenge_a100"
  local region,count
  if script=="intro" and index==1 then region=regions[1];count=1
  elseif index>=1 and index<=8 then region=regions[1];count=index
  elseif index>=9 and index<=16 then region=regions[2];count=a100 and index or index-8
  elseif index>=17 and (a100 or index<=23) then
   if a100 and index>=25 and index~=(ARCHANGEL and 666 or 100) then region=regions[4] else region=regions[3] end
   count=a100 and index or index-16
  end
  if region and (episode.name==region.name..count or (script=="intro" and index==1)) and english=="level "..count..region.suffix then
   return semantic(region.id,"level {{level}}"..region.suffix,{{name="level",kind="integer",value=count}})
  end
  return english
 end
 local reason_records={
  ["killed"]={singular=" {!{{count}}} of those was killed.",plural=" {!{{count}}} of those were killed.",id="mortem.general.reason.killed"},
  ["unknown"]={singular=" {!{{count}}} of those was killed by something unknown.",plural=" {!{{count}}} of those were killed by something unknown.",id="mortem.general.reason.unknown"},
  ["nuke"]={singular=" {!{{count}}} didn't read the thermonuclear bomb manual.",plural=" {!{{count}}} didn't read the thermonuclear bomb manual.",id="mortem.general.reason.nuke"},
  ["suicide"]={singular=" And {!{{count}}} couldn't handle the stress and committed a stupid suicide.",plural=" And {!{{count}}} couldn't handle the stress and committed a stupid suicide.",id="mortem.general.reason.suicide"}
 }
 function ui.mortem_reason(reason,count,english)
  local record=reason_records[reason]
  if not record then return english end
  local plural=count>1
  local template=plural and record.plural or record.singular
  local expected=string.gsub(template,"{{count}}",tostring(count))
  if expected~=english then return english end
  return semantic(record.id..(plural and ".plural" or ".singular"),template,{{name="count",kind="integer",value=count}})
 end
end

-- Original Hall-of-Fame English column compatibility projection (source guarded).
do
 local score_literals={{id="mortem.result.unknown",english="was killed by something"},{id="mortem.result.win",english="defeated the Mastermind"},{id="mortem.result.final",english="nuked the Mastermind"},{id="mortem.result.nuke",english="nuked himself"},{id="mortem.result.sacrifice.highscore",english="won by sacrifice"},{id="mortem.result.suicide.highscore",english="committed suicide"},{id="mortem.death.acid",english="melted in acid"},{id="mortem.death.barrel",english="was blown up by a barrel"},{id="mortem.death.blood",english="drowned in blood"},{id="mortem.death.lava",english="was consumed by lava"},{id="mortem.death.phase",english="was torn apart by phasing"}}
 local score_beings={{id="former",english="former human"},{id="sergeant",english="former sergeant"},{id="captain",english="former captain"},{id="commando",english="former commando"},{id="imp",english="imp"},{id="demon",english="demon"},{id="lostsoul",english="lost soul"},{id="cacodemon",english="cacodemon"},{id="knight",english="hell knight"},{id="baron",english="baron of hell"},{id="arachno",english="arachnotron"},{id="pain",english="pain elemental"},{id="revenant",english="revenant"},{id="mancubus",english="mancubus"},{id="arch",english="arch-vile"},{id="eformer",english="elite former human"},{id="esergeant",english="elite former sergeant"},{id="ecaptain",english="elite former captain"},{id="ecommando",english="elite former commando"},{id="nimp",english="nightmare imp"},{id="ndemon",english="nightmare demon"},{id="nlostsoul",english="nightmare soul"},{id="ncacodemon",english="nightmare cacodemon"},{id="nknight",english="nightmare knight"},{id="narachno",english="nightmare arachnotron"},{id="npain",english="nightmare elemental"},{id="nrevenant",english="nightmare revenant"},{id="nmancubus",english="nightmare mancubus"},{id="narch",english="nightmare arch-vile"},{id="bruiser",english="bruiser brother"},{id="shambler",english="shambler"},{id="lava_elemental",english="lava elemental"},{id="agony",english="agony elemental"},{id="angel",english="Angel of Death"},{id="cyberdemon",english="Cyberdemon"},{id="mastermind",english="Spider Mastermind"},{id="jc",english="John Carmack"},{id="apostle",english="Apostle"}}
 local score_challenges={["AoB"]={id="challenge_aob",arch_rank=nil,allowed={["challenge_aob"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aolt"]=true,["challenge_aoi"]=true,["challenge_aop"]=true,["challenge_aora"]=true,["challenge_aod"]=true,["challenge_aoms"]=true}},["AoMr"]={id="challenge_aomr",arch_rank=nil,allowed={["challenge_aomr"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aolt"]=true,["challenge_aoi"]=true,["challenge_aop"]=true,["challenge_aora"]=true,["challenge_aod"]=true,["challenge_aoms"]=true}},["AoSh"]={id="challenge_aosh",arch_rank=nil,allowed={["challenge_aosh"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aolt"]=true,["challenge_aoi"]=true,["challenge_aop"]=true,["challenge_aora"]=true,["challenge_aod"]=true,["challenge_aoms"]=true}},["AoLT"]={id="challenge_aolt",arch_rank=5,allowed={["challenge_aolt"]=true}},["AoI"]={id="challenge_aoi",arch_rank=nil,allowed={["challenge_aoi"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aolt"]=true,["challenge_aora"]=true,["challenge_aod"]=true}},["AoCn"]={id="challenge_aocn",arch_rank=nil,allowed={["challenge_aocn"]=true}},["AoP"]={id="challenge_aop",arch_rank=nil,allowed={["challenge_aop"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aolt"]=true,["challenge_aora"]=true,["challenge_aod"]=true}},["AoRA"]={id="challenge_aora",arch_rank=6,allowed={["challenge_aora"]=true}},["AoD"]={id="challenge_aod",arch_rank=nil,allowed={["challenge_aod"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aolt"]=true,["challenge_aoi"]=true,["challenge_aop"]=true,["challenge_aora"]=true,["challenge_aoms"]=true}},["AoMC"]={id="challenge_aomc",arch_rank=nil,allowed={["challenge_aomc"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aolt"]=true,["challenge_aoi"]=true,["challenge_aop"]=true,["challenge_aora"]=true,["challenge_aod"]=true,["challenge_aoms"]=true}},["AoMs"]={id="challenge_aoms",arch_rank=6,allowed={["challenge_aoms"]=true}},["A100"]={id="challenge_a100",arch_rank=7,allowed={["challenge_a100"]=true}},["AoPc"]={id="challenge_aopc",arch_rank=7,allowed={["challenge_aopc"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aoi"]=true,["challenge_aop"]=true,["challenge_aod"]=true,["challenge_aoms"]=true}},["AoHu"]={id="challenge_aohu",arch_rank=9,allowed={["challenge_aohu"]=true,["challenge_aocn"]=true,["challenge_aooc"]=true,["challenge_a100"]=true,["challenge_aoi"]=true,["challenge_aop"]=true,["challenge_aora"]=true,["challenge_aod"]=true,["challenge_aoms"]=true}},["AoOC"]={id="challenge_aooc",arch_rank=nil,allowed={["challenge_aooc"]=true}}}
 local score_wins={{id="challenge_a100",abbr="A100",field="win_highscore",arch=false,english="completed 100 levels"},{id="challenge_a100",abbr="A100",field="arch_win_highscore",arch=true,english="completed 666 levels"}}
 function ui.mortem_score_result(english,challenge_abbreviation)
  if type(english)~="string" or #english>32768 or string.find(english,"%z") then return english end
  if type(challenge_abbreviation)~="string" or #challenge_abbreviation>128 or string.find(challenge_abbreviation,"%z") then return english end
  local translated,found,ambiguous
  local function offer(value)
   if not found then translated=value;found=true
   elseif translated~=value then ambiguous=true end
  end
  for _,record in ipairs(score_literals) do
   if record.english==english then offer(ui.semantic_text(record.id,record.english,{})) end
  end
  local challenge_guard=score_challenges[challenge_abbreviation]
  local challenge=challenge_guard and chal[challenge_guard.id]
  if challenge and challenge.abbr==challenge_abbreviation then
   for _,record in ipairs(score_wins) do
    local winner=chal[record.id]
    if challenge_guard.allowed[record.id] and (not record.arch or (challenge_guard.arch_rank and challenge.arch_rank==challenge_guard.arch_rank)) and winner and winner.abbr==record.abbr and winner[record.field]==record.english and english==record.english then
     offer(ui.registry_text("challenge",record.id,"base_game",record.field,record.english))
    end
   end
  end
  for _,record in ipairs(score_beings) do
   local killer=beings[record.id]
   if killer and killer.name==record.english and english=="killed by "..record.english then
    local name=ui.registry_text("being",record.id,"base_game","name",record.english)
    offer(ui.semantic_text("mortem.death.by-enemy","killed by {{enemy}}",{{name="enemy",kind="string",value=name}}))
   end
  end
  if found and not ambiguous then return translated end
  return english
 end
end
