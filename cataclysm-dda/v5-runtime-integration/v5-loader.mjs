import { ASSETS, TILESET_DIRECTORY, TILESET_ID } from './asset-manifest.mjs';
import { V5AssetError } from './v5-errors.mjs';

async function digest(data, cryptoImpl) {
  try {
    return Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', data)),
      value => value.toString(16).padStart(2, '0')).join('');
  } catch {
    throw new V5AssetError('assets.v5.crypto_failed');
  }
}

function verifyWithPolicy(policy, index, data, hash) {
  const asset = ASSETS[index];
  const status = policy.validateAsset(index, data.byteLength, hash);
  if (status === 2) throw new V5AssetError('assets.v5.size_failed', { file: asset.name });
  if (status === 3) throw new V5AssetError('assets.v5.digest_failed', { file: asset.name });
  if (status !== 0) throw new V5AssetError('assets.v5.policy_failed');
}

// Fetch and validate the entire small release before exposing any path to C++.
export async function prepareV5Assets(policy, { baseUrl = new URL('./assets/', import.meta.url),
  fetchImpl = fetch, cryptoImpl = crypto } = {}) {
  const files = [];
  for (const [index, asset] of ASSETS.entries()) {
    let response;
    try {
      response = await fetchImpl(new URL(asset.name, baseUrl),
        { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
    } catch {
      throw new V5AssetError('assets.v5.fetch_failed', { file: asset.name, status: 0 });
    }
    if (!response.ok) throw new V5AssetError('assets.v5.fetch_failed', { file: asset.name, status: response.status });
    const declaredLength = response.headers?.get('content-length');
    if (declaredLength !== null && declaredLength !== undefined &&
        (!/^\d+$/.test(declaredLength) || Number(declaredLength) !== asset.bytes)) {
      throw new V5AssetError('assets.v5.size_failed', { file: asset.name });
    }
    let data;
    try { data = new Uint8Array(await response.arrayBuffer()); } catch {
      throw new V5AssetError('assets.v5.fetch_failed', { file: asset.name, status: response.status });
    }
    if (data.byteLength !== asset.bytes) throw new V5AssetError('assets.v5.size_failed', { file: asset.name });
    const hash = await digest(data, cryptoImpl);
    verifyWithPolicy(policy, index, data, hash);
    files.push(Object.freeze({ name: asset.name, data }));
  }
  return Object.freeze({ files: Object.freeze(files), policy, cryptoImpl });
}

// Called after the original C++ syncfs(true), before its callback resumes main.
// This only creates a fresh nonpersistent /gfx directory. C++ owns IDBFS.
export async function installV5Assets(FS, prepared) {
  if (FS.analyzePath(TILESET_DIRECTORY).exists) {
    throw new V5AssetError('assets.v5.existing_directory');
  }
  if (!Array.isArray(prepared?.files) || prepared.files.length !== ASSETS.length ||
      prepared.files.some((file, index) => file?.name !== ASSETS[index].name || !(file.data instanceof Uint8Array))) {
    throw new V5AssetError('assets.v5.policy_failed');
  }
  // Revalidate buffers before the first mutation: callers cannot bypass the
  // Rust policy by changing a prepared Uint8Array after fetching it.
  for (const [index, file] of prepared.files.entries()) {
    verifyWithPolicy(prepared.policy, index, file.data, await digest(file.data, prepared.cryptoImpl));
  }
  let directoryCreated = false;
  const written = [];
  let current = ASSETS[0].name;
  try {
    FS.mkdir(TILESET_DIRECTORY);
    directoryCreated = true;
    for (const [index, file] of prepared.files.entries()) {
      current = ASSETS[index].name;
      const filename = TILESET_DIRECTORY + '/' + current;
      // Track the new path before writing so a partial write is rolled back.
      written.push(filename);
      FS.writeFile(filename, file.data);
      const readback = FS.readFile(filename, { encoding: 'binary' });
      try {
        verifyWithPolicy(prepared.policy, index, readback, await digest(readback, prepared.cryptoImpl));
      } catch {
        throw new V5AssetError('assets.v5.readback_failed', { file: current });
      }
    }
    return { tileset: TILESET_ID, directory: TILESET_DIRECTORY, files: ASSETS.length,
      bytes: ASSETS.reduce((sum, asset) => sum + asset.bytes, 0), policy: 'rust-metadata-v1',
      originalEngineRendererExecuted: false };
  } catch (error) {
    const cleanupFailures = [];
    for (const filename of written.reverse()) {
      try { if (FS.analyzePath(filename).exists) FS.unlink(filename); } catch { cleanupFailures.push(filename); }
    }
    if (directoryCreated) { try { FS.rmdir(TILESET_DIRECTORY); } catch { cleanupFailures.push(TILESET_DIRECTORY); } }
    const failure = error instanceof V5AssetError ? error : new V5AssetError('assets.v5.install_failed', { file: current });
    failure.cleanupFailures = Object.freeze(cleanupFailures);
    throw failure;
  }
}
