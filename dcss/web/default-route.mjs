// Local full-engine route; the reference tools require explicit opt-in.
export function selectAppMode(href) {
  return new URL(href).searchParams.get('reference') === '1' ? 'reference' : 'core';
}

export function selectCoreRuntime(href) {
  const requested = new URL(href).searchParams.get('runtime');
  if (requested !== null && requested !== 'jspi') {
    const error = new Error('the local full-engine route requires JSPI');
    error.code = 'unsupported-runtime';
    throw error;
  }
  return 'jspi';
}

export function coreResumeURL(href) {
  const url = new URL(href);
  url.pathname = '/'; url.search = '?resume=1'; url.hash = '';
  return url.href;
}
