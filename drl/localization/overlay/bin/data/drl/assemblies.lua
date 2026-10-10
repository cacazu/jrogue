-- Modified 2026-10-02 for the DRL browser presentation/semantic text adaptation; original gameplay/domain names retained.
function drl.register_assemblies()

-- Basic assemblies --

	register_mod_array "chainsword"
	{
		name  = "chainsword",
		mods  = { P = 1, B = 1 },
		request_id = "knife",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_chainsword = item.name
			item.name         = "chainsword"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.chainsword", drl_name_before_item_name_aspect_assembly_chainsword, item.name)
			item.damage_dice  = 8
			item.damage_sides = 2
			item.acc          = 2
		end,
	}

	register_mod_array "pblade"
	{
		name  = "piercing blade",
		mods  = { P = 1, A = 1 },
		request_type = ITEMTYPE_MELEE,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_pblade = item.name
			item.name         = "piercing "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.pblade", drl_name_before_item_name_aspect_assembly_pblade, item.name)
			item.damagetype   = DAMAGE_IGNOREARMOR
			item.damage_dice  = item.__proto.damage_dice
			item.damage_sides = item.__proto.damage_sides + 1
			item.acc          = item.__proto.acc
		end,
	}

	register_mod_array "speedloader"
	{
		name  = "speedloader pistol",
		mods  = { A = 1, T = 1 },
		request_id = "pistol",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_speedloader = item.name
			item.name       = "speedloader pistol"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.speedloader", drl_name_before_item_name_aspect_assembly_speedloader, item.name)
			item.reloadtime = 4
			item.usetime    = item.__proto.usetime
			item.acc        = item.__proto.acc
		end,
	}

	register_mod_array "elephant"
	{
		name  = "elephant gun",
		mods  = { P = 2 },
		request_id = "shotgun",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_elephant = item.name
			item.name         = "elephant gun"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.elephant", drl_name_before_item_name_aspect_assembly_elephant, item.name)
			item.reloadtime   = 25
			item.damage_dice  = 12
			item.damage_sides = 3
		end,
	}

	register_mod_array "gatling"
	{
		name  = "gatling gun",
		mods  = { B = 2 },
		request_id = "chaingun",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_gatling = item.name
			item.name         = "gatling gun"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.gatling", drl_name_before_item_name_aspect_assembly_gatling, item.name)
			item.shots        = 6
			item.reloadtime   = 30
			item.damage_sides = item.damage_sides + 1
			item.ammomax      = 60
		end,
	}

	register_mod_array "micro"
	{
		name  = "micro launcher",
		mods  = { T = 2 },
		request_id = "bazooka",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_micro = item.name
			item.name         = "micro launcher"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.micro", drl_name_before_item_name_aspect_assembly_micro, item.name)
			item.reloadtime   = 8
			item.usetime      = 5
			item.damage_dice  = 5
			item.damage_sides = 5
			item.acc          = 7
			item.radius       = 3
		end,
	}

	register_mod_array "tarmor"
	{
		name  = "tactical armor",
		mods  = { A = 2 },
		request_id = "garmor",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_tarmor = item.name
			item.name         = "tactical armor"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.tarmor", drl_name_before_item_name_aspect_assembly_tarmor, item.name)
			item.movemod      = 15
			item.dodgemod     = 10
			item.armor        = 0
			item.resist.shrapnel = 0
			item.resist.bullet   = 0

			item:add_perk( "perk_armor_recharge" )
			item.pp_recharge.amount = 1
			item.pp_recharge.tick   = 5
			item.pp_recharge.delay  = 50
		end,

		Match = function (item)
			return not item:has_property("pp_recharge")
		end,
	}

	register_mod_array "tboots"
	{
		name  = "tactical boots",
		mods  = { A = 2 },
		request_id = "sboots",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_tboots = item.name
			item.name      = "tactical boots"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.tboots", drl_name_before_item_name_aspect_assembly_tboots, item.name)
			item.movemod   = 15
			item.dodgemod  = 0
			item.knockmod  = 0
			item.armor     = 0

			item:add_perk( "perk_armor_recharge" )
			item.pp_recharge.amount = 1
			item.pp_recharge.tick   = 5
			item.pp_recharge.delay  = 50
		end,

		Match = function (item)
			return not item:has_property("pp_recharge")
		end,
	}

	register_mod_array "nanofiber"
	{
		name  = "nanofiber armor",
		mods  = { P = 1, B = 1 },
		request_type = ITEMTYPE_ARMOR,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_nanofiber = item.name
			item.name    = "nanofiber "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.nanofiber", drl_name_before_item_name_aspect_assembly_nanofiber, item.name)
			item.movemod = item.__proto.movemod
			item.armor   = math.ceil(item.__proto.armor / 2)
			local proto_resist = item.__proto.resist or {}
			item.resist.bullet = math.ceil((proto_resist.bullet or 0) / 2)
			item.resist.shrapnel = math.ceil((proto_resist.shrapnel or 0) / 2)
			item.resist.melee = math.ceil((proto_resist.melee or 0) / 2)
			item.resist.fire = math.ceil((proto_resist.fire or 0) / 2)
			item.resist.acid = math.ceil((proto_resist.acid or 0) / 2)
			item.resist.plasma = math.ceil((proto_resist.plasma or 0) / 2)
			item.flags[ IF_NODURABILITY ] = true
		end,
	}

	register_mod_array "high"
	{
		name  = "high power weapon",
		mods  = { P = 1, B = 1 },
		request_desc  = "ranged, non-shotgun, magazine > 5",
		request_type = ITEMTYPE_RANGED,

		Match = function (item)
			return item.ammomax > 5 and item.group ~= "shotgun"
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_high = item.name
			item.name             = "high power "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.high", drl_name_before_item_name_aspect_assembly_high, item.name)
			item.ammomax          = item.__proto.ammomax * 0.65
			item.ammo             = math.min( item.ammo, item.ammomax )
			if item.__proto.damage_sides >= item.__proto.damage_dice then
				item.damage_sides = item.__proto.damage_sides + 2
			else
				item.damage_dice  = item.__proto.damage_dice + 2
			end
		end,
	}

	register_mod_array "power"
	{
		name  = "power armor",
		mods  = { P = 1, N = 1 },
		request_desc = "any common armor",

		Match = function (item)
			return ( not item:has_property("pp_recharge") or item:get_mod("N") > 0 ) and item.itype == ITEMTYPE_ARMOR and item.flags[IF_EXOTIC] == false and item.flags[IF_UNIQUE] == false
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_power = item.name
			item.name             = "powered "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.power", drl_name_before_item_name_aspect_assembly_power, item.name)
			item.armor            = item.__proto.armor + 1
			item.movemod          = item.__proto.movemod + 20
			item.knockmod         = -25
			if (item.resist.bullet or 0) > 0 then
				item.resist.bullet   = math.min( (item.resist.bullet or 0) * 5, core.options.resist_cap )
			end
			if (item.resist.shrapnel or 0) > 0 then
				item.resist.shrapnel = math.min( (item.resist.shrapnel or 0) * 5, core.options.resist_cap )
			end
			if (item.resist.fire or 0) > 0 then
				item.resist.fire     = math.min( (item.resist.fire or 0) * 2, core.options.resist_cap )
			end
			if (item.resist.acid or 0) > 0 then
				item.resist.acid     = math.min( (item.resist.acid or 0) * 2, core.options.resist_cap )
			end
			if (item.resist.plasma or 0) > 0 then
				item.resist.plasma   = math.min( (item.resist.plasma or 0) * 3, core.options.resist_cap )
			end
			item.resist.melee        = 25

			if not item:has_property("pp_recharge") then
				item:add_perk( "perk_armor_recharge" )
			end

			item.pp_recharge.amount = 1
			item.pp_recharge.tick   = 3
			item.pp_recharge.delay  = 50
		end,
	}

	register_mod_array "tshotgun"
	{
		name  = "tactical shotgun",
		mods  = { P = 1, T = 1 },
		request_id = "ashotgun",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_tshotgun = item.name
			item.name         = "tactical shotgun"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.tshotgun", drl_name_before_item_name_aspect_assembly_tshotgun, item.name)
			item.reloadtime   = 10
			item.damage_dice  = 8
			item.damage_sides = 3
			item.usetime      = 10
			item.ammomax      = 5
			if item:is_perk("perk_pump_action") then
				item:remove_perk("perk_pump_action")
			end
		end,
	}

	register_mod_array "plate"
	{
		name  = "tower shield",
		mods  = { P = 1, O = 1 },
		request_id = "rarmor",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_plate = item.name
			item.name           = "tower shield"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.plate", drl_name_before_item_name_aspect_assembly_plate, item.name)
			item.armor          = 12
			item.durability     = 200
			item.maxdurability  = 200
			item.movemod        = -30
			item.knockmod       = -90
			item.resist.fire       = 0
			item.flags[ IF_NOREPAIR ] = true
			item.flags[ IF_NONMODABLE ] = true
			item.flags[ IF_NODEGRADE ] = true
			item.flags[ IF_NODURABILITY ] = false
		end,
	}

	register_mod_array "fparmor"
	{
		name  = "fireproof armor",
		mods  = { B = 1, T = 1 },
		request_type = ITEMTYPE_ARMOR,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_fparmor = item.name
			item.name          = "fireproof "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.fparmor", drl_name_before_item_name_aspect_assembly_fparmor, item.name)
			item.durability    = 100
			item.maxdurability = 100
			item.movemod       = item.__proto.movemod
			item.knockmod      = item.__proto.knockmod
			item:reset_resistances()
			item.resist.melee     = (item.resist.melee or 0) - 30
			item.resist.fire      =  math.min( (item.resist.fire or 0) + 30, core.options.resist_cap )
		end,
	}

	register_mod_array "fpboots"
	{
		name  = "fireproof boots",
		mods  = { B = 1, T = 1 },
		request_type = ITEMTYPE_BOOTS,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_fpboots = item.name
			item.name          = "fireproof "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.fpboots", drl_name_before_item_name_aspect_assembly_fpboots, item.name)
			item.durability    = 100
			item.maxdurability = 100
			item.knockmod      = item.__proto.knockmod
			item:reset_resistances()
			item.resist.fire      =  math.min( (item.resist.fire or 0) + 30, core.options.resist_cap )
		end,
	}

	register_mod_array "balarmor"
	{
		name  = "ballistic armor",
		mods  = { A = 1, T = 1 },
		request_type = ITEMTYPE_ARMOR,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_balarmor = item.name
			item.name          = "ballistic "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.balarmor", drl_name_before_item_name_aspect_assembly_balarmor, item.name)
			item.movemod       = item.__proto.movemod
			item.knockmod      = item.__proto.knockmod
			item:reset_resistances()
			item.resist.melee     = math.min( (item.resist.melee or 0) + 40, core.options.resist_cap )
			item.resist.bullet    = math.min( (item.resist.bullet or 0) + 40, core.options.resist_cap )
			item.resist.shrapnel  = math.min( (item.resist.shrapnel or 0) + 40, core.options.resist_cap )
			item.resist.fire      = (item.resist.fire or 0) - 20
			item.resist.plasma    = 0
			item.resist.acid      = 0
		end,
	}

	register_mod_array "plasmatic"
	{
		name  = "plasmatic shrapnel",
		mods  = {  P = 1, S = 1 },
		request_desc  = "any shotgun",

		Match = function (item)
			return item.group == "shotgun"
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_plasmatic = item.name
			item.name        = "plasmatic "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.plasmatic", drl_name_before_item_name_aspect_assembly_plasmatic, item.name)
			item.damagetype  = DAMAGE_PLASMA
			item.damage_dice = item.__proto.damage_dice
		end,
	}

	register_mod_array "gboots"
	{
		name  = "grappling boots",
		mods  = { T = 2 },
		request_type = ITEMTYPE_BOOTS,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_gboots = item.name
			item.name      = "grappling "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.gboots", drl_name_before_item_name_aspect_assembly_gboots, item.name)
			item.movemod   = item.__proto.movemod
			item.armor     = item.armor + 1
			item.knockmod  = math.max( -90, item.__proto.knockmod - 50 )
		end,
	}

	register_mod_array "grarmor"
	{
		name  = "grappling armor",
		mods  = { B = 1, A = 1 },
		request_type = ITEMTYPE_ARMOR,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_grarmor = item.name
			item.name          = "grappling "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.grarmor", drl_name_before_item_name_aspect_assembly_grarmor, item.name)
			item.movemod       = item.__proto.movemod
			item.durability    = 100
			item.maxdurability = 100
			item.knockmod      = math.max( -90, item.__proto.knockmod - 50 )
			item:reset_resistances()
			item.resist.melee     = (item.resist.melee or 0) + 30
		end,
	}

	register_mod_array "lavboots"
	{
		name  = "lava boots",
		mods  = { T = 1, O = 1 },
		request_type = ITEMTYPE_BOOTS,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_lavboots = item.name
			item.name          = "lava "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.lavboots", drl_name_before_item_name_aspect_assembly_lavboots, item.name)
			item.movemod       = -20
			item.knockmod      = -30
			item:reset_resistances()
			item.resist.fire      = 100
			item.flags[ IF_NODURABILITY ] = true
		end,
	}

-- Advanced assemblies

	register_mod_array "double"
	{
		name  = "double chainsaw",
		mods  = { P = 2, B = 1 },
		level = 1,
		request_id = "chainsaw",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_double = item.name
			item.name         = "double chainsaw"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.double", drl_name_before_item_name_aspect_assembly_double, item.name)
			item.damage_dice  = 4
			item.damage_sides = 12
			item.acc          = -1
		end,
	}

	register_mod_array "tacticalrl"
	{
		name  = "tactical rocket launcher",
		mods  = { B = 3 },
		level = 1,
		request_id = "bazooka",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_tacticalrl = item.name
			item.name        = "tactical rocket launcher"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.tacticalrl", drl_name_before_item_name_aspect_assembly_tacticalrl, item.name)
			item.ammomax     = 5
			item.radius      = 2
			item.flags[ IF_AUTOHIT ] = true
		end,
	}

	register_mod_array "storm"
	{
		name  = "storm bolter pistol",
		mods  = { B = 2, T = 1 },
		level = 1,
		request_desc = "any pistol",

		Match = function (item)
			return (item.itype == ITEMTYPE_RANGED) and (item.group == "pistol")
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_storm = item.name
			item.name           = "storm "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.storm", drl_name_before_item_name_aspect_assembly_storm, item.name)
			item.acc            = item.__proto.acc - 2
			item.usetime        = item.__proto.usetime * 0.85
			item.damage_dice    = 1
			item.damage_sides   = item.__proto.damage_dice * item.__proto.damage_sides
			item.shots          = 2
			item.ammomax        = math.floor(item.__proto.ammomax * 1.5)
			item.ammo           = math.min(item.ammo, item.ammomax)
			item.reloadtime     = item.__proto.reloadtime
		end,
	}

	register_mod_array "rifle"
	{
		name  = "assault rifle",
		mods  = { A = 3 },
		level = 1,
		request_desc = "any rapid-fire",

		Match = function (item)
			return (item.itype == ITEMTYPE_RANGED) and (item.group == "chain" or item.group == "plasma") and item.flags[IF_UNIQUE] == false
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_rifle = item.name
			item.name         = "assault "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.rifle", drl_name_before_item_name_aspect_assembly_rifle, item.name)
			item.acc          = item.__proto.acc + 3
			item.shots        = math.ceil(item.__proto.shots / 2)
			item.shotcost     = math.max(item.__proto.shotcost,1) * 2
			item.reloadtime   = item.__proto.reloadtime / 2
			item.damage_dice  = item.__proto.damage_dice + 1
			item.damage_sides = item.__proto.damage_sides - 1
		end,
	}

	register_mod_array "energy"
	{
		name  = "energy pistol",
		mods  = { P = 2, T = 1 },
		level = 1,
		request_desc = "any pistol",

		Match = function (item)
			return (item.itype == ITEMTYPE_RANGED) and (item.group == "pistol")
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_energy = item.name
			item.name         = "energy "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.energy", drl_name_before_item_name_aspect_assembly_energy, item.name)
			item.miscolor     = MULTIYELLOW
			item:set_sprite( "hit", { sprite = SPRITE_BLAST } )
			item.damagetype   = DAMAGE_PLASMA
			item.damage_sides = item.__proto.damage_sides + 1
			item.ammoid       = items["cell"].nid
		end,
	}


	register_mod_array "assault"
	{
		name  = "burst cannon",
		mods  = { P = 1, B = 2 },
		level = 1,
		request_desc = "any rapid-fire",

		Match = function(item)
			return (item.itype == ITEMTYPE_RANGED) and (item.group == "chain" or item.group == "plasma") and item.flags[IF_UNIQUE] == false
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_assault = item.name
			item.name           = "burst "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.assault", drl_name_before_item_name_aspect_assembly_assault, item.name)
			item.acc            = item.__proto.acc - 2
			item.damage_dice    = 1
			item.damage_sides   = item.__proto.damage_sides + 2
			item.shots          = item.__proto.shots + 2
			item.ammomax        = item.__proto.ammomax * 2
			item.reloadtime     = item.__proto.reloadtime * 1.5
		end,
	}

	register_mod_array "vbfg9000"
	{
		name  = "VBFG9000",
		mods  = {P = 3},
		level = 1,
		request_desc = "any BFG9000",

		Match = function(item)
			return (item.itype == ITEMTYPE_RANGED) and (item.group == "bfg") and item.flags[IF_UNIQUE] == false
		end,

		OnApply = function (item)
			if item.name == "nuclear BFG 9000" then
				local drl_name_before_item_name_aspect_assembly_vbfg9000_nuclear = item.name
				item.name     = "nuclear VBFG9000"
				ui.remember_item_name_aspect(item, "item.name.aspect.assembly.vbfg9000.nuclear", drl_name_before_item_name_aspect_assembly_vbfg9000_nuclear, item.name)
			else
				local drl_name_before_item_name_aspect_assembly_vbfg9000_regular = item.name
				item.name     = "VBFG9000"
				ui.remember_item_name_aspect(item, "item.name.aspect.assembly.vbfg9000.regular", drl_name_before_item_name_aspect_assembly_vbfg9000_regular, item.name)
			end
			item.damage_dice  = item.__proto.damage_dice
			item.damage_sides = item.__proto.damage_sides + 2
			item.misdelay     = 200
			item.shotcost     = item.__proto.shotcost * 1.5
			item.ammomax      = item.__proto.ammomax * 1.5
			item.radius       = 12
		end,
	}

	register_mod_array "envboots"
	{
		name  = "environmental boots",
		level = 1,
		mods  = { B = 2, T = 1 },
		request_type = ITEMTYPE_BOOTS,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_envboots = item.name
			item.name          = "environmental "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.envboots", drl_name_before_item_name_aspect_assembly_envboots, item.name)
			item.movemod       = item.__proto.movemod - 15
			item.knockmod      = item.__proto.knockmod
			item.armor         = item.__proto.armor
			item.maxdurability = item.__proto.durability
			item.durability    = math.min( item.durability, item.maxdurability )
			local presist = item.__proto.resist or {}
			item:reset_resistances()
			item.resist.fire      = math.min( (presist.fire or 0) + core.options.resist_cap,   core.options.resist_cap )
			item.resist.acid      = math.min( (presist.acid or 0) + core.options.resist_cap,   core.options.resist_cap )
			item.resist.plasma    = math.min( (presist.plasma or 0) + 20, core.options.resist_cap )
		end,
	}

	register_mod_array "fireshield"
	{
		name  = "fire shield",
		mods  = { B = 1, T = 1, O = 1 },
		level = 1,
		request_id = "rarmor",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_fireshield = item.name
			item.name          = "fire shield"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.fireshield", drl_name_before_item_name_aspect_assembly_fireshield, item.name)
			item.movemod       = -20
			item.knockmod      = 0
			item.resist.fire      = core.options.resist_cap
			item.maxdurability = 200
			item.durability    = item.maxdurability
			item.flags[ IF_NOREPAIR ] = true
			item.flags[ IF_NONMODABLE ] = true
			item.flags[ IF_NODEGRADE ] = true
			item.flags[ IF_NODURABILITY ] = false
		end,
	}

	register_mod_array "nanoskin"
	{
		name  = "nanofiber skin armor",
		mods  = { P = 2, N = 1 },
		level = 1,
		request_type = ITEMTYPE_ARMOR,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_nanoskin = item.name
			item.name         = "nanoskin "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.nanoskin", drl_name_before_item_name_aspect_assembly_nanoskin, item.name)
			item.armor        = item.__proto.armor
			local proto_resist = item.__proto.resist or {}
			item.resist.bullet   = math.min( (proto_resist.bullet or 0) + 25, core.options.resist_cap )
			item.resist.shrapnel = math.min( (proto_resist.shrapnel or 0) + 25, core.options.resist_cap )
			item.resist.melee = math.min( (proto_resist.melee or 0) + 25, core.options.resist_cap )
			item.resist.fire = math.min( (proto_resist.fire or 0) + 25, core.options.resist_cap )
			item.resist.acid = math.min( (proto_resist.acid or 0) + 25, core.options.resist_cap )
			item.resist.plasma = math.min( (proto_resist.plasma or 0) + 25, core.options.resist_cap )
			if not item:has_property("pp_recharge") then
				item:add_perk( "perk_armor_recharge" )
			end
			item.pp_recharge.delay  = 50
			item.pp_recharge.tick   = 5
			item.pp_recharge.amount = 1
			item.flags[ IF_NODESTROY ] = true
			item:add_perk( "perk_cursed" )
		end,

		Match = function (item)
			return not item:has_property("pp_recharge") or item:get_mod("N") > 0
		end,
	}

	register_mod_array "gravity"
	{
		name  = "antigrav boots",
		mods  = { A = 2, N = 1 },
		level = 1,
		request_type = ITEMTYPE_BOOTS,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_gravity = item.name
			item.name    = "antigrav "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.gravity", drl_name_before_item_name_aspect_assembly_gravity, item.name)
			item.movemod = math.min( item.__proto.movemod + 50, 50 )
			item.flags[ IF_NODESTROY ] = true
		end,
	}

	register_mod_array "hyperblaster"
	{
		name  = "hyperblaster",
		mods  = {A = 1, T = 2},
		level = 1,
		request_id = "plasma",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_hyperblaster = item.name
			item.name         = "hyperblaster"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.hyperblaster", drl_name_before_item_name_aspect_assembly_hyperblaster, item.name)
			item.acc          = 4
			item.shots        = 3
			item.damage_dice  = 2
			item.damage_sides = 4
			item.reloadtime   = 25
			item.usetime      = 5
		end,
	}

	register_mod_array "fdshotgun"
	{
		name  = "focused double shotgun",
		mods  = {A = 1, T = 1, P = 1},
		level = 1,
		request_id = "dshotgun",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_fdshotgun = item.name
			item.name         = "focused double shotgun"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.fdshotgun", drl_name_before_item_name_aspect_assembly_fdshotgun, item.name)
			item.range        = 12
			item.spread       = 3
			item.falloff      = 9
			item.damage_dice  = 8
			item.damage_sides = 4
			item.reloadtime   = 15
			item.usetime      = 10
		end,
	}

-- Master assemblies

	register_mod_array "nanomanufacture"
	{
		name  = "nanomanufacture ammo",
		mods  = {N = 1, B = 3},
		level = 2,
		request_desc  = "non-sg/non-bfg ranged weapon",

		Match = function (item)
			return item.group ~= "shotgun" and (item.itype == ITEMTYPE_RANGED) and (item.radius < 5)
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_nanomanufacture = item.name
			item.name  = "nanomachic "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.nanomanufacture", drl_name_before_item_name_aspect_assembly_nanomanufacture, item.name)
			item.ammomax = item.__proto.ammomax * 2
			item.ammo = math.min( item.ammo, item.ammomax )
			item.flags[ IF_NOAMMO ]   = true
			item.flags[ IF_NOUNLOAD ] = true
			item.flags[ IF_NORELOAD ] = false
			item:remove_perks_by_tag( "recharge" )
		end,
	}

	register_mod_array "nsharpnel"
	{
		name  = "nano-shrapnel",
		mods  = { P = 3, N = 1 },
		level = 2,
		request_desc  = "any shotgun",

		Match = function (item)
			return item.group == "shotgun"
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_nsharpnel = item.name
			item.name         = "nano "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.nsharpnel", drl_name_before_item_name_aspect_assembly_nsharpnel, item.name)
			item.damage_dice = item.__proto.damage_dice - 3
			item.damagetype   = DAMAGE_IGNOREARMOR
			item.flags[ IF_NOAMMO ] = true
			if item:is_perk("perk_pump_action") then
				item:remove_perk("perk_pump_action")
			end
		end,
	}

	register_mod_array "demolition"
	{
		name  = "demolition ammo",
		mods  = { P = 1, T = 2, F = 1 },
		level = 2,
		request_desc  = "10mm weapon",

		Match = function (item)
			return item.itype == ITEMTYPE_RANGED and items[ item.ammoid ].id == "ammo"
		end,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_demolition = item.name
			item.name            = "demolition "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.demolition", drl_name_before_item_name_aspect_assembly_demolition, item.name)
			item.damage_dice     = math.ceil( item.__proto.damage_dice * item.__proto.damage_sides / 2 )
			item.damage_sides    = 2
			item.usetime         = item.__proto.usetime
			item.radius          = 1
			item.shots           = item.__proto.shots
			item:set_explosion{
				delay = 40,
				color = RED,
			}
			item.damagetype      = DAMAGE_FIRE
		end,
	}

	register_mod_array "cybernano"
	{
		name  = "cybernano armor",
		mods  = {N = 1, P = 2, O = 1},
		level = 2,
		request_type = ITEMTYPE_ARMOR,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_cybernano = item.name
			item.name       = "cybernano "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.cybernano", drl_name_before_item_name_aspect_assembly_cybernano, item.name)
			item.durability = 100
			item.armor      = item.__proto.armor + 4
			item.flags[ IF_NODURABILITY ] = true
			item.flags[ IF_NODESTROY ]    = true
			item:add_perk( "perk_cursed" )
			item:remove_perk( "perk_armor_recharge" )
		end,
	}

	register_mod_array "biggest"
	{
		name  = "biggest fucking gun",
		mods  = { B = 2, F = 2 },
		level = 2,
		request_desc = "any BFG9000",

		Match = function(item)
			return (item.itype == ITEMTYPE_RANGED) and (item.group == "bfg") and item.flags[IF_UNIQUE] == false
		end,

		OnApply = function (item)
			if item.name == "nuclear BFG 9000" then
				local drl_name_before_item_name_aspect_assembly_biggest_nuclear = item.name
				item.name     = "biggest fucking nuclear gun"
				ui.remember_item_name_aspect(item, "item.name.aspect.assembly.biggest.nuclear", drl_name_before_item_name_aspect_assembly_biggest_nuclear, item.name)
			else
				local drl_name_before_item_name_aspect_assembly_biggest_regular = item.name
				item.name     = "biggest fucking gun"
				ui.remember_item_name_aspect(item, "item.name.aspect.assembly.biggest.regular", drl_name_before_item_name_aspect_assembly_biggest_regular, item.name)
			end
			item.damage_dice  = item.__proto.damage_dice * 2
			item.damage_sides = item.__proto.damage_sides * 2
			item.misdelay     = 200
			item.shotcost     = item.__proto.shotcost * 2.5
			item.ammomax      = item.__proto.ammomax * 2.5
			item.radius       = 16
		end,
	}

	register_mod_array "ripper"
	{
		name  = "ripper",
		mods  = {P = 2, B = 1, T = 1},
		level = 2,
		request_id = "chainsaw",

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_ripper = item.name
			item.name         = "ripper"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.ripper", drl_name_before_item_name_aspect_assembly_ripper, item.name)
			item.damage_dice  = 6
			item.damage_sides = 6
			item.usetime      = 5
			item.acc          = -4
		end,
	}

	register_mod_array "cerboots"
	{
		name  = "cerberus boots",
		mods  = { P = 2, T = 1, A = 1 },
		level = 2,
		request_type = ITEMTYPE_BOOTS,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_cerboots = item.name
			item.name     = "cerberus "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.cerboots", drl_name_before_item_name_aspect_assembly_cerboots, item.name)
			item.armor    = 0
			item.movemod  = -20
			item.knockmod = -30
			item:reset_resistances()
			item.resist.fire   = 100
			item.resist.acid   = 100
			item.resist.plasma = math.max( (item.resist.plasma or 0), 50 )
		end,
	}

	register_mod_array "cerarmor"
	{
		name  = "cerberus armor",
		mods  = { P = 2, T = 1, A = 1 },
		level = 2,
		request_type = ITEMTYPE_ARMOR,

		OnApply = function (item)
			local drl_name_before_item_name_aspect_assembly_cerarmor = item.name
			item.name       = "cerberus "..item.name
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.cerarmor", drl_name_before_item_name_aspect_assembly_cerarmor, item.name)
			item.armor      = 0
			item.movemod    = -30
			item.knockmod   = -30
			item:reset_resistances()
			item.resist.fire   = math.max( (item.resist.fire or 0),   70 )
			item.resist.acid   = math.max( (item.resist.acid or 0),   70 )
			item.resist.plasma = math.max( (item.resist.plasma or 0), 50 )
		end,
	}

	register_mod_array "mother"
	{
		name  = "Mother-In-Law",
		mods  = { P = 2, F = 1, N = 1 },
		level = 2,
		request_id = "bazooka",

		OnApply = function (item)
			-- Original mother-in-law is rocket launcher + F1N1P3
			local drl_name_before_item_name_aspect_assembly_mother = item.name
			item.name         = "Mother-In-Law"
			ui.remember_item_name_aspect(item, "item.name.aspect.assembly.mother", drl_name_before_item_name_aspect_assembly_mother, item.name)
			--item.desc         = "Simon-v's legendary rocket launcher."
			item.damage_dice  = 6
			item.damage_sides = 9
			item.radius       = 6
			-- This is the behaviour of the N-mod on 0.9.9.1.
			-- shark said that you can get this with N2, but here we are basically allowing a *6*-mod weapon build up
			
			if not item:has_property("pp_recharge") then
				item:add_perk( "perk_weapon_recharge" )
			end
			item.pp_recharge.delay  = 0
			item.pp_recharge.tick   = 10
			item.pp_recharge.amount = 1
		end,

		Match = function (item)
			return not item:has_property("pp_recharge") or item:get_mod("N") > 0
		end,
	}

end
