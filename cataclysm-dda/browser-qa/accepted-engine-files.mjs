import { createHash } from 'node:crypto';

export const acceptedManifestSha256 = 'eb09bac0ddaf7373b411bcfe7a60d21e4fd4775689e4e7437e07be0283360f39';

// Fixed original-engine artifacts reviewed from the verified reference package.
export const acceptedEngineFiles = Object.freeze([
  Object.freeze({ filename: 'cataclysm-tiles.js', bytes: 498522, sha256: '8e41e1903f220bbaf8831a215de66427b166741ca19f2fa01edc0995e0cc74b5' }),
  Object.freeze({ filename: 'cataclysm-tiles.wasm', bytes: 134832388, sha256: '3db7de7161c00e711828e219b148a376f15297c5fd6ee1213b14d10228a7f666' }),
  Object.freeze({ filename: 'cataclysm-tiles.data.js', bytes: 2225841, sha256: '2148975c28b02862887c722406c6c33007c22981e37303db3e8c588370bc098a' }),
  Object.freeze({ filename: 'cataclysm-tiles.data', bytes: 116219695, sha256: '9ace7d8c416f67e066fa9897150af616c5cd8dc4bd8558f99cb22a99179d1212' })
]);

export function assertAcceptedEngineFiles(actualFiles) {
  if (!Array.isArray(actualFiles) || actualFiles.length !== acceptedEngineFiles.length) throw new Error('Expected exactly four accepted engine artifacts.');
  const seen = new Set();
  for (const actual of actualFiles) {
    const expected = acceptedEngineFiles.find(file => file.filename === actual?.filename);
    if (!expected || seen.has(actual.filename)) throw new Error('Unexpected or duplicate engine artifact: ' + actual?.filename);
    seen.add(actual.filename);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) throw new Error('Accepted engine artifact size/digest mismatch: ' + actual.filename);
  }
}

export function assertAcceptedManifestBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || createHash('sha256').update(bytes).digest('hex') !== acceptedManifestSha256) throw new Error('Accepted package manifest byte digest mismatch.');
}

export function assertAcceptedEngineManifest(manifest) {
  if (!Array.isArray(manifest?.files)) throw new Error('Accepted package manifest files are missing or malformed.');
  const seen = new Set();
  for (const file of manifest.files) {
    if (!file || typeof file.path !== 'string' || file.path.length === 0 || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Malformed package manifest file record.');
    if (seen.has(file.path)) throw new Error('Duplicate package manifest file record: ' + file.path);
    seen.add(file.path);
  }
  const expectedNames = new Set(acceptedEngineFiles.map(file => file.filename));
  assertAcceptedEngineFiles(manifest.files.filter(file => expectedNames.has(file.path)).map(file => ({ filename: file.path, bytes: file.bytes, sha256: file.sha256 })));
}
