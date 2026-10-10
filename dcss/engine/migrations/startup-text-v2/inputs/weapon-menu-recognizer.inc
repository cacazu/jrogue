export function classifyStartingWeaponMenu(rows, prompts, labels = null) {
  const normalize = text => text.replace(/\s+/g, ' ').trim(), lines = rows.map(normalize);
  const roles = ['recommended','aptitudes','help','random','back'];
  const legacy = ['+ - Recommended random choice','* - Random weapon','Bksp - Return to character menu'];
  for (const language of ['en','ja']) {
    if (!lines.some(line=>line.includes(prompts[language]))) continue;
    const expected = labels ? roles.map(role=>labels[language]['startup.weapon.'+role+'.label']) : legacy;
    if (expected.some(label=>typeof label!=='string')) throw Error('incomplete source-bound weapon controls');
    if (!expected.every(label=>lines.some(line=>line.includes(normalize(label))))) continue;
    if (labels && roles.some(role=>labels[language]['startup.weapon.'+role+'.label']!==labels[language==='en'?'ja':'en']['startup.weapon.'+role+'.label']
      && lines.some(line=>line.includes(normalize(labels[language==='en'?'ja':'en']['startup.weapon.'+role+'.label']))))) continue;
    return {kind:'weapon',language,semantic_id:'startup.weapon.prompt',prompt:prompts[language],
      display_schema:labels?2:1,control_ids:labels?roles.map(role=>'startup.weapon.'+role+'.label'):[],controls:expected};
  }
  return null;
}

