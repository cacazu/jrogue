// Native development saves are asynchronous; the Rust boundary validates packs.
const open = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('dcss-native-development', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('saves');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const ended = signal => signal?.reason ?? new Error('native storage transaction aborted');
export async function put(key, value, { signal } = {}) {
  if (signal?.aborted) throw ended(signal);
  const db = await open();
  try {
    if (signal?.aborted) throw ended(signal);
    await new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      const abort = () => {
        try { tx.abort(); }
        catch { /* An already committed transaction contains a complete pack. */ }
      };
      const clean = () => signal?.removeEventListener('abort', abort);
      tx.oncomplete = () => { clean(); resolve(); };
      tx.onerror = () => { clean(); reject(tx.error); };
      tx.onabort = () => { clean(); reject(signal?.aborted ? ended(signal) : tx.error); };
      signal?.addEventListener('abort', abort, { once: true });
      tx.objectStore('saves').put(value, key);
      if (signal?.aborted) abort();
    });
  } finally { db.close(); }
}
export async function get(key) {
  const db = await open();
  try { return await new Promise((resolve, reject) => {
    const request = db.transaction('saves').objectStore('saves').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
