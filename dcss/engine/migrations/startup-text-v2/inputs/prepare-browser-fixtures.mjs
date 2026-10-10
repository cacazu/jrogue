import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url)), game = 'C:/Users/kit/gameme/jnethack/jrouge/dcss';
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), files = {};
function emit(relative, bytes, base) {
  const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
  files[relative] = { base_sha256: base && hash(base), sha256: hash(fs.readFileSync(file)) };
}
const controlledBase = fs.readFileSync(path.join(game, 'tests/controlled-gameplay-browser.mjs'));
let controlled = controlledBase.toString('utf8');
const start = controlled.indexOf('export function classifyStartingWeaponMenu('), end = controlled.indexOf('export function classifyWizardPrompt(', start);
if (start < 0 || end < start) throw Error('missing bounded starting-menu recognizer');
const classifier = fs.readFileSync(path.join(root,'weapon-menu-recognizer.inc'),'utf8');
controlled = controlled.slice(0,start)+classifier+'\n'+controlled.slice(end);
const returnAnchor = '    startup_weapon_prompts: startupWeaponPrompts };';
if (!controlled.includes(returnAnchor)) throw Error('missing source verifier return');
controlled = controlled.replace(returnAnchor, '    startup_weapon_prompts: startupWeaponPrompts,\n    startup_weapon_labels: Object.fromEntries(await Promise.all(["en", "ja"].map(async language => [language, JSON.parse(await readFile(path.join(root, "locales/startup/" + language + ".json"), "utf8"))]))) };');
emit('tests/controlled-gameplay-browser.mjs',controlled,controlledBase);
const runnerBase=fs.readFileSync(path.join(game,'tests/controlled-core-browser.mjs'));
emit('tests/controlled-core-browser.mjs',runnerBase.toString('utf8').replace('classifyStartingWeaponMenu(evidence.startup_rows, official.startup_weapon_prompts)',
  'classifyStartingWeaponMenu(evidence.startup_rows, official.startup_weapon_prompts, official.startup_weapon_labels)'),runnerBase);
const witnessBase=fs.readFileSync(path.join(game,'tests/root-native-witness.mjs'));
let witness=witnessBase.toString('utf8').replace("import assert from 'node:assert/strict';",
  "import assert from 'node:assert/strict';\nimport { STARTUP_TEXT_PIN } from '../web/startup-text.mjs';\nconst weaponLabels = Object.fromEntries(['en','ja'].map(language => [language, Object.fromEntries(Object.entries(STARTUP_TEXT_PIN.messages).map(([id,message]) => [id,message[language]]))]));");
witness=witness.replace('classifyStartingWeaponMenu(rows, prompts)','classifyStartingWeaponMenu(rows, prompts, weaponLabels)');
emit('tests/root-native-witness.mjs',witness,witnessBase);
// Read-only dependency snapshot for source mocks only. The parent owns its
// separately evolving history/lifecycle suite: never promote this snapshot.
const dependency=fs.readFileSync(path.join(game,'tests/lifecycle-browser.mjs'));
emit('tests/lifecycle-browser.mjs',dependency,dependency);
files['tests/lifecycle-browser.mjs'].install=false;
emit('browser-fixture-receipts.json',JSON.stringify({schema_version:2,source_only:true,installed_files_changed:false,files},null,2)+'\n');
console.log(JSON.stringify({ok:true,source_only:true,files}));
