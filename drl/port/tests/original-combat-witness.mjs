// Pure observation helpers for the preserved original game. No input or core writes.
// Projection order/columns: port/web/game.mjs:307-339, display/frame.rs:52-67.
// Map seam: drltextio.pas:88 and vtextmap.pas:243-251; browser Index subtracts one.
export const MAP_BOUNDS = Object.freeze({minX:1, maxX:78, minY:2, maxY:21});
const HUMAN_COLORS = new Set(['#aaaaaa', '#555555', '#ff5555', '#5555ff']);
const FLOOR_TEXT = new Set(['.', '·', '∙']);
const keyOf = ({x,y}) => `${x},${y}`;
const cardinal = [
  {dx:1,dy:0,key:'ArrowRight'}, {dx:0,dy:-1,key:'ArrowUp'},
  {dx:0,dy:1,key:'ArrowDown'}, {dx:-1,dy:0,key:'ArrowLeft'},
];
const integer = value => Number.isInteger(value);
const inMap = ({x,y}) => x >= MAP_BOUNDS.minX && x <= MAP_BOUNDS.maxX &&
  y >= MAP_BOUNDS.minY && y <= MAP_BOUNDS.maxY;

export function reconstructProjection(projection) {
  if (!projection || projection.width !== 80 || projection.height !== 25 ||
      !Array.isArray(projection.glyphs) || !Array.isArray(projection.commands)) {
    throw new Error('Expected the production 80x25 projection');
  }
  const {width,height} = projection;
  const cells = Array.from({length:width*height}, (_,i) => ({
    x:i%width,y:Math.floor(i/width),text:' ',foreground:null,background:'#000000',
    columns:1,continuation:false,source:'blank',
  }));
  const rectangle = (x,y,w,h) => {
    if (![x,y,w,h].every(integer) || x<0 || y<0 || w<1 || h<1 || x+w>width || y+h>height) {
      throw new Error('Projected primitive is outside the native frame');
    }
  };
  const glyph = (value,source) => {
    rectangle(value.x,value.y,value.columns,1);
    if (typeof value.text !== 'string' || typeof value.foreground !== 'string' ||
        typeof value.background !== 'string') throw new Error('Invalid projected glyph');
    for (let column=0;column<value.columns;column++) {
      const x=value.x+column,y=value.y;
      cells[y*width+x] = {x,y,text:column===0?value.text:'',
        foreground:value.foreground,background:value.background,columns:value.columns,
        continuation:column!==0,anchorX:value.x,anchorY:y,source};
    }
  };
  for (const value of projection.glyphs) glyph(value,'base');
  for (const command of projection.commands) {
    if (command.kind === 'glyph') glyph(command,'command');
    else if (command.kind === 'clear') {
      rectangle(command.x,command.y,command.width,command.height);
      for (let y=command.y;y<command.y+command.height;y++) {
        for (let x=command.x;x<command.x+command.width;x++) {
          cells[y*width+x] = {x,y,text:' ',foreground:null,background:command.background,
            columns:1,continuation:false,source:'clear'};
        }
      }
    } else throw new Error(`Unknown projected primitive: ${command.kind}`);
  }
  let cursor=null;
  if (projection.cursor !== null && projection.cursor !== undefined) {
    const value=projection.cursor;
    if (!Array.isArray(value) || value.length!==2 || !value.every(integer) ||
        value[0]<0 || value[1]<0 || value[0]>=width || value[1]>=height) {
      throw new Error('Invalid native projection cursor');
    }
    cursor={x:value[0],y:value[1]};
  }
  const text=Array.from({length:height},(_,y) => cells.slice(y*width,(y+1)*width)
    .map(cell=>cell.text).join('')).join('\n');
  return {width,height,cells,cursor,text};
}

export function observeMap(projection,probe) {
  const frame=reconstructProjection(projection);
  if (!probe?.playerPresent || !integer(probe.x) || !integer(probe.y)) {
    throw new Error('A paused native player probe is required');
  }
  const players=frame.cells.filter(cell=>inMap(cell) && cell.text==='@' && !cell.continuation);
  if (players.length!==1 || players[0].x!==probe.x || players[0].y!==probe.y+1) {
    throw new Error('Native @ / DRLP map-coordinate validation failed');
  }
  const convert=cell=>({...cell,x:cell.x,y:cell.y-1,
    coordinate:{x:cell.x,y:cell.y},mapCoordinate:{x:cell.x,y:cell.y-1}});
  const mapCells=frame.cells.filter(inMap).map(convert);
  // Native rock is red '.', floor is light-gray low ASCII '.' / CP437 250.
  // Dark remembered terrain, overlays, blank/unknown and all items stay excluded.
  const clearCells=mapCells.filter(cell=>!cell.continuation && cell.source==='base' &&
    FLOOR_TEXT.has(cell.text) && cell.background.toLowerCase()==='#000000' &&
    ['#aa0000','#aaaaaa'].includes(cell.foreground.toLowerCase()));
  const hostiles=mapCells.filter(cell=>!cell.continuation && cell.source==='base' &&
    cell.text==='h' && HUMAN_COLORS.has(cell.foreground.toLowerCase()));
  return {player:convert(players[0]),hostiles,clearCells,mapCells,frame,
    mapping:{validated:true,projectionOffset:{x:0,y:1}},
    probe:{...probe}};
}

export function chooseObservedRoute(observation,{visited=new Set(),maxSteps=1,eastOnly=false}={}) {
  if (!integer(maxSteps) || maxSteps<0) throw new Error('maxSteps must be a nonnegative integer');
  if (!(visited instanceof Set)) throw new Error('visited must be a Set of map x,y strings');
  if (!observation?.mapping?.validated) throw new Error('Validated normal-map observation required');
  if (maxSteps===0) return [];
  const start=observation.player;
  const clear=new Map(observation.clearCells.map(cell=>[keyOf(cell),cell]));
  clear.set(keyOf(start),start);
  const seen=new Map([[keyOf(start),{cell:start,path:[]}]]),queue=[start];
  for (let i=0;i<queue.length;i++) {
    const cell=queue[i],path=seen.get(keyOf(cell)).path;
    for (const direction of cardinal) {
      if (eastOnly && direction.dx<0) continue;
      const next={x:cell.x+direction.dx,y:cell.y+direction.dy};
      if (!clear.has(keyOf(next)) || seen.has(keyOf(next))) continue;
      const step={...next,key:direction.key,code:direction.key};
      seen.set(keyOf(next),{cell:next,path:[...path,step]});queue.push(next);
    }
  }
  const candidates=[...seen.values()].filter(({cell,path})=>path.length>0 && !visited.has(keyOf(cell)));
  const frontier=({cell})=>cardinal.some(d=>!clear.has(keyOf({x:cell.x+d.dx,y:cell.y+d.dy})));
  candidates.sort((a,b)=>Number(frontier(b))-Number(frontier(a)) || b.cell.x-a.cell.x ||
    a.path.length-b.path.length || Math.abs(a.cell.y-start.y)-Math.abs(b.cell.y-start.y) ||
    a.cell.y-b.cell.y);
  return candidates.length?candidates[0].path.slice(0,maxSteps):[];
}

const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function dictionary(catalog,locale='ja') {
  const result=catalog?.[locale]??catalog;
  if (!result || typeof result!=='object') throw new Error('Native locale catalog required');
  return result;
}
function templatePattern(template,fields) {
  if (typeof template!=='string') throw new Error('Missing native semantic template');
  let pattern='',offset=0;
  const names=[];
  for (const match of template.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g)) {
    const name=match[1];
    if (!(name in fields) || names.includes(name)) throw new Error(`Unsupported template field: ${name}`);
    pattern+=escapeRegex(template.slice(offset,match.index))+`(?<${name}>${fields[name]})`;
    offset=match.index+match[0].length;names.push(name);
  }
  pattern+=escapeRegex(template.slice(offset));
  if (Object.keys(fields).some(name=>!names.includes(name))) throw new Error('Native template fields changed');
  return pattern;
}
const segments=text=>String(text).split(/\r?\n/u).map(line=>line.trim()).filter(Boolean);

export function captureCombatMessages(text,{catalog,locale='ja'}={}) {
  const values=dictionary(catalog,locale);
  const definitions=[
    ['hits','message.missile-hits','target'],['deaths','message.death.visible','subject'],
  ];
  const result={hits:[],deaths:[],playerHits:[],findings:[]};
  const patterns=definitions.map(([kind,id,field])=>({kind,id,field,
    regex:new RegExp(`^${templatePattern(values[id],{[field]:'[^\\r\\n]+?'})}(?=$|\\s)`,'u')}));
  const playerTemplates=Object.entries(values).filter(([id,value])=>
    id==='message.hit.player-default' || (/^term\.item\..+\.hitdesc$/.test(id) && typeof value==='string'));
  for (const line of segments(text)) {
    // Consume a complete sequence of native messages from left to right. This
    // prevents a death's leading name field from absorbing an earlier hit.
    // No identity normalization or translation is applied.
    let remainder=line;
    const captured=[];
    while (remainder) {
      let witness=null;
      for (const definition of patterns) {
        const match=definition.regex.exec(remainder);
        if (match) {
          witness={kind:definition.kind,name:match.groups[definition.field],
            message:match[0],id:definition.id};break;
        }
      }
      if (!witness) for (const [id,template] of playerTemplates) {
        if (remainder===template || remainder.startsWith(template+' ')) {
          witness={kind:'playerHits',message:template,id};break;
        }
      }
      if (!witness) {captured.length=0;break;}
      captured.push(witness);remainder=remainder.slice(witness.message.length).trimStart();
    }
    for (const {kind,...witness} of captured) result[kind].push(witness);
  }
  // Optional EN catalog witnesses are findings, never silently translated evidence.
  if (locale==='ja' && catalog?.en) {
    const english=captureCombatMessages(text,{catalog:catalog.en,locale:'en'});
    for (const kind of ['hits','deaths','playerHits']) for (const witness of english[kind]) {
      result.findings.push({kind:'english-native-combat-message',outcome:kind,...witness});
    }
  }
  return result;
}

export function nativeTargetWitness(screenText,projection,catalog,{probe,hostiles,locale='ja'}={}) {
  const frame=reconstructProjection(projection);let cursor=frame.cursor,markerSource='native_cursor';
  // Original firing targeting hides the console cursor and draws an X command.
  // Correlate one selected marker with the independently observed normal map.
  if(!cursor&&hostiles){
    const markers=frame.cells.filter(cell=>inMap(cell)&&cell.source==='command'&&cell.text==='X'
      &&hostiles.some(being=>being.x===cell.x&&being.y===cell.y-1));
    if(markers.length!==1)return null;
    cursor={x:markers[0].x,y:markers[0].y};markerSource='command_target_marker';
  }
  if (!cursor || !inMap(cursor)) return null;
  const x=cursor.x,y=cursor.y-1;
  if (hostiles && !hostiles.some(being=>being.x===x && being.y===y)) return null;
  if (probe) observeMap(projection,probe);
  const cell=frame.cells[cursor.y*frame.width+cursor.x];
  if (!['X','h'].includes(cell.text)) return null;
  const values=dictionary(catalog,locale);
  const conditions=Object.entries(values).filter(([id,value])=>id.startsWith('entity.condition.') &&
    typeof value==='string').map(([,value])=>value);
  if (!conditions.length) throw new Error('Native wound-condition catalog required');
  const pattern=templatePattern(values['view.look-being'],{
    being:'[^\\r\\n]+?',condition:conditions.map(escapeRegex).join('|'),
  });
  const regex=new RegExp('^'+pattern+'(?:\\s+(?:100|[1-9]?\\d)%)?(?:\\s*\\|.*)?$','u');
  const candidates=[];
  for (const line of segments(screenText)) {
    let description=line;
    for (const id of ['view.target.fire','view.target.use']) {
      const caption=values[id];
      if (typeof caption==='string' && !caption.includes('{{') && description.startsWith(caption)) {
        description=description.slice(caption.length).trimStart();break;
      }
    }
    const match=regex.exec(description);
    if (match) candidates.push({name:match.groups.being,wound:match.groups.condition});
  }
  if (candidates.length!==1) return null;
  return {...candidates[0],x,y,coordinate:{...cursor},mapCoordinate:{x,y},
    marker_source:markerSource,validated:Boolean(probe && hostiles)};
}
