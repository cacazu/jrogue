// Adapter for a completed owned Rust presentation. No C/RNG/text translation.
export const MAX_CHARACTER_EXPORT_BYTES = 8 * 1024 * 1024;
export function collectCharacterExport(model) {
  if (!model || model.schema_version !== 1 || !['en','ja'].includes(model.locale)) throw new Error('export.capture_rejected');
  const scope=model.semantic?.scopes?.find(scope=>scope.context==='character-export');
  const section=model.sections?.find(section=>section.key==='character-export');
  const completion=scope?.widgets?.find(packet=>packet.event?.id==='' && packet.event?.widget==='__export_ready');
  const expected=completion?.event?.params?.expected_rows;
  if (!scope || !section || expected?.type!=='integer' || !Number.isInteger(expected.value) || expected.value<1 || expected.value>16384) throw new Error('export.capture_rejected');
  if (scope.widgets.some(packet=>packet.event?.id && typeof packet.text!=='string')) throw new Error('export.capture_rejected');
  const lines=[];let previous=-1;
  for (const block of section.blocks) {
    if (block.kind!=='paragraph') throw new Error('export.capture_rejected');
    const match=/^export\.row\.(\d+)\.label(?:\.[a-z0-9_.]+)?$/.exec(block.key);
    if (!match || typeof block.text!=='string' || block.text.includes('\0')) throw new Error('export.capture_rejected');
    const index=Number(match[1]);if (!Number.isSafeInteger(index) || index<previous || index>16383 || index>previous+1) throw new Error('export.capture_rejected');
    previous=index;lines.push(block.text);
  }
  if (!lines.length || previous+1!==expected.value) throw new Error('export.capture_rejected');
  const text=lines.join('\n')+'\n';
  if (new TextEncoder().encode(text).length>MAX_CHARACTER_EXPORT_BYTES) throw new Error('export.capture_rejected');
  return Object.freeze({locale:model.locale,text,filename:`angband-character-${model.locale}.txt`});
}
