// SPDX-License-Identifier: GPL-3.0-or-later
// Small authored index/guard around the actual already initialized Rust host.
import {applyExactRouteGuard,validateDelta} from '/missing/merge-delta.mjs';

const copy=value=>structuredClone(value);
async function json(url){const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('reviewed_profile_fetch:'+url);return response.json();}
export async function installReviewedResolverGuard(resolver){
  const delta=await json('/missing/semantic-route-delta.json');validateDelta(delta);
  if(resolver.status?.base_ids!==24845||resolver.status?.extension_ids!==1||resolver.status?.supplements!==499||resolver.status?.format_policies!==2)
    throw Error('reviewed_profile_catalogue_counts');
  const rows=new Map(delta.route_index.routes.map(row=>[row.source,row]));
  const counters=new Map(delta.route_index.routes.map(row=>[row.semantic_id,{semantic_id:row.semantic_id,source:row.source,
    accepted:0,rejected:0,accepted_missing_official:0,accepted_original_template:0,last_accepted:null,last_rejected:null}]));
  const guard=applyExactRouteGuard(resolver,delta.route_index,{variant:'overlay'});
  const guarded=resolver.resolve;
  function instrumented(source,tag,file,line,locale){
    const response=guarded.call(this,source,tag,file,line,locale),row=rows.get(source);
    if(row){const counter=counters.get(row.semantic_id),context={tag,file,line,locale};
      if(response.ok){counter.accepted++;counter.accepted_missing_official+=response.result.missing_official_japanese===true?1:0;
        counter.accepted_original_template+=response.result.template===source?1:0;
        counter.last_accepted={...context,id:response.result.id,tag:response.result.tag};
        if(response.result.id!==row.semantic_id)throw Error('reviewed_profile_native_owner_mismatch');
      }else{counter.rejected++;counter.last_rejected={...context,reason:response.reason};}}
    return response;
  };
  resolver.resolve=instrumented;
  const profile={variant:'overlay',expectedIds:24846,expectedBaseIds:24845,expectedSupplements:499,
    catalogue:()=>copy({english:delta.english,japanese:delta.japanese_supplement,index:delta.route_index}),
    counters:()=>copy([...counters.values()]),
    guard_installed_before_native_bridge:true,raw_request_is_not_native_resolve_path:true,
    guard:{uninstall(){
      if(resolver.resolve!==instrumented||resolver.tomeReviewedRouteGuard!==profile)throw Error('reviewed_profile_guard_ownership_changed');
      resolver.resolve=guarded;guard.uninstall();delete resolver.tomeReviewedRouteGuard;
    }}};
  resolver.tomeReviewedRouteGuard=profile;return profile;
}
export function makeMissingRouteProbe({raw,rng,localization,resolver}){
  if(!resolver.tomeReviewedRouteGuard)throw Error('reviewed_profile_guard_missing');
  return {
    catalogue:()=>resolver.tomeReviewedRouteGuard.catalogue(),
    resolverStatus:()=>copy(resolver.status),guard:()=>resolver.tomeReviewedRouteGuard.counters(),
    async observe(){
      const before=raw(),beforeRng=rng(),value=localization(),after=raw(),afterRng=rng();
      if(!/^[a-f0-9]{5176}$/.test(beforeRng)||!/^[a-f0-9]{5176}$/.test(afterRng))throw Error('reviewed_profile_complete_rng_required');
      return {value,guard:resolver.tomeReviewedRouteGuard.counters(),state_preserved:JSON.stringify(before)===JSON.stringify(after),
        rng_preserved:beforeRng===afterRng,rng_bytes:beforeRng.length/2,original_state:after};
    },
  };
}
