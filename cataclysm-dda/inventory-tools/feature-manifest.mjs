#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spanLocator } from './inventory.mjs';

const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('Usage: node feature-manifest.mjs <pristine-source> <completed-inventory-output>');
const summary = JSON.parse(fs.readFileSync(path.join(output, 'summary.json'), 'utf8'));
const files = [];
for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(output, 'files.jsonl')), crlfDelay: Infinity })) if (line) files.push(JSON.parse(line));
const sourceFiles = files.filter(file => file.kind === 'source');
const families = [
  { id: 'turns-world-lifecycle', name: 'Game initialization, worlds, scenarios, character creation, turns and commands', source: /^(?:game|avatar_action|worldfactory|scenario|start_location|newcharacter|gamemode|special_game|auto_pickup|auto_notes|safe_mode|zones|zone_manager)/, data: /^(?:SCENARIO|start_location|WORLD_OPTION|EXTERNAL_OPTION|zone_type|MOD_INFO)$/ },
  { id: 'world-map-generation', name: 'Overmaps, terrain, furniture, map generation, reality bubble, vision and navigation', source: /^(?:map|overmap|regional_settings|line|point|coordinates|map_extras|rot|pathfinding|clzones|fov|shadowcasting|lightmap)/, data: /^(?:mapgen|overmap|city|region|terrain|furniture|map_extra|oter|overmap_terrain|overmap_special|overmap_location|overmap_connection|overmap_land_use_code|overmap_special_migration|ter_furn_transform|jmapgen|ascii_art)/i },
  { id: 'survival-physiology', name: 'Body parts, wounds, healing, fatigue, sleep, thirst, hunger, calories, disease, temperature and morale', source: /^(?:bodypart|body_part|bodytemp|character|player|avatar|suffer|morale|stomach|vitamin|effect|disease|character_effects|character_attire|character_health|character_body|character_morale|character_turn|character_functions|character_armor|character_encumbrance|character_gun|character_inventory|character_id|character_display|character_ability|character_bionics)/, data: /^(?:body_part|bodypart|effect_type|vitamin|disease|addiction_type|morale_type|anatomy|limb_score|body_graph|damage_type_order)$/i },
  { id: 'skills-mutations-bionics', name: 'Skills, proficiencies, traits, mutations, bionics, professions and backgrounds', source: /^(?:skill|proficiency|mutation|bionics|profession|trait|mood_face|character_magic|character_mutation)/, data: /^(?:skill|proficiency|proficiency_category|mutation|mutation_category|mutation_type|trait|bionic|profession|profession_item_substitutions|background|skill_display_type)$/i },
  { id: 'items-inventory-use', name: 'Item types, containers, pockets, inventory, wear, wield, charges, food, use actions and item migrations', source: /^(?:item|inventory|iuse|itype|i_armor|i_add|material|harvest|pickup|ammo|reload|pocket|contents|units)/, data: /^(?:GENERIC|AMMO|ARMOR|TOOL|TOOL_ARMOR|GUN|GUNMOD|COMESTIBLE|BOOK|ENGINE|WHEEL|BATTERY|BIONIC_ITEM|MAGAZINE|PET_ARMOR|item|item_group|item_category|item_action|item_migration|material|ammunition_type|fault|fault_fix|harvest|quality|requirement)$/i },
  { id: 'activities-crafting-construction', name: 'Activities, crafting, recipes, disassembly, building, repairing, farming, fishing, foraging and butchery', source: /^(?:activity|craft|construction|recipe|requirements|repair|butcher|digging|farming|fishing|mining|cooking|disassembly|make_cata_scope|long_action)/, data: /^(?:activity_type|recipe|recipe_category|recipe_group|recipe_nested|uncraft|construction|construction_category|construction_group|requirement|practice|harvest_drop_type)$/i },
  { id: 'combat-damage', name: 'Melee, ranged fire, aiming, throwing, martial arts, defenses, projectiles, explosives and damage', source: /^(?:attack|ballistics|damage|defense|explosion|projectile|ranged|melee|martialarts|weakpoint|hit|throw|dealing_damage)/, data: /^(?:martial_art|technique|damage_type|damage_info_order|weapon_category|weakpoint_set|MONSTER_ATTACK|monster_attack|hit_range|damage_type_order)$/i },
  { id: 'creatures-ai', name: 'Creatures, monster attacks, behavior, spawning, movement, NPC schedules and companions', source: /^(?:monster|mon_|mattack|mdefense|monattack|monmove|monstergenerator|npc|creature|behavior|talker|faction|companion)/, data: /^(?:MONSTER|MONSTER_FACTION|monstergroup|monster_flag|monster_adjustment|npc|npc_class|faction|behavior|species|monster_migration|monstergroup_migration)$/i },
  { id: 'dialogue-quests-trade-camps', name: 'Dialogue, dynamic text, trade, missions, quests, events, achievements, faction camps and jobs', source: /^(?:mission|dialogue|dialog|talk|event|achievement|quest|trade|barter|faction_camp|faction_camp_functions|faction_camp_activity|camp|faction|npctalk|npc_chat|npc_favor)/, data: /^(?:talk_topic|mission_definition|event_statistic|event_transformation|achievement|conduct|npc|npc_class|faction|camp|camp_recipe)$/i },
  { id: 'vehicles-power', name: 'Vehicles, parts, driving, physics, collision, autopilot, engines, batteries, electrical grids and appliances', source: /^(?:veh|vehicle|distribution_grid|active_tile_data|veh_type|veh_interact|appliance)/, data: /^(?:vehicle|vehicle_part|vehicle_group|vehicle_placement|vehicle_spawn|vehicle_part_category|vehicle_migration|vehicle_part_migration|vehicle_location|appliance|fuel_type)$/i },
  { id: 'time-weather-sound-fields', name: 'Calendar, time, weather, wind, scent, light, fields, traps and simulation sounds', source: /^(?:calendar|weather|climate|sounds|scent|field|trap|light|wind|enums)/, data: /^(?:weather_type|weather|field_type|trap|sound_effect|sound_effect_preload|playlist|emit|ter_furn_transform)$/i },
  { id: 'magic-relics', name: 'Spells, enchantments, relics and optional fantasy content', source: /^(?:magic|spell|enchant|relic|artifact|character_magic)/, data: /^(?:SPELL|spell_type|enchantment|relic|artifact)$/i },
  { id: 'persistence-content-rng', name: 'Save/load, compatibility, content loading, migrations, deterministic RNG and serialization', source: /^(?:save|load|json|rng|cata_variant|serialization|mod_manager|mod_tracker|dynamic_data_loader|type_id|generic_factory|string_id|int_id|weighted_list|cached_options|state_helpers)/, data: /(?:migration|BLACKLIST|WHITELIST|MOD_INFO|loading_order|obsolete|json_flag|mod_tileset)/i },
  { id: 'presentation-localization-accessibility', name: 'Terminal and tile drawing, ImGui, menus, panels, help, messages, localization, Unicode and fonts', source: /^(?:curses|sdl|sdltiles|sdl_wrappers|cata_tiles|cata_imgui|imgui|ui|display|output|help|options|translations|translation|language|font|messages|color|catacharset|animation|minimap|panels|game_ui|overmap_ui|debug_menu|editmap|iexamine|iexamine_actors|mmap|text_snippets|string_formatter|string_utils|translations_cache)/, data: /^(?:snippet|speech|mapgen_palette|overlay_order|keybinding|input_context|option_slider|tooltip|help|panel_layout|ascii_art)$/i },
  { id: 'input-actions', name: 'Keyboard, pointer, touch, keybinding contexts, action maps and text entry', source: /^(?:input|action|keybinding|text_input|cata_mobile|android|cata_android)/, data: /^(?:keybinding|input_context)$/i },
  { id: 'platform-files-audio-build', name: 'Filesystem, browser integration, platform services, audio assets, crashes and runtime utilities', source: /^(?:filesystem|path_info|cata_path|cata_utility|cata_atomic|cata_scope_helpers|debug|crash|network|cata_curl|cata_libintl|version|filesystem|cata_fs)/, data: /^(?:sound_effect|sound_effect_preload|playlist|tileset|font|mod_tileset)$/i },
];
const stem = file => path.basename(file).replace(/\.[^.]+$/, '');
// These additions were audited against this release's actual residual file list.
// They classify features at file granularity; each function boundary still needs review.
const additionalSources = {
  'turns-world-lifecycle': ['auto_note', 'diary', 'distraction_manager', 'do_turn', 'global_vars', 'grab', 'handle_action', 'init', 'kill_tracker', 'main', 'move_mode', 'past_achievements_info', 'past_games_info', 'stats_tracker'],
  'world-map-generation': ['cellular_automata', 'city', 'coordinate_conversions', 'coords_fwd', 'cube_direction', 'cuboid_rectangle', 'current_map', 'distribution', 'flood_fill', 'gates', 'jmapgen_flags', 'level_cache', 'omdata', 'rect_range', 'simple_pathfinding', 'simplexnoise', 'submap', 'teleport'],
  'survival-physiology': ['addiction', 'anatomy', 'armor_layers', 'bodygraph', 'climbing', 'consumption', 'sleep', 'subbodypart'],
  'skills-mutations-bionics': ['bonuses'],
  'items-inventory-use': ['active_item_cache', 'advanced_inv_area', 'advanced_inv_listitem', 'advanced_inv_pagination', 'advanced_inv_pane', 'advanced_inv', 'clothing_mod', 'fault', 'flag', 'gun_mode', 'handle_liquid', 'temp_crafting_inventory'],
  'activities-crafting-construction': ['build_reqs', 'shearing'],
  'combat-damage': ['dispersion', 'fragment_cloud'],
  'creatures-ai': ['mondeath', 'mondefense', 'monexamine', 'monfaction', 'mongroup', 'mtype', 'speed_description'],
  'dialogue-quests-trade-camps': ['basecamp', 'computer_session', 'computer', 'condition', 'shop_cons_rate', 'speech', 'timed_event'],
  'vehicles-power': ['smart_controller_ui', 'tileray', 'turret', 'vpart_position', 'vpart_range'],
  'time-weather-sound-fields': ['emit', 'fire', 'fungal_effects', 'music'],
  'persistence-content-rng': ['flexbuffer_cache', 'flexbuffer_json-inl', 'flexbuffer_json', 'memorial_logger', 'tgz_archiver', 'zzip_stack', 'zzip'],
  'presentation-localization-accessibility': ['ascii_art', 'char_validity_check', 'diary_ui', 'drawing_primitives', 'end_screen', 'lang_stats', 'lang_stats.inc', 'list', 'live_view', 'localized_comparator', 'main_menu', 'medical_ui', 'memorial_logger', 'mod_tileset', 'ncurses_def', 'overlay_ordering', 'pinyin', 'pixel_minimap_projectors', 'pixel_minimap', 'popup', 'safemode_ui', 'scores_ui', 'smart_controller_ui', 'speech', 'speed_description', 'string_editor_window', 'string_input_popup', 'system_locale', 'text_style_check_reader', 'text_style_check', 'text', 'unicode', 'viewer', 'wcwidth', 'widget', 'wincurse', 'wish'],
  'input-actions': ['handle_action', 'string_editor_window', 'string_input_popup'],
  'platform-files-audio-build': ['CMakeLists', 'cata_io', 'emscripten_exception', 'get_version', 'io_tags', 'mingw.thread', 'ofstream_wrapper', 'platform_win', 'prefix.h', 'resource', 'std_hash_fs_path'],
};
const additionalTypes = {
  'turns-world-lifecycle': ['scenario', 'profession_group', 'movement_mode', 'LOOT_ZONE', 'zone_type'],
  'world-map-generation': ['connect_group', 'palette', 'ter_str_id', 'furn_str_id', 'palette_id', 'nested_mapgen_id', 'rotatable_symbol', 'climbing_aid', 'gate'],
  'survival-physiology': ['sub_body_part', 'character_mod', 'disease_type', 'scent_type', 'dream'],
  'skills-mutations-bionics': ['trait_group', 'mutagen_group', 'bionic_group'],
  'items-inventory-use': ['clothing_mod', 'fault_group', 'tool_quality', 'nested_category', 'ammunition_type'],
  'activities-crafting-construction': ['butchery_requirement'],
  'combat-damage': ['attack_vector', 'ammo_effect'],
  'creatures-ai': ['mood_face', 'speed_description'],
  'dialogue-quests-trade-camps': ['effect_on_condition', 'effect_on_conditions', 'jmath_function', 'shopkeeper_consumption_rates', 'score'],
  'magic-relics': ['magic_type', 'relic_procgen_data'],
  'presentation-localization-accessibility': ['widget', 'end_screen', 'colordef'],
  'persistence-content-rng': ['test_data', 'json_flag'],
};
families.push({ id: 'support-utilities-vendor', name: 'Shared utilities, containers, third-party libraries and source maintenance tools', source: /^(?:all_enum|assign$|cartesian_product|cata_(?:algo|assert|bitset|flatbuffers_assert|inline|lazy|small_literal_vector|type_traits|unreachable|views)|clone_ptr|colony|common_types|compatibility|demangle|dependency_tree|enum_|flat_set|hash_utils|lru_cache|make_static|math_defines|mdarray|memory_fast|ordered_static_globals|perf$|pimpl|ret_val|safe_reference|sets_intersect|test_data|to_string_id|try_parse_integer|value_ptr|visitable|weighted_dbl_or_var_list)/, data: /^(?:int|float|string|bool|git|\(no type\))$/ });
const sourceFamilies = file => families.filter(family => family.source.test(stem(file)) || additionalSources[family.id]?.includes(stem(file)) || (family.id === 'dialogue-quests-trade-camps' && stem(file).startsWith('math_parser')) || (family.id === 'support-utilities-vendor' && /^(?:src\/third-party\/|src\/chkjson\/)/.test(file))).map(family => family.id);
const typeFamilies = type => families.filter(family => family.data.test(type) || additionalTypes[family.id]?.includes(type)).map(family => family.id);
const layer = file => /^(?:input|action|keybinding|text_input|cata_mobile|android|cata_android)/.test(stem(file)) ? 'input' : /^(?:filesystem|path_info|cata_path|cata_fs|network|cata_curl|crash|version)/.test(stem(file)) ? 'platform' : /^(?:curses|sdl|cata_tiles|cata_imgui|imgui|ui|display|output|help|options|translations|translation|language|font|messages|color|catacharset|animation|minimap|panels|game_ui|overmap_ui|debug_menu|editmap|text_snippets|string_formatter)/.test(stem(file)) ? 'presentation' : 'logic';
const sourceAssignments = sourceFiles.map(file => ({ file: file.file, physicalLines: file.physicalLines ?? null, sha256: file.sha256, recommendedLayer: layer(file.file), featureFamilies: sourceFamilies(file.file), migrationStatus: 'retained-upstream; not independently verified as Rust-migrated', needsBoundaryReview: true }));
const typeScopes = new Map(), definitions = new Map();
for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(output, 'data-objects.jsonl')), crlfDelay: Infinity })) {
  if (!line) continue;
  const object = JSON.parse(line), type = String(object.type ?? '(no type)'), scopes = typeScopes.get(type) ?? { definitionObjects: 0, nestedObjects: 0, configurationObjects: 0, enclosingDefinitionTypes: {} };
  typeScopes.set(type, scopes);
  const isGameFile = /^data\//.test(object.file), isDefinition = isGameFile && /^(?:|\/\d+)$/.test(object.pointer);
  if (isDefinition) { scopes.definitionObjects++; definitions.set(object.file + '\0' + object.pointer, type); }
  else if (!isGameFile) scopes.configurationObjects++;
  else {
    scopes.nestedObjects++;
    const rootPointer = /^\/\d+/.exec(object.pointer)?.[0] ?? '';
    const enclosing = definitions.get(object.file + '\0' + rootPointer) ?? '(unknown enclosing definition)';
    scopes.enclosingDefinitionTypes[enclosing] = (scopes.enclosingDefinitionTypes[enclosing] ?? 0) + 1;
  }
}
const dataAssignments = Object.entries(summary.dataTypes).map(([type, count]) => {
  const scopeCounts = typeScopes.get(type) ?? { definitionObjects: 0, nestedObjects: 0, configurationObjects: 0, enclosingDefinitionTypes: {} };
  const direct = typeFamilies(type), inherited = Object.keys(scopeCounts.enclosingDefinitionTypes).flatMap(typeFamilies);
  const featureFamilies = [...new Set([...direct, ...inherited])];
  if (!scopeCounts.definitionObjects && scopeCounts.configurationObjects) featureFamilies.push('support-utilities-vendor');
  return { type, count, scopeCounts, featureFamilies: [...new Set(featureFamilies)], classificationBasis: direct.length ? 'type taxonomy; nested instances also retain enclosing definition families' : inherited.length ? 'nested value inherits enclosing gameplay definition' : 'residual requires review', migrationStatus: 'retain complete upstream definitions and nested values; test data loader and mechanics parity' };
});
const unclassifiedSources = sourceAssignments.filter(entry => !entry.featureFamilies.length);
const unclassifiedTypes = dataAssignments.filter(entry => !entry.featureFamilies.length);
const criticalPatterns = new Map([
  ['rendering-rng-boundary', /\b(?:rng|rng_float|one_in|x_in_y|random_entry|random_entry_ref)\s*\(/g],
  ['save-version-constants', /\b(?:savegame_version|SAVEGAME_VERSION|SAVE_VERSION|save_version)\b/g],
]);
const boundaryEvidence = [];
for (const assignment of sourceAssignments) {
  if (!/\.(?:cpp|h|hpp)$/.test(assignment.file)) continue;
  const relevant = assignment.recommendedLayer === 'presentation' || /(?:npctalk|rng|savegame|game\.cpp|sdl|output)/.test(assignment.file);
  if (!relevant) continue;
  const text = fs.readFileSync(path.join(source, assignment.file), 'utf8'), locate = spanLocator(text);
  for (const [kind, pattern] of criticalPatterns) for (const match of text.matchAll(pattern)) {
    if (kind === 'rendering-rng-boundary' && assignment.recommendedLayer !== 'presentation' && !/npctalk/.test(assignment.file)) continue;
    boundaryEvidence.push({ file: assignment.file, kind, recommendedLayer: assignment.recommendedLayer, token: match[0], span: locate(match.index, match.index + match[0].length), reviewStatus: 'candidate; inspect call context to rule out comments, tests and simulation entry points' });
  }
}
const webFile = 'build-scripts/prepare-web.sh', web = fs.readFileSync(path.join(source, webFile), 'utf8'), locateWeb = spanLocator(web);
const webOmissions = [];
for (const match of web.matchAll(/^.*(?:rm\b|exclude|LOCALIZE|LANG|TILES|mods|tiles|lang|sound|gfx).*$/gm)) webOmissions.push({ file: webFile, text: match[0], span: locateWeb(match.index, match.index + match[0].length), reviewStatus: 'inspect packaging impact; exact script line retained' });
const parserFolder = path.join(source, 'lang', 'string_extractor', 'parsers');
const translationParsers = fs.existsSync(parserFolder) ? fs.readdirSync(parserFolder).filter(file => file.endsWith('.py')).sort().map(file => `lang/string_extractor/parsers/${file}`) : [];
const manifest = { schemaVersion: 1, provenance: summary.provenance, architecture: { orderedLayers: ['logic', 'presentation', 'platform', 'input'], planAuthority: 'User Page supplied to parent; original C++ logic retained with incremental Rust migration', assignmentMeaning: 'Migration recommendations only. Filename classification does not establish clean architecture boundaries.' }, counts: { sourceFiles: sourceAssignments.length, dataTypes: dataAssignments.length, unclassifiedSources: unclassifiedSources.length, unclassifiedTypes: unclassifiedTypes.length }, featureFamilies: families.map(({ id, name }) => ({ id, name, sourceFiles: sourceAssignments.filter(entry => entry.featureFamilies.includes(id)).length, dataTypes: dataAssignments.filter(entry => entry.featureFamilies.includes(id)).length, status: 'retained upstream; parity tests and incremental layer extraction pending' })), sourceAssignments, dataAssignments, unclassifiedSources, unclassifiedTypes, boundaryEvidence, webPackagingEvidence: webOmissions, translationParsers, milestones: [
  { id: 'M0', goal: 'Immutable source and exact inventories', acceptance: 'Verified source hash/license manifest; all relevant files and residual classifications accounted for; exact PO plurals/contexts and JSON source spans retained.' },
  { id: 'M1', goal: 'Full engine browser baseline', acceptance: 'Compile official engine for Emscripten; retain required data/mods/assets and licenses; Japanese input/fonts and localization; create world/character and playable full turn loop in PC/mobile browser.' },
  { id: 'M2', goal: 'Rust presentation/platform/input boundaries', acceptance: 'Frame rendering consumes immutable snapshot; keyboard/touch commands isolated; persistent browser storage and audio adapters; no rendering-caused simulation/RNG change.' },
  { id: 'M3', goal: 'Versioned deterministic save and commands', acceptance: 'Command/event boundary, seeded replay and RNG state; load old supported saves; save/resume world, character, inventory, NPCs, vehicles, weather and pending activities; deterministic serialization checks.' },
  { id: 'M4', goal: 'Reviewed semantic English/Japanese JSON', acceptance: 'Catalog contains every production text ID, context/plural/parameter contract; missing entries and rejected placeholders reviewed; all JSON extractor handlers reconciled; user names preserved; CJK layouts verified.' },
  { id: 'M5', goal: 'Incremental gameplay logic migration', acceptance: 'Migrate each listed feature family against reference parity tests; maintain complete original engine between milestones; resolve every residual source/data type classification.' },
  { id: 'M6', goal: 'Private independent Site deployment', acceptance: 'Verified full flows, portable WASM packaging, license/source obligations and real browser smoke checks; publish only tested release artifact; record exact deployment URL.' },
] };
fs.writeFileSync(path.join(output, 'feature-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const md = '# Gameplay and four-layer migration backlog\n\nThis inventory preserves the complete original source and data. It records migration work; it does not claim a complete Rust port or mechanically verified coverage.\n\n| Feature family | Source files | Data types | Status |\n| --- | ---: | ---: | --- |\n'
  + manifest.featureFamilies.map(family => `| ${family.name} | ${family.sourceFiles} | ${family.dataTypes} | Retained upstream; migration/parity checks pending |`).join('\n')
  + `\n\n${unclassifiedSources.length} source files and ${unclassifiedTypes.length} JSON types still need classification review. Every residual is included in \`feature-manifest.json\`; none is silently omitted. Families overlap where a feature crosses systems.\n\n## Required milestones\n\n`
  + manifest.milestones.map(milestone => `- **${milestone.id}: ${milestone.goal}.** ${milestone.acceptance}`).join('\n')
  + '\n\n## Exact packaging evidence\n\n'
  + webOmissions.map(entry => `- ${entry.file}:${entry.span.start.line}: \`${entry.text.replaceAll('`', "'")}\``).join('\n')
  + '\n\nThe upstream Web preparation script is a filtered bundle. The release must account for every omitted category and every content/assets license; use the recorded script lines and file inventory before deciding what to retain.\n\n## Translation coverage verification\n\n'
  + `The upstream has ${translationParsers.length} JSON localization parser modules. Heuristic JSON candidates must be reconciled with those modules. The complete list, boundary/RNG candidates, source assignments and JSON type assignments are in \`feature-manifest.json\`.\n`;
fs.writeFileSync(path.join(output, 'MIGRATION-BACKLOG.md'), md);
console.log(JSON.stringify({ counts: manifest.counts, featureFamilies: manifest.featureFamilies, boundaryCandidates: boundaryEvidence.length, translationParsers: translationParsers.length, webEvidenceLines: webOmissions.length }, null, 2));
