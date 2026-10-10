import { ASSETS, TILESET_ID } from './asset-manifest.mjs';
import { V5AssetError } from './v5-errors.mjs';

export function digestWords(sha256) {
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new V5AssetError('assets.v5.crypto_failed');
  }
  return Array.from({ length: 8 }, (_value, index) => parseInt(sha256.slice(index * 8, index * 8 + 8), 16));
}

export function bindV5Policy(exports) {
  const required = ['cdda_v5_policy_version', 'cdda_v5_asset_count', 'cdda_v5_validate_asset',
    'cdda_v5_new_profile_option_count', 'cdda_v5_new_profile_option_kind'];
  if (required.some(name => typeof exports[name] !== 'function') ||
      exports.cdda_v5_policy_version() !== 1 || exports.cdda_v5_asset_count() !== ASSETS.length) {
    throw new V5AssetError('assets.v5.policy_failed');
  }
  return Object.freeze({
    validateAsset(index, bytes, digest) {
      if (!Number.isInteger(index) || index < 0 || index >= ASSETS.length ||
          !Number.isInteger(bytes) || bytes < 0 || bytes > 0xffffffff) {
        throw new V5AssetError('assets.v5.policy_failed');
      }
      const status = exports.cdda_v5_validate_asset(index, bytes, ...digestWords(digest));
      if (![0, 1, 2, 3].includes(status)) throw new V5AssetError('assets.v5.policy_failed');
      return status;
    },
    newProfileOptions() {
      if (exports.cdda_v5_new_profile_option_count() !== 3) {
        throw new V5AssetError('assets.v5.invalid_option_policy');
      }
      const definitions = [undefined, { name: 'USE_LANG', value: 'ja' },
        { name: 'TILES', value: TILESET_ID }, { name: 'OVERMAP_TILES', value: TILESET_ID }];
      return [0, 1, 2].map(index => {
        const kind = exports.cdda_v5_new_profile_option_kind(index);
        if (kind !== index + 1) throw new V5AssetError('assets.v5.invalid_option_policy');
        return { ...definitions[kind] };
      });
    }
  });
}

export async function loadV5Policy({ url, bytes, sha256, fetchImpl = fetch, cryptoImpl = crypto }) {
  try {
    const response = await fetchImpl(url, { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
    if (!response.ok) throw new V5AssetError('assets.v5.policy_failed');
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== bytes) throw new V5AssetError('assets.v5.policy_failed');
    const hash = new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', data));
    const actual = Array.from(hash, value => value.toString(16).padStart(2, '0')).join('');
    if (actual !== sha256) throw new V5AssetError('assets.v5.policy_failed');
    const module = await WebAssembly.compile(data);
    if (WebAssembly.Module.imports(module).length !== 0) throw new V5AssetError('assets.v5.policy_failed');
    return bindV5Policy((await WebAssembly.instantiate(module)).exports);
  } catch (error) {
    if (error instanceof V5AssetError) throw error;
    throw new V5AssetError('assets.v5.policy_failed');
  }
}
