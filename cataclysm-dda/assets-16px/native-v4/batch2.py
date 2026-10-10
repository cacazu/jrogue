"""Next gameplay batch; all pattern symbols are native artwork cells."""
import json
from pathlib import Path
root=Path(__file__).resolve().parent
palette={}
for p in (root/'source').glob('*.json'):palette.update(json.loads(p.read_text('utf8'))['palette'])
palette['F']='#9b849bff'
palette['V']='#b3b98bff'
palette['M']='#39354dff'
palette['W']='#352b2bff'
palette['u']='#41656aff'
patterns={
'stairs_up':('terrain',['t_stairs_up'],['XXXXXXXXXXXX','XDDDDDDDDDDX','XJXXXXXXXXXX','XJGGGGGGGGGX','XJJXXXXXXXXX','XJJJJJJJJJJX','XJJJXXXXXXXX','XJJJJJJJJJJX','XJJJJXSSXJJX','XJJJXSSSSXJX','XJJJJXSSXJJX','XXXXXXXXXXXX']),
'stairs_down':('terrain',['t_stairs_down'],['XXXXXXXXXXXX','XJJJJJJJJJJX','XJJJJXSSXJJX','XJJJXSSSSXJX','XJJJJXSSXJJX','XXXXXXXXJJJX','XJJJJJJJJJJX','XXXXXXXXXJJX','XGGGGGGGGJJX','XXXXXXXXXXJX','XDDDDDDDDDDX','XXXXXXXXXXXX']),
'shallow_water':('terrain',['t_water_sh'],['.TTTTTTTTTTTTTTT','TTTCCCCTTTTTTTTT','TTTTTTTTTTTTCCCT','TTTTTTTTTTTTTTTT','TTTTTTCCCCCTTTTT','TTTTTTTTTTTTTTTT','TTCCCTTTTTTTTTTT','TTTTTTTTTTCCCTTT','TTTTTTTTTTTTTTTT','TTTTCCCCTTTTTTTT','TTTTTTTTTTTTTTTT','TTTTTTTTTCCCCCTT','TTTTTTTTTTTTTTTT','TCCCCTTTTTTTTTTT','TTTTTTTTTTTTTTTT','TTTTTTTTCCCCTTTT']),
'deep_water':('terrain',['t_water_dp'],['.UUUUUUUUUUUUUUU','UUUTTTTUUUUUUUUU','UUUUUUUUUUUUTTTU','UUUUUUUUUUUUUUUU','UUUUUUTTTTTUUUUU','UUUUUUUUUUUUUUUU','UUTTTUUUUUUUUUUU','UUUUUUUUUUTTTUUU','UUUUUUUUUUUUUUUU','UUUUTTTTUUUUUUUU','UUUUUUUUUUUUUUUU','UUUUUUUUUTTTTTUU','UUUUUUUUUUUUUUUU','UTTTTUUUUUUUUUUU','UUUUUUUUUUUUUUUU','UUUUUUUUTTTTUUUU']),
'window_empty':('terrain',['t_window_empty','t_window_frame'],['XXXXXXXXXX','X........X','X........X','X........X','X........X','X........X','X........X','X........X','XDDDDDDDDX']),
'door_broken':('terrain',['t_door_b'],['XXXXXXXXXX','XBBBBBBBBX','XRHRRRHRRX','XRHRR.HRRX','XRHR...RRX','XRH....HRX','XR.....HYX','XR.....HRX','XRH..RHRRX','XRHRRRHRRX','XRHRRRHRRX','XRHRRRHRRX','XXXXXXXXXX']),
'chain_fence':('terrain',['t_chainfence'],['G..J..J..J..JG','G.J.J.J.J.J.JG','GJ...J...J...G','G.J.J.J.J.J.JG','G..J...J...J.G','G.J.J.J.J.J.JG','GJ...J...J...G','G.J.J.J.J.J.JG','G..J...J...J.G','G.J.J.J.J.J.JG','GJ...J...J...G','G.J.J.J.J.J.JG','G..J..J..J..JG','XXXXXXXXXXXXXX']),
'locker':('furniture',['f_locker'],['XXXXXXXXXX','XGGGGGGGGX','XGJJJJJJGX','XGXXXXXXGX','XGJJJJJJGX','XGXXXXXXGX','XGJJJJJJGX','XGJJJJJYGX','XGJJJJJJGX','XGJJJJJJGX','XGJJJJJJGX','XGGGGGGGGX','XXXXXXXXXX','XX......XX']),
'counter':('furniture',['f_counter'],['XXXXXXXXXXXXXX','XDDDDDDDDDDDDX','XDGGGGGGGGGGDX','XDGGGGGGGGGGDX','XDGGGGGGGGGGDX','XDDDDDDDDDDDDX','XXXXXXXXXXXXXX','XBBBBBBBBBBBBX','XBRRRRRRRRRRBX','XBBBBBBBBBBBBX','XXXXXXXXXXXXXX']),
'cupboard':('furniture',['f_cupboard'],['XXXXXXXXXXXX','XBBBBBBBBBBX','XBRRRXXRRRBX','XBRRRXXRRRBX','XBRRRXXRRRBX','XBRRYXXYRRBX','XBRRRXXRRRBX','XBRRRXXRRRBX','XBRRRXXRRRBX','XBBBBBBBBBBX','XXXXXXXXXXXX']),
'fridge':('furniture',['f_fridge'],['XXXXXXXXXX','XDDDDDDDDX','XDKKKKKKDX','XDGGGGGKDX','XDDDDDDDDX','XXXXXXXXXX','XDDDDDDDDX','XDGGGGGKDX','XDKKKKKKDX','XDKKKKKKDX','XDKKKKKKDX','XDKKKKKKDX','XDDDDDDDDX','XXXXXXXXXX']),
'oven':('furniture',['f_oven'],['XXXXXXXXXXXX','XGGGGGGGGGGX','XGXGXXGXGXGX','XGXXGGXXGGGX','XGGGGGGGGGGX','XXXXXXXXXXXX','XJGGGGGGGGJX','XJXXUUUUXXJX','XJXUUUUUUXJX','XJXUUUUUUXJX','XJXXUUUUXXJX','XJJJJJJJJJJX','XXXXXXXXXXXX']),
'toilet':('furniture',['f_toilet'],['..XXXXXXXX..','..XDDDDDDX..','..XDKKKKDX..','..XXXXXXXX..','..XDDDDDDX..','.XDCCCCCCDX.','XDCUUUUUUCDX','XDCUUUUUUCDX','XDCUUUUUUCDX','.XDCCCCCCDX.','..XDDDDDDX..','...XDDDDX...','....XXXX....']),
'sink':('furniture',['f_sink'],['XXXXXXXXXXXX','XDDDDDDDDDDX','XDGGGXXGGGDX','XDGTTXGTTGDX','XDGTUUUUTGDX','XDGTUXXUTGDX','XDGTUUUUTGDX','XDGTTTTTTGDX','XDGGGGGGGGDX','XDDDDDDDDDDX','XXXXXXXXXXXX']),
'rack':('furniture',['f_rack'],['XXXXXXXXXXXX','XGGGGGGGGGGX','XJ........JX','XJ........JX','XXXXXXXXXXXX','XGGGGGGGGGGX','XJ........JX','XJ........JX','XXXXXXXXXXXX','XGGGGGGGGGGX','XX........XX']),
'dresser':('furniture',['f_dresser'],['XXXXXXXXXXXX','XBBBBBBBBBBX','XBRRRRRRRRBX','XBRRYYYRRRBX','XXXXXXXXXXXX','XBRRRRRRRRBX','XBRRYYYRRRBX','XXXXXXXXXXXX','XBRRRRRRRRBX','XBRRYYYRRRBX','XXXXXXXXXXXX']),
'trashcan':('furniture',['f_trashcan'],['..XXXXXXXX..','.XGGGGGGGGX.','XGGGGGGGGGGX','.XJJJJJJJJX.','.XJXJXJXJJX.','.XJXJXJXJJX.','.XJXJXJXJJX.','.XJXJXJXJJX.','.XJXJXJXJJX.','..XJJJJJJX..','...XXXXXX...']),
'skeleton':('monster',['mon_skeleton'],['....XXXX....','...XKSSKX...','...XSXXSX...','....XSSX....','.....XX.....','.XXSSSSSSXX.','XSSXSSSSXSSX','XXXXSXXSXXXX','...XSSSSX...','....XSSX....','...XSSSSX...','...XSXXSX...','...XSXXSX...','...XXX.XXX..']),
'ant':('monster',['mon_ant'],['....X..X....','....XRRX....','..XXRXXRXX..','.X..XRRX..X.','X....XX....X','..XXXRRXXX..','.X..XRRX..X.','X....XX....X','..XXRRRRXX..','.X.XRRRRX.X.','X...XRRX...X','.....XX.....']),
'wolf':('monster',['mon_wolf'],['..........XX..','.X.......XGGX.','XJXXXXXXXJGGSX','.XJJJJJJJGSSXX','.XJGJGJJJJGGX.','..XJJJJJJJJX..','...XJX..XJX...','...XXX..XXX...']),
'pistol':('item',['glock_17','glock_19'],['XXXXXXXXXXXX','XGGGGGGGGGGX','XJJJJJJJJJJX','.XXXXXXXXXX.','.XPXXXGX....','.XPX..GX....','.XPXXXXX....','XPPX........','XPPX........','XXXX........']),
'combat_knife':('item',['knife_combat'],['..........XX..','.........XKGX.','........XKGX..','.......XKGX...','......XKGX....','.....XKGX.....','....XKGX......','...XKGX.......','..XGX.........','.XGGX.........','..XRX.........','.XRX..........','XRX...........','XX............']),
'hammer':('item',['hammer'],['....XXXXXXXX..','..XXGGGGGGGGX.','.XGGGGGGGGGGX.','..XXGGGGGGGGX.','....XXXXRXXX..','.......XRX....','.......XRX....','.......XRX....','.......XRX....','.......XRX....','.......XRX....','.......XRX....','.......XXX....']),
'flashlight':('item',['flashlight'],['.....XXXX.....','...XXCCDDXX...','...XCCCCDDX...','...XXJJJJXX...','....XJJJJX....','....XJYYJX....','....XJJJJX....','....XJJJJX....','....XJJJJX....','....XJJJJX....','....XXXXXX....']),
'apple':('item',['apple'],['.....X......','....XRLLX...','...qqXLLX...','..qQQQqqQQq.','.qQQYQQQQQQq','qQQQQQQQQQQq','qQQQQQQQQQQq','.qQQQQQQQQq.','..qQQQQQQq..','...qqqqqq...']),
'bread':('item',['bread'],['..XXXXXXXX..','.XBBBBBBBBX.','XBRRSSSSRRBX','XBRSKSSSSRBX','XBRSKSSSSRBX','XBRSSSSSSRBX','XBRSSSSSSRBX','XBRRSSSSRRBX','.XBBBBBBBBX.','..XXXXXXXX..']),
'aspirin':('item',['aspirin'],['..XXXXXX..','..XDDDDX..','..XXXXXX..','.XKKKKKKX.','XKKKKKKKKX','XKKKKKKKKX','XKqqqqqqKX','XKqSSSSqKX','XKqSSSSqKX','XKqqqqqqKX','XKKKKKKKKX','.XXXXXXXX.']),
'ammo9mm':('item',['9mm'],['...XXX...XXX..','...XYX...XYX..','..XYYYX.XYYYX.','..XYYYX.XYYYX.','..XYYYX.XYYYX.','..XBBBX.XBBBX.','..XBBBX.XBBBX.','..XBBBX.XBBBX.','..XBBBX.XBBBX.','..XXXXX.XXXXX.']),
'vehicle_door':('vehicle_part',['vp_door'],['XXXXXXXXXXXX','XGGGGGGGGGGX','XGCTTTTTTCGX','XGCTTTTTTCGX','XGCTTTTTTCGX','XGGGGGGGGGGX','XJJJJJJJJJJX','XJJJJJJGGJJX','XJJJJJJJJJJX','XXXXXXXXXXXX']),
'vehicle_seat':('vehicle_part',['vp_seat'],['..XXXXXXXX..','.XBBBBBBBBX.','XBNNNNNNNNBX','XBNNFFFFNNBX','XBNNNNNNNNBX','XXXXXXXXXXXX','XBNNNNNNNNBX','XBNNNNNNNNBX','XBNNFFFFNNBX','XBNNNNNNNNBX','.XXXXXXXXXX.']),
'vehicle_frame':('vehicle_part',['vp_frame'],['XXXXXXXXXXXXXX','XGGGGGGGGGGGGX','XGXX......XXGX','XG.XX....XX.GX','XG..XX..XX..GX','XG...XXXX...GX','XG...XXXX...GX','XG..XX..XX..GX','XG.XX....XX.GX','XGXX......XXGX','XGGGGGGGGGGGGX','XXXXXXXXXXXXXX']),
'windshield':('vehicle_part',['vp_windshield'],['..XXXXXXXXXX..','.XGGGGGGGGGGX.','XGCCCCCCCCCCGX','XGCKTTTTTTTCGX','XGCTKTTTTTTCGX','XGCTTKTTTTTCGX','XGCTTTTTTTTCGX','XGCCCCCCCCCCGX','.XGGGGGGGGGGX.','..XXXXXXXXXX..']),
'gas_engine':('vehicle_part',['vp_engine_inline4'],['...XXXXXXXX...','..XGGGGGGGGX..','.XGJJJJJJJJGX.','XGJXXJXXJXXJGX','XGJGGJGGJGGJGX','XGJXXJXXJXXJGX','XGJGGJGGJGGJGX','XGJXXJXXJXXJGX','XGJJJJJJJJJJGX','.XGGGGGGGGGGX.','..XXXXXXXXXX..']),
'smoke':('field',['fd_smoke'],['.....JJJJ.....','..JJJGGGGJJ...','.JGGGGGGGGGJ..','JGGGDDGGGDDGJ.','JGGGDDGGGDDGJ.','.JGGGGGGGGGGJ.','..JGGGGGGGGJ..','...JJGGGGJJ...','.....JJJJ.....']),
'acid':('field',['fd_acid'],['...vvvvv......','..vLLLLLv.....','.vLLVVVLLvv...','vLLVVVVVLLLv..','vLLVLLLVLLLv..','.vLLLLLLLLLvv.','..vvLLLLLLLv..','....vvvvvvv...']),
'electricity':('field',['fd_electricity'],['........CC....','.......CCC....','......CCC.....','.....CCC......','....CCC.......','...CCCCCCC....','...CCCCCC.....','......CCC.....','.....CCC......','....CCC.......','...CCC........','..CCC.........']),
'landmine':('trap',['tr_landmine'],['....XXXX....','..XXvvvvXX..','.XvLLLLLLvX.','XvLLLXXLLLvX','XvLLXYYXLLvX','XvLLXYYXLLvX','XvLLLXXLLLvX','.XvLLLLLLvX.','..XXvvvvXX..','....XXXX....']),
'overmap_field':('overmap_terrain',['field'],['.OOOOOOOOOOOOOOO','OOOOOOOOOOOOOOOO','OOOLLOOOOOLLOOOO','OOOLLOOOOOLLOOOO','OOOOOOOOOOOOOOOO','OOOOOOOOOOOOOOOO','OOOOOOLLLOOOOOOO','OOOOOOLLOOOOOOOO','OOOOOOOOOOOOOOOO','OOOOOOOOOOOOOOOO','OOOLLOOOOOOLLOOO','OOOLLOOOOOOLLOOO','OOOOOOOOOOOOOOOO','OOOOOOOOOOOOOOOO','OOOOOOOOOOOOOOOO','OOOOOOOOOOOOOOOO']),
'overmap_forest':('overmap_terrain',['forest'],['..XXX....XXX..','..XLX....XLX..','.XLvLX..XLvLX.','XLvvvLXXLvvvLX','..XRX....XRX..','....XXXXXX....','.....XXX......','....XLvLX.....','...XLvvvLX....','..XLvvvvvLX...','.....XRX......','.....XRX......']),
'overmap_house':('overmap_terrain',['house_01'],['......XX......','.....XRRX.....','....XRRRRX....','...XRRRRRRX...','..XRRRRRRRRX..','.XRRRRRRRRRRX.','XXXXXXXXXXXXXX','..XSSSSSSSSX..','..XSCCSSCCSX..','..XSCCSSCCSX..','..XSSSXXSSSX..','..XSSXRRXSSX..','..XSSXRRXSSX..','..XXXXXXXXXX..'])
}
for name,base,recolor,changes,ids in [
('soldier','zombie',{'q':'O','r':'H'}, {1:'.....XOOOOX.....',2:'.....XLLLLX.....',5:'....XBOLLOBX....'},['mon_zombie_soldier']),
('cop','zombie',{'q':'b','r':'U'}, {1:'.....XbbbbX.....',2:'.....XLLLLX.....'},['mon_zombie_cop']),
('shocker','zombie',{'q':'u','r':'T'}, {6:'...XCLuCLuLCX...',7:'...XCLuCLuLCX...'},['mon_zombie_electric']),
('spitter','zombie',{'q':'O','r':'v'}, {3:'......XLLX......',4:'......XvvX......',5:'.....XvLvX......'},['mon_zombie_spitter']),
('runner','zombie',{'q':'Q','r':'q'}, {11:'.....XPPXXPPX...',12:'....XPPX..PPX...',13:'...XPPX...XXX...'},['mon_zombie_runner'])]:
    original=json.loads((root/'source'/f'{base}.json').read_text('utf8'))
    rows=[''.join(recolor.get(c,c) for c in line) for line in original['rows']]
    for y,line in changes.items():rows[y]=line
    patterns[name]=('monster',ids,rows)

append=[]
inventory=json.loads((root/'inputs/inventory.json').read_text('utf8'))
valid={(t['category'],t['display_id']) for t in inventory['targets']}
for name,(cat,ids,pattern) in patterns.items():
    assert all((cat,ident) in valid for ident in ids),(name,cat,ids)
    h=len(pattern);w=max(map(len,pattern));assert h<=16 and w<=16,(name,w,h)
    x0=(16-w)//2;y0=(16-h)//2;rows=['.'*16 for _ in range(16)]
    for y,line in enumerate(pattern):rows[y+y0]='.'*x0+line+'.'*(16-x0-len(line))
    assert len(rows)==16 and all(len(row)==16 for row in rows)
    used=set(''.join(rows));assert used<=palette.keys(),(name,used-palette.keys())
    source={'name':name,'width':16,'height':16,'category':cat,'authoring':'Original native palette-cell design, including native-cell variations of our own verified sprites. Each row symbol is ONE artwork pixel; no high-resolution sampling or subcell features.','palette':{c:palette[c] for c in sorted(used)},'rows':rows,'display_ids':ids}
    (root/'source'/f'{name}.json').write_text(json.dumps(source,indent=2),'utf8')
    append.append([name,ids,'native-cell gameplay batch 2; '+cat])
plan=json.loads((root/'inputs/plan.json').read_text('utf8'))
assert len(plan)==24
(root/'inputs/plan.json').write_text(json.dumps(plan+append,indent=2),'utf8')
print(json.dumps({'new_native_designs':len(append),'total_native_designs':len(plan)+len(append),'new_names':[a[0] for a in append]},indent=2))
