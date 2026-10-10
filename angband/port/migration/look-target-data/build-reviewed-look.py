from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
ENTRIES = []
P = 'angband.look.'

def add(role, english, japanese, parameters=(), source='logic/ui-target.c', symbol=None):
    entry = dict(id=P+role, english=english, japanese=japanese,
                 parameters=[dict(name=n, type=t) for n,t in parameters],
                 source=dict(file=source, symbol=symbol or role), role=role)
    ENTRIES.append(entry)
    return entry['id']

def refs(*names):
    return [(name, 'localized_text') for name in names]

add('empty', '', '', symbol='source-selected absent component')
add('subject.strange', 'something strange', '奇妙なもの', symbol='aux_hallucinate::name_strange')
add('subject.pile', 'a pile of {count} objects', '{count}個のアイテムの山', [('count','integer')], symbol='aux_object::floor_num')
add('subject.terrain', '{prefix}{name}', '{name}{prefix}', refs('prefix','name'), symbol='aux_terrain::lphrase3/name')
add('subject.trap', '{article}{name}', '{article}{name}', refs('article','name'), symbol='aux_trap::lphrase3/trap->kind')
add('subject.monster','{monster}','{monster}',[('monster','MonsterDescription')],symbol='aux_monster::copied m_name descriptor')
add('subject.object','{object}','{object}',[('object','KnownObjectDescription')],symbol='source-owned copied native object descriptor')
for role,english in [('a','a '),('an','an ')]:
    add('article.'+role,english,'',symbol='aux_trap::source selected indefinite article')
    add('terrain.prefix.'+role,english,'',source='logic/cave-square.c',symbol='square_apparent_look_prefix default')
for role,english,japanese in [('on','on ','の上にいる'),('in','in','の中にいる'),('at','at','の前にいる')]:
    add('preposition.'+role,english,japanese,symbol='source-selected terrain preposition, exact trailing bytes')
for role,english,japanese in [('north','N','北'),('south','S','南'),('west','W','西'),('east','E','東')]:
    add('direction.'+role,english,japanese,source='logic/target.c',symbol='coords_desc '+role+' branch')
add('coordinates','{vertical} {north_south}, {horizontal} {east_west}','{north_south}に{vertical}、{east_west}に{horizontal}',
    [('vertical','integer'),('north_south','localized_text'),('horizontal','integer'),('east_west','localized_text')],
    source='logic/target.c',symbol='coords_desc original argument distance values and selected directions')
add('diagnostics',' ({y}:{x}, noise={noise}, scent={scent})','（{y}:{x}、騒音={noise}、匂い={scent}）',
    [(name,'integer') for name in ['y','x','noise','scent']],symbol='wizard-only original diagnostic arguments')
for role,english,japanese in [
    ('self','You are {preposition}{subject}{condition}, {coordinates}{diagnostics}.','{coordinates}にある{subject}{condition}{preposition}{diagnostics}。'),
    ('see','You see {preposition}{subject}{condition}, {coordinates}{diagnostics}.','{coordinates}に{preposition}{subject}{condition}が見える{diagnostics}。'),
    ('sense','You sense {preposition}{subject}{condition}, {coordinates}{diagnostics}.','{coordinates}に{preposition}{subject}{condition}の存在を感じる{diagnostics}。'),
    ('recall','You recall {preposition}{subject}{condition}, {coordinates}{diagnostics}.','{coordinates}にある{preposition}{subject}{condition}を思い出す{diagnostics}。')]:
    add('row.'+role,english,japanese,refs('preposition','subject','condition','coordinates','diagnostics'),symbol='aux_reinit '+role+' branch plus selected handler')
add('row.carry','{gender}{also}{subject}, {coordinates}{diagnostics}.','{gender}は{also}{subject}を持っている。位置は{coordinates}{diagnostics}。',
    refs('gender','also','subject','coordinates','diagnostics'),symbol='aux_monster wizard-only carried object loop')
for role,english,japanese in [('female','She is ','彼女'),('male','He is ','彼'),('other','It is ','それ')]:
    add('carry.gender.'+role,english,japanese,symbol='aux_monster source-selected gender')
add('carry.first','carrying ','',symbol='aux_monster first lphrase2')
add('carry.also','also carrying ','ほかにも',symbol='aux_monster later lphrase2')
add('condition.parentheses',' ({condition})','（{condition}）',refs('condition'),symbol='aux_monster existing condition parentheses')
add('condition.sequence','{health}{sleep}{hold}{disenchant}{confusion}{fear}{stun}{slow}{fast}',
    '{health}{sleep}{hold}{disenchant}{confusion}{fear}{stun}{slow}{fast}',
    refs('health','sleep','hold','disenchant','confusion','fear','stun','slow','fast'),
    source='logic/target.c',symbol='look_mon_desc original selected health then exact timed status order')
for form,english,japanese in [
    ('living',['unhurt','somewhat wounded','wounded','badly wounded','almost dead'],['無傷','少し傷を負っている','傷を負っている','ひどく傷を負っている','瀕死']),
    ('nonliving',['undamaged','somewhat damaged','damaged','badly damaged','almost destroyed'],['損傷なし','少し損傷している','損傷している','ひどく損傷している','破壊寸前'])]:
    for grade,(en,ja) in enumerate(zip(english,japanese)):
        add(f'condition.health.{form}.{grade}',en,ja,source='logic/target.c',symbol=f'look_mon_desc {form} grade {grade}')
for role,english,japanese in [('sleep','asleep','眠っている'),('hold','held','拘束されている'),('disenchant','disenchanted','魔力を失っている'),
                               ('confusion','confused','混乱している'),('fear','afraid','怯えている'),('stun','stunned','朦朧としている'),('slow','slowed','減速している'),('fast','hasted','加速している')]:
    add('condition.status.'+role,', '+english,'、'+japanese,source='logic/target.c',symbol='look_mon_desc selected timed '+role)
normal_ja=['罠なし','守りのルーン','囮','扉の錠','クモの巣','落とし戸','落とし穴','トゲ付き落とし穴','毒の落とし穴','敵を召喚するルーン','召喚のルーン','死霊術のルーン','竜の歌のルーン','地獄への穴','テレポートのルーン','炎の罠','酸の罠','減速の矢の罠','腕力を奪う矢の罠','器用さを奪う矢の罠','耐久力を奪う矢の罠','盲目ガスの罠','混乱ガスの罠','毒ガスの罠','睡眠ガスの罠','敵を刺激する罠','警報','地雷の罠','爆発の罠','精神攻撃の罠','精神破壊の罠','落石の罠','地震の罠','ブロック落下の罠','広域爆発の罠','閃光による盲目の罠','盲目の罠','魔力を奪う罠','刃の罠','石化の罠']
generic_ja={'no trap':'罠なし','glyph of warding':'守りのルーン','decoy':'囮','door lock':'扉の錠','web':'クモの巣','trap door':'落とし戸','pit':'落とし穴','strange rune':'奇妙なルーン','discolored spot':'変色した場所','dart trap':'矢の罠','gas trap':'ガスの罠','alarm':'警報','explosion':'爆発','mind blast trap':'精神攻撃の罠','ancient mechanism':'古代の仕掛け','trap':'罠'}
traps=[]
for line_number,line in enumerate((ROOT/'data/gamedata/trap.txt').read_text().splitlines(),1):
    if not line.startswith('name:'): continue
    generic,normal=line[5:].split(':',1); index=len(traps)
    normal_id=add(f'trap.kind_{index}.normal',normal,normal_ja[index],source='data/gamedata/trap.txt',symbol=f'name record {index} line {line_number} desc field')
    wizard_id=add(f'trap.kind_{index}.wizard',generic,generic_ja[generic],source='data/gamedata/trap.txt',symbol=f'name record {index} line {line_number} name field')
    traps.append(dict(index=index,normal_id=normal_id,wizard_id=wizard_id,article_id=P+'article.'+('an' if normal[0].lower() in 'aeiou' else 'a'),source_line=line_number,normal=normal,wizard=generic))
assert len(traps)==40
terrains=[]
for line_number,line in enumerate((ROOT/'data/gamedata/terrain.txt').read_text().splitlines(),1):
    if line.startswith('code:'):
        current=dict(code=line[5:],line=line_number); terrains.append(current)
    elif terrains and line.startswith(('name:','look-prefix:','look-in-preposition:')):
        key,value=line.split(':',1); current[key]=value
for terrain in terrains:
    directive=terrain.get('look-prefix')
    if directive is not None:
        role='entrance' if directive.startswith('the entrance') else 'some'
        identity=P+'terrain.prefix.'+role
        if not any(entry['id']==identity for entry in ENTRIES):
            add('terrain.prefix.'+role,directive,'の入口' if role=='entrance' else '',source='data/gamedata/terrain.txt',symbol='exact authored look-prefix directive')
    else: identity=P+'terrain.prefix.'+('an' if terrain['name'][0].lower() in 'aeiou' else 'a')
    terrain.update(prefix_id=identity,preposition_id=P+'preposition.'+terrain.get('look-in-preposition','on ').strip(),name_id='terrain.'+terrain['code'].lower()+'.name')
    texts={entry['id']:entry['english'] for entry in ENTRIES}
    assert texts[identity]==(directive if directive is not None else ('an ' if terrain['name'][0].lower() in 'aeiou' else 'a '))
    assert texts[terrain['preposition_id']]==terrain.get('look-in-preposition','on ')
manifest=dict(schema_version=1,upstream_commit='f3082213b73f3e463e3d0d60bff4b00462beae6e',status='source_connected_not_built_or_browser_tested',complete_game_translation=False,
              entries=ENTRIES,trap_records=traps,terrain_records=terrains,
              native_limit_policy=dict(terminal_prose=256,native_name_buffers=80,native_relative_coordinates=20,japanese='full semantic text reflows; native terminal output is unchanged'),
              boundaries=dict(producer_capture='selected C branches only; no RNG or extra entity/grid queries',naming='owned native descriptor snapshots copied immediately',conditions='scoped exact buffer, 1 health ID and 8 ordered optional status IDs',terrain='canonical fidx from already-selected remembered/mimicked fp',trap='already-visible player cave trap kind tidx; wizard name versus normal desc preserved',coordinates='source-selected directions and once-only original distance arguments',diagnostics='wizard-only original noise/scent arguments copied once'),
              root_hooks=['Register logic/web-look-target.c in full build and adapter syntax checks','Register migration/look-target-data/source-manifest.json in reviewed generator and Rust catalog','No new descriptor types: localized_text, integer, MonsterDescription and KnownObjectDescription only'])
for name,value in [('source-manifest.json',manifest),('en.json',{entry['id']:entry['english'] for entry in ENTRIES}),('ja.json',{entry['id']:entry['japanese'] for entry in ENTRIES}),
                   ('schema.json',dict(schema_version=1,entries={entry['id']:dict(parameters=entry['parameters'],sources=[entry['source']],role=entry['role']) for entry in ENTRIES}))]:
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('reviewed look entries:',len(ENTRIES),'trap records:',len(traps),'terrain identities:',len(terrains))
