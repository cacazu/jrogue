// Pure entry-level route proposal; the caller alone verifies and executes actions.
// Original drlbase.pas:704 routes MoveDoor to COMMAND_ACTION, not COMMAND_MOVE.
// cells.lua:236-272 defines visible brown '+' and '/', and opening spends energy
// without moving the player. Reobserve after every action; never execute a stale plan.
import {chooseObservedRoute,MAP_BOUNDS} from './original-combat-witness.mjs';

const keyOf=({x,y})=>`${x},${y}`;
const directions=[
  {dx:1,dy:0,key:'ArrowRight'}, {dx:0,dy:-1,key:'ArrowUp'},
  {dx:0,dy:1,key:'ArrowDown'}, {dx:-1,dy:0,key:'ArrowLeft'},
];
const inMap=cell=>Number.isInteger(cell.x) && Number.isInteger(cell.y) &&
  cell.x>=MAP_BOUNDS.minX && cell.x<=MAP_BOUNDS.maxX &&
  cell.y>=MAP_BOUNDS.minY-1 && cell.y<=MAP_BOUNDS.maxY-1;
const nativeDoor=(cell,text)=>inMap(cell) && cell.source==='base' &&
  cell.columns===1 && !cell.continuation && cell.text===text &&
  cell.foreground?.toLowerCase()==='#aa5500' && cell.background?.toLowerCase()==='#000000';

export function chooseObservedEntryRoute(observation,
  {visited=new Set(),opened=new Set(),maxSteps=1}={}) {
  if (!observation?.mapping?.validated || !Array.isArray(observation.mapCells) ||
      !Array.isArray(observation.clearCells) || !inMap(observation.player)) {
    throw new Error('Validated normal-map observation required');
  }
  if (!(visited instanceof Set) || !(opened instanceof Set)) {
    throw new Error('visited and opened must be Sets of map x,y strings');
  }
  if (!Number.isInteger(maxSteps) || maxSteps<0) {
    throw new Error('maxSteps must be a nonnegative integer');
  }
  if (maxSteps===0) return [];
  const player=observation.player;
  const portals=new Map(observation.mapCells.filter(cell=>nativeDoor(cell,'/') &&
    opened.has(keyOf(cell))).map(cell=>[keyOf(cell),cell]));
  const doors=new Map(observation.mapCells.filter(cell=>nativeDoor(cell,'+'))
    .map(cell=>[keyOf(cell),cell]));
  const walkable=new Map(observation.clearCells.filter(inMap).map(cell=>[keyOf(cell),cell]));
  for (const [key,cell] of portals) walkable.set(key,cell);
  walkable.set(keyOf(player),player);
  const seen=new Map([[keyOf(player),{cell:player,path:[]}]]),queue=[player];
  const candidates=new Map();
  for (let i=0;i<queue.length;i++) {
    const current=queue[i],path=seen.get(keyOf(current)).path;
    for (const direction of directions) {
      const next={x:current.x+direction.dx,y:current.y+direction.dy};
      const key=keyOf(next);
      const action={...next,key:direction.key,code:direction.key};
      if (doors.has(key)) {
        const proposal={door:doors.get(key),path:[...path,{...action,kind:'open_door'}]};
        const previous=candidates.get(key);
        if (!previous || proposal.path.length<previous.path.length) candidates.set(key,proposal);
        continue; // A closed door is a terminal action, never a traversable node.
      }
      if (!walkable.has(key) || seen.has(key)) continue;
      const kind=portals.has(key)?'enter_open_door':'clear';
      seen.set(key,{cell:next,path:[...path,{...action,kind}]});queue.push(next);
    }
  }
  const ranked=[...candidates.values()].sort((a,b)=>a.path.length-b.path.length ||
    b.door.x-a.door.x || Math.abs(a.door.y-player.y)-Math.abs(b.door.y-player.y) ||
    a.door.y-b.door.y);
  if (ranked.length) return ranked[0].path.slice(0,maxSteps);

  // Known portals may connect observed clear frontiers. They are transit nodes,
  // not fallback goals: the fallback still selects an unvisited clear cell.
  const fallbackVisited=new Set([...visited,...portals.keys()]);
  const fallbackObservation={...observation,clearCells:[...walkable.values()]};
  return chooseObservedRoute(fallbackObservation,
    {visited:fallbackVisited,maxSteps,eastOnly:false}).map(step=>({...step,
      kind:portals.has(keyOf(step))?'enter_open_door':'clear'}));
}
