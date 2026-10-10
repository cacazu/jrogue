// catalogs.mjs is generated deterministically from the two JSON catalogs.
import { catalogs } from './catalogs.mjs';

export class V5AssetError extends Error {
  constructor(textId, parameters = {}) {
    super(textId);
    this.name = 'V5AssetError';
    this.textId = textId;
    this.parameters = Object.freeze({ ...parameters });
  }
}

export function formatV5Message(language, textId, parameters = {}) {
  const template = catalogs[language]?.[textId];
  if (typeof template !== 'string') throw new V5AssetError('assets.v5.policy_failed');
  const names = [...template.matchAll(/\{([a-z]+)\}/g)].map(match => match[1]);
  if (new Set(names).size !== Object.keys(parameters).length ||
      names.some(name => !Object.hasOwn(parameters, name))) {
    throw new V5AssetError('assets.v5.policy_failed');
  }
  // Only declared named parameters are formatted. Asset names are preserved.
  return template.replace(/\{([a-z]+)\}/g, (_match, name) => String(parameters[name]));
}

export function formatV5Error(error, language = 'ja') {
  if (!(error instanceof V5AssetError)) return String(error);
  return formatV5Message(language === 'en' ? 'en' : 'ja', error.textId, error.parameters);
}
