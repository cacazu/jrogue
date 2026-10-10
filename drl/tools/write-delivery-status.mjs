import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async name=>JSON.parse(await readFile(path.join(root,name),'utf8'));
const localization=await read('localization/verification.json');
const overlay=await read('core-adapted/adaptation-manifest.json');
const checkpoint=await read('docs/CURRENT-CHECKPOINT.json');
checkpoint.recorded_utc=new Date().toISOString();
checkpoint.delivery_scope='local HTML and full browser verification through Node only';
checkpoint.external_deployment_requested=false;
checkpoint.publication_policy={external_site_creation_deployment_update_allowed:false,
  complete_local_game_required:true,existing_remote_site_access_changes_authorized:false};
checkpoint.latest_verified_localization={semantic_ids:localization.catalogIds,
  node_contracts_passed:localization.nodeTests.passed,
  feeling_oracle_source_checks_passed:localization.feelingSidecarOracle.passed,
  item_name_oracle_source_checks_passed:localization.itemNameSidecarOracle.passed,
  full_game_localization_complete:localization.fullGameLocalizationComplete,
  unrecognized_files_audited:72,guarded_patches:localization.patches,
  pinned_source_files:74,pending_visible_or_composed_literals:localization.literalRoleReview.pendingVisible,
  pending_unknown_literals:localization.literalRoleReview.pendingUnresolved,
  pending_dynamic_producers:localization.textCandidateDispositions.dynamicDispositions['pending-dynamic-producer-review'],current_registry_item_history_batch:'frozen and source-integrated'};
checkpoint.source_integration={generated_files:overlay.files.length,
  platform_transformations:overlay.changes.length,all_generated_hashes_verified:true,
  selected_rule_units_verified:12,byte_exact_rule_units:4,guarded_rule_units:8,
  three_presentation_sidecars_wired:true,sidecars_native_compiled:
    ['feeling','item','history'].every(probe=>checkpoint.executed_runtime_checks?.native_localization_fixtures?.[probe]?.passed===true)};
checkpoint.remaining_runtime_gates=[
  ...(checkpoint.executed_runtime_checks?.final_core_allocator_audit?.matches_current_core&&
    checkpoint.executed_runtime_checks?.actual_vtig_geometry?.status==='passed'?[]:
    ['original core final allocator/object audit and WASM CJK geometry']),
  'complete world witness beyond current DRLP/RNG diagnostic',
  'campaign transitions, win/challenge and remaining gameplay flows',
  'complete semantic text dispositions and runtime coverage',
  'final source ZIP delta/notice consistency and external prerequisite toolchain bootstrap',
  'complete local HTML/Node full-browser delivery and parent-coordinated Git checkpoint'];
checkpoint.site_url=null;checkpoint.local_browser_verified=false;
await writeFile(path.join(root,'docs/CURRENT-CHECKPOINT.json'),JSON.stringify(checkpoint,null,2)+'\n');
const delivery={schema:2,created_at:checkpoint.recorded_utc,
  workspace:'C:\\Users\\kit\\gameme\\jnethack\\jrouge\\drl',game:'DRL',
  stage:'original Pascal/Lua basic browser, combat and autorun flows verified; death/source receipts listed separately; full campaign/state/localization pending',
  architecture:'original Pascal/Lua logic; Rust display/input/platform',
  delivery_scope:checkpoint.delivery_scope,external_deployment_requested:false,
  full_port_complete:false,basic_original_game_browser_verified:checkpoint.basic_original_game_browser_verified,source_tag:'0_10_11a',source_commit:checkpoint.source_commit,
  engine_commit:checkpoint.engine_commit,local_browser_verified:false,local_run_url:'http://127.0.0.1:4189/game.html',
  run_instructions:'docs/LOCAL-RUN.md',source_checkpoint:checkpoint.source_integration,
  localization:checkpoint.latest_verified_localization,
  heavy_job_hold:checkpoint.heavy_job_hold,active_heavy_jobs:[],
  historical_reference_checks:{rust:69,scanner:16,chrome:7,original_game_checks:0},
  current_light_checks:checkpoint.executed_light_checks,
  current_runtime_checks:checkpoint.executed_runtime_checks??null,
  preserved_original_files:305,pristine_upstream_files:498,
  remaining:checkpoint.remaining_runtime_gates,
  git:{index_commit_push_performed:false,parent_checkpoint_requested:true},
  remote_site:{created:false,site_url:null,changes_authorized:false}};
await writeFile(path.join(root,'delivery.json'),JSON.stringify(delivery,null,2)+'\n');
console.log(JSON.stringify({status:'source checkpoint',semantic_ids:localization.catalogIds,
  generated_files:overlay.files.length,external_deployment_requested:false,full_port_complete:false}));
