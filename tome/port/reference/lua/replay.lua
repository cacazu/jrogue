-- Controlled source execution fixture. All four formulas are the complete,
-- unmodified official Combat.lua methods loaded from source/Combat.lua.
-- Engine stubs isolate scalar methods; this does not boot the original game.

class = {make = function() end}
package.preload["engine.class"] = function() return class end
for _, name in ipairs({"engine.DamageType", "engine.Map", "engine.Chat",
    "engine.Target", "engine.interface.ActorTalents"}) do
    package.preload[name] = function() return {} end
end

local controlled_roll = 0
local observed_chance = nil
rng = {
    -- A controlled percentile result; the original SFMT RNG is not under test.
    percent = function(chance)
        observed_chance = chance
        return controlled_roll < chance
    end,
}
util = {bound = function(value, low, high)
    return math.max(low, math.min(high, value))
end}
local tutorial = false
game = {player = {hasQuest = function(self, name)
    assert(name == "tutorial-combat-stats")
    return tutorial
end}}

local module_name = "mod.class.interface.Combat"
assert(loadfile("source/Combat.lua"))(module_name)
local Combat = assert(package.loaded[module_name])
local actor = setmetatable({
    T_FORM_AND_FUNCTION = "fixture.form_and_function",
    knowTalent = function(self, talent)
        assert(talent == self.T_FORM_AND_FUNCTION)
        return self.fixture_talent_boost ~= nil
    end,
    callTalent = function(self, talent, method, weapon)
        assert(talent == self.T_FORM_AND_FUNCTION and method == "getDamBoost")
        assert(type(weapon) == "table")
        return assert(self.fixture_talent_boost)
    end,
}, {__index = Combat})

local golden = {
    lua_version = _VERSION,
    check_hit = {}, rescale_combat_stats = {},
    rescale_damage = {}, weapon_damage_power = {},
    fixture_notes = {
        "rng.percent is a controlled zero-based percentile stub; actual SFMT is not tested",
        "util.bound clamps the original method's computed value to the requested limits",
        "weapon_damage_power executes actual upstream combatDamagePower, not a new Lua formula",
        "Entire upstream Combat.lua module is loaded with controlled engine import stubs",
    },
}

local hit_cases = {
    {attack=0, defense=0, roll=49},
    {attack=0, defense=0, roll=50},
    {attack=10, defense=9, roll=52},
    {attack=10, defense=9, roll=53},
    {attack=-20, defense=-40, roll=0},
    {attack=-20, defense=10, roll=25},
    {attack=0, defense=40, roll=0},
    {attack=40, defense=0, roll=99},
    {attack=0, defense=40, minimum=5, maximum=95, roll=4},
    {attack=0, defense=40, minimum=5, maximum=95, roll=5},
    {attack=40, defense=0, minimum=5, maximum=95, roll=94},
    {attack=40, defense=0, minimum=5, maximum=95, roll=95},
    {attack=40, defense=0, minimum=5, maximum=95, tutorial=true, roll=99},
    {attack=0, defense=40, minimum=5, maximum=95, tutorial=true, roll=0},
    {attack=3.25, defense=3, roll=50},
}
for _, case in ipairs(hit_cases) do
    controlled_roll = case.roll
    tutorial = case.tutorial or false
    observed_chance = nil
    local success, chance = actor:checkHit(case.attack, case.defense,
        case.minimum, case.maximum)
    assert(observed_chance == chance, "Original checkHit passed a different RNG threshold")
    case.expected = {hit=success, chance=chance}
    golden.check_hit[#golden.check_hit + 1] = case
end

for _, raw in ipairs({-50, -1, 0, 0.5, 1, 19, 20, 21, 59, 60, 61,
    119, 120, 121, 199, 200, 201, 1000, 1000000}) do
    golden.rescale_combat_stats[#golden.rescale_combat_stats + 1] = {
        raw=raw, expected=actor:rescaleCombatStats(raw),
    }
end
for _, raw in ipairs({0, 44, 45, 46, 104, 105, 106, 180, 1000}) do
    golden.rescale_combat_stats[#golden.rescale_combat_stats + 1] = {
        raw=raw, interval=45, step=1/3,
        expected=actor:rescaleCombatStats(raw, 45, 1/3),
    }
end
for _, damage in ipairs({-100, -1, 0, 0.1, 0.5, 1, 2, 10, 50, 100, 1000}) do
    golden.rescale_damage[#golden.rescale_damage + 1] = {
        damage=damage, expected=actor:rescaleDamage(damage),
    }
end
local weapon_cases = {
    {no_weapon=true}, {}, {damage=-10}, {damage=0}, {damage=1},
    {damage=10}, {damage=40}, {damage=100}, {damage=1000},
    {damage=10, add=-20}, {damage=10, add=5},
    {damage=10, talent_boost=15},
}
for _, case in ipairs(weapon_cases) do
    local weapon = case.no_weapon and nil or {dam=case.damage}
    -- Lua's and/or idiom cannot represent nil as its middle branch.
    if case.no_weapon then weapon = nil end
    actor.fixture_talent_boost = case.talent_boost
    case.expected = actor:combatDamagePower(weapon, case.add)
    golden.weapon_damage_power[#golden.weapon_damage_power + 1] = case
end

-- Small canonical JSON writer; no external runtime library or port formulas.
local function quote(value)
    return '"' .. value:gsub('[%z\1-\31\\"]', function(character)
        local simple = {['"']='\\"', ['\\']='\\\\', ['\n']='\\n', ['\r']='\\r', ['\t']='\\t'}
        return simple[character] or string.format('\\u%04x', string.byte(character))
    end) .. '"'
end
local function encode(value)
    local kind = type(value)
    if kind == "nil" then return "null" end
    if kind == "boolean" then return value and "true" or "false" end
    if kind == "number" then return string.format("%.17g", value) end
    if kind == "string" then return quote(value) end
    assert(kind == "table", "Unsupported JSON type: " .. kind)
    local keys = {}
    for key in pairs(value) do keys[#keys+1] = key end
    local array = #keys == #value and #value > 0
    local items = {}
    if array then
        for _, entry in ipairs(value) do items[#items+1] = encode(entry) end
        return "[" .. table.concat(items, ",") .. "]"
    end
    table.sort(keys)
    for _, key in ipairs(keys) do items[#items+1] = quote(key) .. ":" .. encode(value[key]) end
    return "{" .. table.concat(items, ",") .. "}"
end
print("TOME_GOLDEN_JSON=" .. encode(golden))
