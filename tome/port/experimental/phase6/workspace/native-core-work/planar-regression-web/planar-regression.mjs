// SPDX-License-Identifier: GPL-3.0-or-later
import nativeFactory from '/native/tome-native.mjs';
import {mountOriginalInputs} from '/bootstrap/browser_vfs_mounts.mjs';
const compat = new URL(location.href).searchParams.get('compat') === '1';
const report = window.tomePlanarRegressionReport = {completed:false,passed:false,compat,checks:[]};
const status=document.getElementById('status');
function check(name,condition,detail){report.checks.push({name,passed:!!condition,detail});if(!condition)throw Error(name);}
function rgba(actual,expected){return JSON.stringify(actual)===JSON.stringify(expected);}
try{
 const module=await nativeFactory({canvas:document.getElementById('canvas'),noInitialRun:true,locateFile:name=>'/native/'+name});
 const vfs=await mountOriginalInputs(module);
 report.sourceCommit=vfs.manifest.upstream_commit;
 check('Fresh original native initialization',module.ccall('tome_native_init','number',[],[])===1);
 const rngBefore=module.ccall('tome_native_rng_snapshot_hex','string',[],[]);
 check('Complete original RNG snapshot exists',typeof rngBefore==='string'&&rngBefore.length===5176);
 if(compat)check('Fresh platform compatibility install once',module.ccall('tome_planar_client_array_refresh_install','number',[],[])===1);
 const raw=module.ccall('tome_planar_client_array_regression','string',[],[]);
 check('Fresh-context fixture returns actual pixels',!!raw);
 report.pixels=JSON.parse(raw);
 check('Actual GL accepted fixture',report.pixels.gl_error===0,report.pixels.gl_error);
 check('First reference quad is red at the actual left pixel',rgba(report.pixels.first_left,[255,0,0,255]),report.pixels.first_left);
 check('First reference quad leaves actual right pixel black',rgba(report.pixels.first_right,[0,0,0,255]),report.pixels.first_right);
 report.secondMatchesCurrentCpuBytes=rgba(report.pixels.second_left,[0,0,0,255])&&rgba(report.pixels.second_right,[0,0,255,255]);
 if(compat)check('Second draw rereads changed positions and colors at identical original CPU addresses',report.secondMatchesCurrentCpuBytes,report.pixels);
 report.compatStatus=JSON.parse(module.ccall('tome_planar_client_array_refresh_status','string',[],[]));
 check('Original complete RNG unchanged',module.ccall('tome_native_rng_snapshot_hex','string',[],[])===rngBefore);
 check('Native fixture admits only the original unstarted Game reference',report.pixels.protocol===1,{originalStartCalls:0,originalDrawCalls:0,originalTickCalls:0,fresh_context_gate:'current_game == LUA_NOREF'});
 check('Source assets remain range streamed',vfs.metrics.assetBytesPreloaded===0,vfs.metrics);
 report.passed=true;report.phase='actual-gl-pixels-observed';
}catch(error){report.error=error.stack||String(error);report.phase='failed';}
report.completed=true;status.textContent=JSON.stringify(report,null,2);
