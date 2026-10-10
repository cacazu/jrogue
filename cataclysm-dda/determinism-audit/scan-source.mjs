import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

// A lexical inventory, deliberately not a C++ parser or a preprocessor.
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..');
const acquisition = JSON.parse(fs.readFileSync(path.join(root, 'acquisition.json'), 'utf8'));
const build = JSON.parse(fs.readFileSync(path.join(root, 'engine-build/build-manifest.json'), 'utf8'));
const upstream = path.resolve(build.upstream);
assert.equal(acquisition.commit_sha, build.upstreamCommit);
assert.equal(path.basename(upstream), `Cataclysm-DDA-${acquisition.commit_sha}`);
const compiled = new Set([...(build.cppSources ?? []), ...(build.cSources ?? [])]);

function maskNonCode(source) {
  // Preserve all offsets/newlines. Raw strings, escaped strings, character
  // literals and both comment forms are removed before identifier matching.
  let out = source.split('');
  const erase = (start, end) => { for (let j=start;j<end;j++) if (out[j] !== '\n' && out[j] !== '\r') out[j] = ' '; };
  for (let i=0;i<source.length;) {
    let end;
    if (source.startsWith('//', i)) { end=source.indexOf('\n', i); if (end < 0) end=source.length; }
    else if (source.startsWith('/*', i)) { end=source.indexOf('*/', i+2); end=end < 0 ? source.length : end+2; }
    else {
      const raw=/^(?:u8|u|U|L)?R"([^\s()\\]{0,16})\(/.exec(source.slice(i, i+22));
      if (raw) { const finish=`)${raw[1]}"`; const at=source.indexOf(finish, i+raw[0].length); end=at < 0 ? source.length : at+finish.length; }
      else if (source[i] === '"' || (source[i] === "'" && !(/[0-9][0-9A-Fa-fxXbBuUlL']*$/.test(source.slice(Math.max(0,i-128),i)) && /[0-9A-Fa-f]/.test(source[i+1] ?? '')))) {
        const quote=source[i]; end=i+1;
        while (end<source.length) { if (source[end] === '\\') end+=2; else if (source[end++] === quote) break; }
      }
    }
    if (end !== undefined) { erase(i, end); i=end; } else i++;
  }
  return out.join('');
}

let assertions = 0;
function check(value) { assert(value); assertions++; }
const lexicalFixture='rng(1,2); // rng(3,4)\n"rng(5,6)"; R"tag(rng(7,8))tag"; /* rng(9,10) */\nrng_bits(); 1\'000; 0xff\'ff; rng_float(0,1);';
const maskedFixture=maskNonCode(lexicalFixture);
check(maskedFixture.length===lexicalFixture.length);
check(maskedFixture.split('\n').length===lexicalFixture.split('\n').length);
check((maskedFixture.match(/\brng\s*\(/g) ?? []).length===1);
check((maskedFixture.match(/\brng_bits\s*\(/g) ?? []).length===1);
check((maskedFixture.match(/\brng_float\s*\(/g) ?? []).length===1);

const groups = [
  ['random_engine_or_entropy_type', /\b(?:std\s*::\s*)?(?:minstd_rand0|minstd_rand|mt19937_64|mt19937|ranlux24_base|ranlux48_base|ranlux24|ranlux48|knuth_b|default_random_engine|linear_congruential_engine|mersenne_twister_engine|subtract_with_carry_engine|discard_block_engine|independent_bits_engine|shuffle_order_engine|random_device|seed_seq|cata_default_random_engine)\b/g],
  ['random_distribution_type', /\b(?:std\s*::\s*)?(?:uniform_int_distribution|uniform_real_distribution|normal_distribution|exponential_distribution|chi_squared_distribution|bernoulli_distribution|binomial_distribution|negative_binomial_distribution|geometric_distribution|poisson_distribution|gamma_distribution|weibull_distribution|extreme_value_distribution|lognormal_distribution|cauchy_distribution|fisher_f_distribution|student_t_distribution|discrete_distribution|piecewise_constant_distribution|piecewise_linear_distribution)\b/g],
  ['global_rng_interface', /\b(?:rng|rng_bits|rng_float|random_direction|one_in|one_turn_in|x_in_y|dice|roll_remainder|rng_sequence|rng_normal|rng_exponential|normal_roll|exponential_roll|chi_squared_roll|rng_get_engine|rng_get_first_seed|rng_set_engine_seed|random_string|random_entry|random_entry_opt|random_entry_ref|random_entry_removed|random_point|random_point_on_level)\s*\(/g],
  ['standard_random_algorithm', /\bstd\s*::\s*(?:shuffle|sample|random_shuffle|generate_canonical)\s*\(/g],
  ['c_or_os_random_api', /\b(?:rand|srand|random|srandom|rand_r|drand48|lrand48|mrand48|seed48|srand48|getrandom|arc4random|arc4random_buf|BCryptGenRandom|RtlGenRandom)\s*\(/g],
  ['real_clock_api', /\b(?:std\s*::\s*chrono\s*::\s*)?(?:system_clock|steady_clock|high_resolution_clock)\b|\b(?:SDL_GetTicks64|SDL_GetTicks|SDL_GetPerformanceCounter|SDL_GetPerformanceFrequency|SDL_Delay|clock_gettime|gettimeofday|timespec_get|time|clock)\s*\(|\b[A-Za-z_]\w*\s*::\s*now\s*\(/g],
  ['simulation_calendar', /\bcalendar\s*::\s*(?:turn|start_of_game|start_of_cataclysm|initial_season|season_length)\b/g],
];
const files = fs.readdirSync(path.join(upstream, 'src')).filter(name => /\.(?:cpp|h|hpp|c)$/.test(name)).sort();
const occurrences=[];
const manifest=[];
for (const name of files) {
  const relative=`src/${name}`;
  const bytes=fs.readFileSync(path.join(upstream, relative));
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const source=bytes.toString('utf8');
  const code=maskNonCode(source);
  check(code.length===source.length);
  const lines=source.split('\n');
  const offsets=[0];
  for (let i=0;i<code.length;i++) if (code[i]==='\n') offsets.push(i+1);
  const ppByLine=[]; const stack=[];
  for (let i=0;i<lines.length;i++) {
    const directive=/^\s*#\s*(if|ifdef|ifndef|elif|else|endif)\b(.*)/.exec(lines[i]);
    if (directive) {
      if (/^(?:if|ifdef|ifndef)$/.test(directive[1])) stack.push({line:i+1,directive:directive[0].trim()});
      else if (directive[1]==='endif') stack.pop();
      else if (stack.length) stack[stack.length-1]={line:i+1,directive:directive[0].trim(),alternate_of:stack[stack.length-1].line};
    }
    ppByLine[i]=stack.map(value => ({...value}));
  }
  for (const [group, pattern] of groups) {
    pattern.lastIndex=0;
    for (const match of code.matchAll(pattern)) {
      let low=0, high=offsets.length;
      while (low+1<high) { const mid=(low+high)>>1; if (offsets[mid]<=match.index) low=mid; else high=mid; }
      occurrences.push({source:relative,line:low+1,column:match.index-offsets[low]+1,group,token:match[0].replace(/\s+/g,' ').trim(),excerpt:lines[low].trim(),source_sha256:sha256,translation_unit_listed_in_browser_build:compiled.has(relative),preprocessor_stack:ppByLine[low]});
    }
  }
  manifest.push({source:relative,bytes:bytes.length,sha256,translation_unit_listed_in_browser_build:compiled.has(relative)});
}
occurrences.sort((a,b)=>a.source.localeCompare(b.source,'en') || a.line-b.line || a.column-b.column || a.group.localeCompare(b.group,'en'));
const counts={}; for (const row of occurrences) counts[row.group]=(counts[row.group] ?? 0)+1;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const inventoryBytes=occurrences.map(value=>JSON.stringify(value)).join('\n')+'\n';
const sourceManifestBytes=JSON.stringify({upstream_commit:acquisition.commit_sha,files:manifest},null,2)+'\n';
fs.mkdirSync(here,{recursive:true});
fs.writeFileSync(path.join(here,'occurrences.jsonl'),inventoryBytes);
fs.writeFileSync(path.join(here,'SOURCE-MANIFEST.json'),sourceManifestBytes);
fs.writeFileSync(path.join(here,'SCAN-EVIDENCE.json'),JSON.stringify({schema:1,status:'LEXICAL_SOURCE_AUDIT_ONLY',upstream_commit:acquisition.commit_sha,scope:'Immediate src/*.cpp, *.h, *.hpp, *.c only; no data, lang, tests, third-party, generated output or build execution',source_files:files.length,source_bytes:manifest.reduce((sum,row)=>sum+row.bytes,0),occurrences:occurrences.length,counts,lightweight_lexical_assertions:assertions,inventory_sha256:hash(inventoryBytes),source_manifest_sha256:hash(sourceManifestBytes),preprocessor_evaluated:false,cpp_ast_resolved:false,callgraph_exhaustive:false,full_game_determinism_verified:false,rng_adapter_integrated_into_full_engine:false},null,2)+'\n');
console.log(JSON.stringify({files:files.length,occurrences:occurrences.length,counts,assertions}));
