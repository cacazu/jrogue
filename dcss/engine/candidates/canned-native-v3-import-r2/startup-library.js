mergeInto(LibraryManager.library, {
  // Reviewed synchronous presentation import: original45 startup/HUD plus source-bound canned45.
  dcss_host_startup_text__deps: ['$lengthBytesUTF8', '$stringToUTF8'],
  dcss_host_startup_text: function(idPtr, paramsPtr, destination, capacity) {
    try {
      const reviewed = {"upstream":"1eebc1a2892e1c89776a0d7a10691f8dac8d9796","messages":{"startup.weapon.prompt":{"en":"You have a choice of weapons.","ja":"武器を選べます。","parameters":{}},"startup.weapon.recommended.label":{"en":"+ - Recommended random choice","ja":"+ - おすすめからランダム選択","parameters":{}},"startup.weapon.recommended.description":{"en":"Picks a random recommended weapon","ja":"おすすめの武器からランダムに選びます","parameters":{}},"startup.weapon.aptitudes.label":{"en":"% - List aptitudes","ja":"% - 適性一覧","parameters":{}},"startup.weapon.aptitudes.description":{"en":"Lists the numerical skill train aptitudes for all races","ja":"全種族の技能訓練適性を数値で表示します","parameters":{}},"startup.weapon.help.label":{"en":"? - Help","ja":"? - ヘルプ","parameters":{}},"startup.weapon.help.description":{"en":"Opens the help screen","ja":"ヘルプ画面を開きます","parameters":{}},"startup.weapon.random.label":{"en":"* - Random weapon","ja":"* - ランダムな武器","parameters":{}},"startup.weapon.random.description":{"en":"Picks a random weapon","ja":"武器をランダムに選びます","parameters":{}},"startup.weapon.back.label":{"en":"Bksp - Return to character menu","ja":"Bksp - キャラクター選択に戻る","parameters":{}},"startup.weapon.back.description":{"en":"Lets you return back to Character choice menu","ja":"キャラクター選択メニューに戻ります","parameters":{}},"startup.dynamic.species_name":{"en":"{species}","ja":"{species}","parameters":{"species":{"type":"entity_label","role":"species"}}},"startup.dynamic.job_name":{"en":"{job}","ja":"{job}","parameters":{"job":{"type":"entity_label","role":"job"}}},"startup.dynamic.character.a":{"en":"You are a {species} {job}.","ja":"あなたは{species}の{job}です。","parameters":{"species":{"type":"entity_label","role":"species"},"job":{"type":"entity_label","role":"job"}}},"startup.dynamic.character.an":{"en":"You are an {species} {job}.","ja":"あなたは{species}の{job}です。","parameters":{"species":{"type":"entity_label","role":"species"},"job":{"type":"entity_label","role":"job"}}},"startup.dynamic.welcome.empty":{"en":"Welcome.","ja":"ようこそ。","parameters":{}},"startup.dynamic.welcome.named_only":{"en":"Welcome, {player_name}.","ja":"{player_name}さん、ようこそ。","parameters":{"player_name":{"type":"actor_label","role":"external_username"}}},"startup.dynamic.welcome.named_job":{"en":"Welcome, {player_name} the {job}.","ja":"{job}の{player_name}さん、ようこそ。","parameters":{"job":{"type":"entity_label","role":"job"},"player_name":{"type":"actor_label","role":"external_username"}}},"startup.dynamic.welcome.named_species":{"en":"Welcome, {player_name} the {species}.","ja":"{species}の{player_name}さん、ようこそ。","parameters":{"species":{"type":"entity_label","role":"species"},"player_name":{"type":"actor_label","role":"external_username"}}},"startup.dynamic.welcome.named_species_job":{"en":"Welcome, {player_name} the {species} {job}.","ja":"{species}の{job}、{player_name}さん、ようこそ。","parameters":{"species":{"type":"entity_label","role":"species"},"job":{"type":"entity_label","role":"job"},"player_name":{"type":"actor_label","role":"external_username"}}},"startup.dynamic.welcome.unnamed_job":{"en":"Welcome, unnamed {job}.","ja":"名無しの{job}さん、ようこそ。","parameters":{"job":{"type":"entity_label","role":"job"}}},"startup.dynamic.welcome.unnamed_species":{"en":"Welcome, unnamed {species}.","ja":"名無しの{species}さん、ようこそ。","parameters":{"species":{"type":"entity_label","role":"species"}}},"startup.dynamic.welcome.unnamed_species_job":{"en":"Welcome, unnamed {species} {job}.","ja":"名無しの{species}の{job}さん、ようこそ。","parameters":{"species":{"type":"entity_label","role":"species"},"job":{"type":"entity_label","role":"job"}}},"hud.magic.drained_label":{"en":"MP: ","ja":"魔: ","parameters":{}},"hud.magic.label":{"en":"Magic:  ","ja":"魔力:   ","parameters":{}},"hud.health.drained_label":{"en":"HP: ","ja":"体: ","parameters":{}},"hud.health.label":{"en":"Health: ","ja":"体力:   ","parameters":{}},"hud.noise.label":{"en":"Noise: ","ja":"騒音:  ","parameters":{}},"hud.noise.silenced":{"en":"Silenced  ","ja":"沈黙      ","parameters":{}},"hud.gold.label":{"en":"Gold:","ja":"金貨:","parameters":{}},"hud.doom.label":{"en":"Doom: ","ja":"破滅: ","parameters":{}},"hud.contamination.label":{"en":"Contam: ","ja":"汚染:   ","parameters":{}},"hud.experience.label":{"en":"XL: ","ja":"級: ","parameters":{}},"hud.next_level.label":{"en":"Next: ","ja":"次:   ","parameters":{}},"hud.place.label":{"en":"Place: ","ja":"場所:  ","parameters":{}},"hud.armour.label":{"en":"AC:","ja":"防:","parameters":{}},"hud.evasion.label":{"en":"EV:","ja":"避:","parameters":{}},"hud.shield.label":{"en":"SH:","ja":"盾:","parameters":{}},"hud.strength.label":{"en":"Str:","ja":"力: ","parameters":{}},"hud.intelligence.label":{"en":"Int:","ja":"知: ","parameters":{}},"hud.dexterity.label":{"en":"Dex:","ja":"技: ","parameters":{}},"hud.time.label":{"en":"Time:","ja":"時間:","parameters":{}},"hud.turn.label":{"en":"Turn:","ja":"手番:","parameters":{}},"hud.equipment.compact_label":{"en":"Eq: ","ja":"装: ","parameters":{}},"hud.equipment.label":{"en":"Equip: ","ja":"装備:  ","parameters":{}},"game.canned.something_appears.at_feet":{"en":"Something appears at your feet!","ja":"足元に何かが現れた！","parameters":{}},"game.canned.something_appears.before_you":{"en":"Something appears before you!","ja":"目の前に何かが現れた！","parameters":{}},"game.canned.nothing_happens":{"en":"Nothing appears to happen.","ja":"何も起きていないようだ。","parameters":{}},"game.canned.you_unaffected":{"en":"You are unaffected.","ja":"影響を受けなかった。","parameters":{}},"game.canned.you_resist":{"en":"You resist.","ja":"抵抗した。","parameters":{}},"game.canned.you_partially_resist":{"en":"You partially resist.","ja":"部分的に抵抗した。","parameters":{}},"game.canned.too_berserk":{"en":"You are too berserk!","ja":"狂戦士化しているため、それはできない！","parameters":{}},"game.canned.too_confused":{"en":"You are too confused!","ja":"混乱がひどすぎる！","parameters":{}},"game.canned.present_form":{"en":"You can't do that in your present form.","ja":"今の姿ではそれはできない。","parameters":{}},"game.canned.nothing_carried":{"en":"You aren't carrying anything.","ja":"何も所持していない。","parameters":{}},"game.canned.cannot_do_yet":{"en":"You can't do that yet.","ja":"まだそれはできない。","parameters":{}},"game.canned.ok":{"en":"Okay, then.","ja":"では、それで。","parameters":{}},"game.canned.unthinking_act":{"en":"Why would you want to do that?","ja":"なぜそんなことをしたいのだろう？","parameters":{}},"game.canned.nothing_there":{"en":"There's nothing there!","ja":"そこには何もない！","parameters":{}},"game.canned.nothing_close_enough":{"en":"There's nothing close enough!","ja":"届くほど近くには何もない！","parameters":{}},"game.canned.spell_fizzles":{"en":"The spell fizzles.","ja":"呪文は不発に終わった。","parameters":{}},"game.canned.huh":{"en":"Huh?","ja":"えっ？","parameters":{}},"game.canned.empty_handed_already.mouth":{"en":"Your mouth is already empty.","ja":"すでに口には武器をくわえていない。","parameters":{}},"game.canned.empty_handed_already.claws":{"en":"You are already empty-clawed.","ja":"すでに爪で武器を握っていない。","parameters":{}},"game.canned.empty_handed_already.tentacles":{"en":"You are already empty-tentacled.","ja":"すでに触手で武器を持っていない。","parameters":{}},"game.canned.empty_handed_already.hands":{"en":"You are already empty-handed.","ja":"すでに手に武器を持っていない。","parameters":{}},"game.canned.empty_handed_now.mouth":{"en":"Your mouth is now empty.","ja":"今は口に武器をくわえていない。","parameters":{}},"game.canned.empty_handed_now.claws":{"en":"You are now empty-clawed.","ja":"今は爪で武器を握っていない。","parameters":{}},"game.canned.empty_handed_now.tentacles":{"en":"You are now empty-tentacled.","ja":"今は触手で武器を持っていない。","parameters":{}},"game.canned.empty_handed_now.hands":{"en":"You are now empty-handed.","ja":"今は手に武器を持っていない。","parameters":{}},"game.canned.you_blink":{"en":"You blink.","ja":"あなたは短距離転移した。","parameters":{}},"game.canned.strange_stasis":{"en":"You feel a strange sense of stasis.","ja":"不思議な停滞感を覚えた。","parameters":{}},"game.canned.no_spells":{"en":"You don't know any spells.","ja":"呪文を一つも習得していない。","parameters":{}},"game.canned.mana_increase":{"en":"You feel your magic capacity increase.","ja":"魔力の容量が増したのを感じる。","parameters":{}},"game.canned.mana_decrease":{"en":"You feel your magic capacity decrease.","ja":"魔力の容量が減ったのを感じる。","parameters":{}},"game.canned.disoriented":{"en":"You feel momentarily disoriented.","ja":"一瞬、方向感覚を失った。","parameters":{}},"game.canned.detect_nothing":{"en":"You detect nothing.","ja":"何も感知しない。","parameters":{}},"game.canned.cannot_move":{"en":"You cannot move.","ja":"動けない。","parameters":{}},"game.canned.you_die":{"en":"You die...","ja":"あなたは死んだ……","parameters":{}},"game.canned.ghostly_outline":{"en":"You see a ghostly outline there, and the spell fizzles.","ja":"そこにおぼろげな輪郭が見え、呪文は不発に終わった。","parameters":{}},"game.canned.full_health":{"en":"Your health is already full.","ja":"体力はすでに最大だ。","parameters":{}},"game.canned.full_magic":{"en":"Your reserves of magic are already full.","ja":"魔力はすでに満ちている。","parameters":{}},"game.canned.gain_health":{"en":"You feel better.","ja":"体調がよくなった。","parameters":{}},"game.canned.gain_magic":{"en":"You feel your power returning.","ja":"魔力が戻ってくるのを感じる。","parameters":{}},"game.canned.magic_drain.hp_casting":{"en":"You feel momentarily drained.","ja":"一瞬、消耗したように感じる。","parameters":{}},"game.canned.magic_drain.magic_energy":{"en":"You suddenly feel drained of magical energy!","ja":"突然、魔力が失われたのを感じる！","parameters":{}},"game.canned.something_in_way":{"en":"There's something in the way.","ja":"何かが邪魔をしている。","parameters":{}},"game.canned.cannot_see":{"en":"You can't see that place.","ja":"その場所は見えない。","parameters":{}},"game.canned.god_declines":{"en":"Your god isn't willing to do this for you now.","ja":"信仰する神は今、あなたのためにそれを行うつもりはない。","parameters":{}},"game.canned.no_available_space":{"en":"There is no available space!","ja":"空いている場所がない！","parameters":{}}},"entities":{"species":{"species.sp_armataur.name":{"en":"Armataur","ja":"アルマタウル","identity":"SP_ARMATAUR"},"species.sp_barachi.name":{"en":"Barachi","ja":"バラキ","identity":"SP_BARACHI"},"species.sp_base_draconian.name":{"en":"Draconian","ja":"ドラコニアン","identity":"SP_BASE_DRACONIAN"},"species.sp_black_draconian.name":{"en":"Black Draconian","ja":"黒色ドラコニアン","identity":"SP_BLACK_DRACONIAN"},"species.sp_centaur.name":{"en":"Centaur","ja":"ケンタウロス","identity":"SP_CENTAUR"},"species.sp_coglin.name":{"en":"Coglin","ja":"コグリン","identity":"SP_COGLIN"},"species.sp_deep_dwarf.name":{"en":"Deep Dwarf","ja":"深層ドワーフ","identity":"SP_DEEP_DWARF"},"species.sp_deep_elf.name":{"en":"Deep Elf","ja":"深層エルフ","identity":"SP_DEEP_ELF"},"species.sp_demigod.name":{"en":"Demigod","ja":"半神","identity":"SP_DEMIGOD"},"species.sp_demonspawn.name":{"en":"Demonspawn","ja":"魔神の末裔","identity":"SP_DEMONSPAWN"},"species.sp_djinni.name":{"en":"Djinni","ja":"ジン","identity":"SP_DJINNI"},"species.sp_felid.name":{"en":"Felid","ja":"猫人","identity":"SP_FELID"},"species.sp_formicid.name":{"en":"Formicid","ja":"蟻人","identity":"SP_FORMICID"},"species.sp_gargoyle.name":{"en":"Gargoyle","ja":"ガーゴイル","identity":"SP_GARGOYLE"},"species.sp_ghoul.name":{"en":"Ghoul","ja":"グール","identity":"SP_GHOUL"},"species.sp_gnoll.name":{"en":"Gnoll","ja":"ノール","identity":"SP_GNOLL"},"species.sp_green_draconian.name":{"en":"Green Draconian","ja":"緑色ドラコニアン","identity":"SP_GREEN_DRACONIAN"},"species.sp_grey_draconian.name":{"en":"Grey Draconian","ja":"灰色ドラコニアン","identity":"SP_GREY_DRACONIAN"},"species.sp_halfling.name":{"en":"Halfling","ja":"ハーフリング","identity":"SP_HALFLING"},"species.sp_high_elf.name":{"en":"High Elf","ja":"ハイエルフ","identity":"SP_HIGH_ELF"},"species.sp_hill_orc.name":{"en":"Hill Orc","ja":"丘オーク","identity":"SP_HILL_ORC"},"species.sp_human.name":{"en":"Human","ja":"人間","identity":"SP_HUMAN"},"species.sp_kobold.name":{"en":"Kobold","ja":"コボルド","identity":"SP_KOBOLD"},"species.sp_lava_orc.name":{"en":"Lava Orc","ja":"溶岩オーク","identity":"SP_LAVA_ORC"},"species.sp_mayflytaur.name":{"en":"Mayflytaur","ja":"カゲロウタウル","identity":"SP_MAYFLYTAUR"},"species.sp_merfolk.name":{"en":"Merfolk","ja":"人魚","identity":"SP_MERFOLK"},"species.sp_meteoran.name":{"en":"Meteoran","ja":"メテオラン","identity":"SP_METEORAN"},"species.sp_minotaur.name":{"en":"Minotaur","ja":"ミノタウロス","identity":"SP_MINOTAUR"},"species.sp_mottled_draconian.name":{"en":"Mottled Draconian","ja":"斑模様のドラコニアン","identity":"SP_MOTTLED_DRACONIAN"},"species.sp_mountain_dwarf.name":{"en":"Mountain Dwarf","ja":"山岳ドワーフ","identity":"SP_MOUNTAIN_DWARF"},"species.sp_mummy.name":{"en":"Mummy","ja":"ミイラ","identity":"SP_MUMMY"},"species.sp_naga.name":{"en":"Naga","ja":"ナーガ","identity":"SP_NAGA"},"species.sp_octopode.name":{"en":"Octopode","ja":"オクトポード","identity":"SP_OCTOPODE"},"species.sp_oni.name":{"en":"Oni","ja":"鬼","identity":"SP_ONI"},"species.sp_pale_draconian.name":{"en":"Pale Draconian","ja":"淡色ドラコニアン","identity":"SP_PALE_DRACONIAN"},"species.sp_poltergeist.name":{"en":"Poltergeist","ja":"ポルターガイスト","identity":"SP_POLTERGEIST"},"species.sp_purple_draconian.name":{"en":"Purple Draconian","ja":"紫色ドラコニアン","identity":"SP_PURPLE_DRACONIAN"},"species.sp_red_draconian.name":{"en":"Red Draconian","ja":"赤色ドラコニアン","identity":"SP_RED_DRACONIAN"},"species.sp_revenant.name":{"en":"Revenant","ja":"レヴナント","identity":"SP_REVENANT"},"species.sp_sludge_elf.name":{"en":"Sludge Elf","ja":"泥エルフ","identity":"SP_SLUDGE_ELF"},"species.sp_spriggan.name":{"en":"Spriggan","ja":"スプリガン","identity":"SP_SPRIGGAN"},"species.sp_tengu.name":{"en":"Tengu","ja":"天狗","identity":"SP_TENGU"},"species.sp_troll.name":{"en":"Troll","ja":"トロル","identity":"SP_TROLL"},"species.sp_vampire.name":{"en":"Vampire","ja":"吸血鬼","identity":"SP_VAMPIRE"},"species.sp_vine_stalker.name":{"en":"Vine Stalker","ja":"蔓の潜行者","identity":"SP_VINE_STALKER"},"species.sp_white_draconian.name":{"en":"White Draconian","ja":"白色ドラコニアン","identity":"SP_WHITE_DRACONIAN"},"species.sp_yellow_draconian.name":{"en":"Yellow Draconian","ja":"黄色ドラコニアン","identity":"SP_YELLOW_DRACONIAN"}},"job":{"job.job_abyssal_knight.name":{"en":"Abyssal Knight","ja":"深淵の騎士","identity":"JOB_ABYSSAL_KNIGHT"},"job.job_air_elementalist.name":{"en":"Air Elementalist","ja":"風の精霊術師","identity":"JOB_AIR_ELEMENTALIST"},"job.job_alchemist.name":{"en":"Alchemist","ja":"錬金術師","identity":"JOB_ALCHEMIST"},"job.job_artificer.name":{"en":"Artificer","ja":"魔道具使い","identity":"JOB_ARTIFICER"},"job.job_berserker.name":{"en":"Berserker","ja":"狂戦士","identity":"JOB_BERSERKER"},"job.job_brigand.name":{"en":"Brigand","ja":"盗賊","identity":"JOB_BRIGAND"},"job.job_chaos_knight.name":{"en":"Chaos Knight","ja":"混沌の騎士","identity":"JOB_CHAOS_KNIGHT"},"job.job_cinder_acolyte.name":{"en":"Cinder Acolyte","ja":"燃え殻の侍祭","identity":"JOB_CINDER_ACOLYTE"},"job.job_conjurer.name":{"en":"Conjurer","ja":"妖術師","identity":"JOB_CONJURER"},"job.job_death_knight.name":{"en":"Death Knight","ja":"死の騎士","identity":"JOB_DEATH_KNIGHT"},"job.job_delver.name":{"en":"Delver","ja":"探索者","identity":"JOB_DELVER"},"job.job_earth_elementalist.name":{"en":"Earth Elementalist","ja":"地の精霊術師","identity":"JOB_EARTH_ELEMENTALIST"},"job.job_enchanter.name":{"en":"Enchanter","ja":"呪術師","identity":"JOB_ENCHANTER"},"job.job_fighter.name":{"en":"Fighter","ja":"戦士","identity":"JOB_FIGHTER"},"job.job_fire_elementalist.name":{"en":"Fire Elementalist","ja":"炎の精霊術師","identity":"JOB_FIRE_ELEMENTALIST"},"job.job_forgewright.name":{"en":"Forgewright","ja":"鍛造術師","identity":"JOB_FORGEWRIGHT"},"job.job_gladiator.name":{"en":"Gladiator","ja":"剣闘士","identity":"JOB_GLADIATOR"},"job.job_healer.name":{"en":"Healer","ja":"治療師","identity":"JOB_HEALER"},"job.job_hedge_wizard.name":{"en":"Hedge Wizard","ja":"野の魔術師","identity":"JOB_HEDGE_WIZARD"},"job.job_hexslinger.name":{"en":"Hexslinger","ja":"呪術射手","identity":"JOB_HEXSLINGER"},"job.job_hunter.name":{"en":"Hunter","ja":"狩人","identity":"JOB_HUNTER"},"job.job_ice_elementalist.name":{"en":"Ice Elementalist","ja":"氷の精霊術師","identity":"JOB_ICE_ELEMENTALIST"},"job.job_jester.name":{"en":"Jester","ja":"道化師","identity":"JOB_JESTER"},"job.job_monk.name":{"en":"Monk","ja":"修行僧","identity":"JOB_MONK"},"job.job_necromancer.name":{"en":"Necromancer","ja":"死霊術師","identity":"JOB_NECROMANCER"},"job.job_priest.name":{"en":"Priest","ja":"司祭","identity":"JOB_PRIEST"},"job.job_reaver.name":{"en":"Reaver","ja":"略奪者","identity":"JOB_REAVER"},"job.job_shapeshifter.name":{"en":"Shapeshifter","ja":"変身術師","identity":"JOB_SHAPESHIFTER"},"job.job_skald.name":{"en":"Skald","ja":"吟遊詩人","identity":"JOB_SKALD"},"job.job_stalker.name":{"en":"Stalker","ja":"潜行者","identity":"JOB_STALKER"},"job.job_summoner.name":{"en":"Summoner","ja":"召喚術師","identity":"JOB_SUMMONER"},"job.job_wanderer.name":{"en":"Wanderer","ja":"放浪者","identity":"JOB_WANDERER"},"job.job_warper.name":{"en":"Warper","ja":"転移術師","identity":"JOB_WARPER"}}}};
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
  dcss_host_frame: function(ptr, cols, rows, x, y, cursor) {
    if (Module.dcssFrame) {
      const clusters = JSON.parse(UTF8ToString(_dcss_clusters_json()));
      Module.dcssFrame(HEAPU32.slice(ptr >> 2, (ptr >> 2) + cols * rows * 3), cols, rows, x, y, !!cursor, clusters);
    }
  },
  dcss_host_semantic: function(ptr) {
    if (!Module.dcssSemantic) return;
    try { Module.dcssSemantic(JSON.parse(UTF8ToString(ptr))); }
    catch (error) {
      // Locale transport must never throw into canonical gameplay/control.
      try { if (Module.dcssSemanticError) Module.dcssSemanticError(String(error)); }
      catch (_) { /* The original console/control route still runs. */ }
    }
  },
  dcss_host_has_key: function() {
    return Module.dcssHasKey ? Module.dcssHasKey() : 0;
  },
  dcss_host_read_key__async: true,
  dcss_host_read_key__deps: ['$Asyncify'],
  dcss_host_read_key: function() {
    return Asyncify.handleSleep(function(wakeUp) {
      if (!Module.dcssReadKey) throw new Error('DCSS host must provide dcssReadKey(wakeUp)');
      Module.dcssReadKey(wakeUp);
    });
  },
  dcss_host_delay__async: true,
  dcss_host_delay__deps: ['$Asyncify'],
  dcss_host_delay: function(ms) {
    return Asyncify.handleSleep(function(wakeUp) { setTimeout(wakeUp, Math.min(ms, 1000)); });
  }
});

// BEGIN future canned-native V3 private history library
// Future v3 Emscripten private transport. Merge only in a separate reviewed candidate.
mergeInto(LibraryManager.library, {
  $dcssNativeGuard: function(action, failureValue) {
    if (Module.dcssNativeHistoryInCallback) {
      Module.dcssNativeHistoryTransportError = 'reentrant native history callback';
      return failureValue;
    }
    Module.dcssNativeHistoryInCallback = true;
    try {
      if (!Module.dcssNativeHistory) throw new Error('native history adapter unavailable');
      var result = action();
      if (Module.dcssNativeHistoryTransportError) throw new Error(Module.dcssNativeHistoryTransportError);
      return result;
    } catch (error) {
      Module.dcssNativeHistoryTransportError = String(error);
      try { if (Module.dcssNativeHistory) Module.dcssNativeHistory.end(0); } catch (_) {}
      try { if (typeof Module.dcssNativeHistoryError === 'function') Module.dcssNativeHistoryError(String(error)); } catch (_) {}
      return failureValue;
    } finally { Module.dcssNativeHistoryInCallback = false; }
  },
  $dcssNativeRead: function(pointer, length, maximum) {
    if (!Number.isInteger(pointer) || pointer <= 0 || !Number.isInteger(length) || length < 0
        || length > maximum || pointer + length >= HEAPU8.length || HEAPU8[pointer + length] !== 0)
      throw new Error('invalid native history input range/terminator');
    var text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(HEAPU8.subarray(pointer, pointer + length));
    if (text.indexOf('\0') !== -1) throw new Error('embedded NUL in native history input');
    return text;
  },
  $dcssNativeWrite: function(pointer, capacity, text) {
    if (!Number.isInteger(pointer) || pointer <= 0 || !Number.isInteger(capacity) || capacity <= 0
        || pointer + capacity > HEAPU8.length || typeof text !== 'string' || text.indexOf('\0') !== -1)
      throw new Error('invalid native history output range/text');
    var bytes = new TextEncoder().encode(text);
    if (bytes.length >= capacity) throw new Error('native history destination too short');
    HEAPU8.set(bytes, pointer); HEAPU8[pointer + bytes.length] = 0;
    return bytes.length;
  },
  dcss_native_history_begin__deps: ['$dcssNativeGuard'],
  dcss_native_history_begin: function(count) {
    Module.dcssNativeHistoryTransportError = null;
    return dcssNativeGuard(function() { return Module.dcssNativeHistory.begin(count); }, 0);
  },
  dcss_native_history_row__deps: ['$dcssNativeGuard', '$dcssNativeRead'],
  dcss_native_history_row: function(ordinal, channel, param, turn, pointer, length, segments) {
    return dcssNativeGuard(function() {
      return Module.dcssNativeHistory.row(ordinal, channel, param, turn,
                                         dcssNativeRead(pointer, length, 1048576), segments);
    }, 0);
  },
  dcss_native_history_segment__deps: ['$dcssNativeGuard', '$dcssNativeRead'],
  dcss_native_history_segment: function(ordinal, index, pointer, length, idPointer, idLength, colour, shout, capitalise, filtered) {
    return dcssNativeGuard(function() {
      return Module.dcssNativeHistory.segment(ordinal, index,
        dcssNativeRead(pointer, length, 32768), dcssNativeRead(idPointer, idLength, 80),
        colour, shout, capitalise, filtered);
    }, 0);
  },
  dcss_native_history_end__deps: ['$dcssNativeGuard'],
  dcss_native_history_end: function(success) {
    dcssNativeGuard(function() { return Module.dcssNativeHistory.end(success); }, false);
  },
  dcss_native_history_restore_row__deps: ['$dcssNativeGuard', '$dcssNativeRead'],
  dcss_native_history_restore_row: function(ordinal, pointer, length, channel, param, turn) {
    return dcssNativeGuard(function() {
      return Module.dcssNativeHistory.restoreRow(ordinal, dcssNativeRead(pointer, length, 1048576), channel, param, turn);
    }, -1);
  },
  dcss_native_history_restore_begin__deps: ['$dcssNativeGuard'],
  dcss_native_history_restore_begin: function(count) {
    return dcssNativeGuard(function() { return Module.dcssNativeHistory.restoreBegin(count); }, 0);
  },
  dcss_native_history_restore_end__deps: ['$dcssNativeGuard'],
  dcss_native_history_restore_end: function() {
    return dcssNativeGuard(function() { return Module.dcssNativeHistory.restoreEnd(); }, 0);
  },
  dcss_native_history_restore_segment__deps: ['$dcssNativeGuard', '$dcssNativeWrite'],
  dcss_native_history_restore_segment: function(ordinal, index, textPointer, textCapacity, idPointer, idCapacity, metadataPointer) {
    return dcssNativeGuard(function() {
      if (textCapacity !== 32769 || idCapacity !== 81 || !Number.isInteger(metadataPointer)
          || metadataPointer <= 0 || metadataPointer % 4 || metadataPointer + 16 > HEAPU8.length)
        throw new Error('invalid native history output capacities/metadata');
      var ranges = [[textPointer, textCapacity], [idPointer, idCapacity], [metadataPointer, 16]];
      for (var i = 0; i < ranges.length; ++i) {
        if (!Number.isInteger(ranges[i][0]) || ranges[i][0] <= 0 || ranges[i][0] + ranges[i][1] > HEAPU8.length)
          throw new Error('invalid native history output pointer');
        for (var j = 0; j < i; ++j)
          if (ranges[i][0] < ranges[j][0] + ranges[j][1] && ranges[j][0] < ranges[i][0] + ranges[i][1])
            throw new Error('aliasing native history output ranges');
      }
      var segment = Module.dcssNativeHistory.restoreSegment(ordinal, index);
      var length = dcssNativeWrite(textPointer, textCapacity, segment.canonical);
      dcssNativeWrite(idPointer, idCapacity, segment.id === null ? '' : segment.id);
      HEAP32[metadataPointer >> 2] = segment.colour;
      HEAP32[(metadataPointer >> 2) + 1] = segment.shout ? 1 : 0;
      HEAP32[(metadataPointer >> 2) + 2] = segment.capitalise ? 1 : 0;
      HEAP32[(metadataPointer >> 2) + 3] = segment.filtered ? 1 : 0;
      return length;
    }, -1);
  },
});
// END future canned-native V3 private history library
