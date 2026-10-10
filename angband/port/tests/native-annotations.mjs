// Compose independent reversible source annotations on both sides of a
// comparison. Each feature still owns its exact immutable baseline hashes.
import {reconstructDeath} from '../migration/death-data/native-parity.mjs';
import {reconstructTextInput} from '../migration/text-input/native-parity.mjs';
import {stripDomain} from '../migration/domain-text-data/integrate.mjs';
import {stripObjects} from '../migration/object-message-data/integrate.mjs';
import {stripStat} from '../migration/stat-message-data/integrate.mjs';
import {stripResidual} from '../migration/ui-residual-message-data/native-parity.mjs';
import {stripChecks} from '../migration/check-data/native-parity.mjs';
import {stripEffect} from '../migration/effect-description-data/integrate.mjs';
import {reconstructContext} from '../migration/context-menu-data/native-parity.mjs';

// New families separately pin their predecessor bytes in source tests. Remove
// only their explicit regions before composing the older independent proofs.
function stripOwnedRegion(source, name) {
  const begin = `/* ${name}_BEGIN */`, end = `/* ${name}_END */`;
  const begins = source.split(begin).length - 1;
  const ends = source.split(end).length - 1;
  if (begins !== ends) throw new Error(`unbalanced ${name} source annotation`);
  return source.replace(new RegExp(`/\\* ${name}_BEGIN \\*/[\\s\\S]*?/\\* ${name}_END \\*/`, 'g'), '');
}

export function stripRecentAnnotations(source) {
  source = reconstructContext(source);
  for (const name of [
    'AB_MESSAGE_RECALL', 'AB_RECALL_KNOWLEDGE',
    'AB_CHARACTER_MATRIX_INLINE', 'AB_CHARACTER_MATRIX',
    'AB_LOOK_TARGET_INLINE', 'AB_LOOK_TARGET',
    'AB_GAME_HISTORY', 'AB_CHEST_MESSAGE',
    'AB_BROWSER_SEMANTIC_STORAGE', 'AB_MESSAGE_RECALL_BIRTH',
  ]) source = stripOwnedRegion(source, name);
  source = source.replace(/\/\* AB_LIST_TEXT_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_LIST_TEXT_INLINE_END \*\//g, '');
  source = source.replace(/\/\* AB_LIST_TEXT_BEGIN \*\/[\s\S]*?\/\* AB_LIST_TEXT_END \*\//g, '');
  source = source.replace(/\r?\n\/\* AB_STORE_WELCOME_BEGIN \*\/\r?\n[\s\S]*?\/\* AB_STORE_WELCOME_END \*\/\r?\n/g, '');
  source = source.replace(/\/\* AB_STORE_WELCOME_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_STORE_WELCOME_INLINE_END \*\//g, '');
  source = stripEffect(stripChecks(stripResidual(source)));
  source = stripStat(stripObjects(stripDomain(reconstructTextInput(reconstructDeath(source)))));
  source = source.replace(/\/\* AB_COMBAT_BEGIN \*\/[\s\S]*?\/\* AB_COMBAT_END \*\//g, '');
  source = source.replace(/\/\* AB_MON_ACTION_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_MON_ACTION_INLINE_END \*\//g, '');
  source = source.replace(/\/\* AB_MON_ACTION_BEGIN \*\/[\s\S]*?\/\* AB_MON_ACTION_END \*\//g, '');
  source = source.replace(/\/\* AB_STORE_TEXT_BEGIN \*\/[\s\S]*?\/\* AB_STORE_TEXT_END \*\//g, '');
  source = source.replace(/\/\* AB_REALM_BEGIN \*\/[\s\S]*?\/\* AB_REALM_END \*\//g, '');
  source = source.replace(/\r?\n\/\* AB_KNOWLEDGE_BEGIN \*\/[\s\S]*?\/\* AB_KNOWLEDGE_END \*\/\r?\n/g, '');
  source = source.replace(/\/\* AB_KNOWLEDGE_INLINE_BEGIN \*\/[\s\S]*?\/\* AB_KNOWLEDGE_INLINE_END \*\//g, '');
  return source;
}
