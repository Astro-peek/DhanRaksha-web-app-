const CHUNK_RECOVERY_KEY = 'sk_chunk_recovery_done';

export function isChunkLoadError(err) {
  const text = String(err?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|module script|Unexpected token </i.test(text);
}

export async function recoverFromChunkError() {
  if (sessionStorage.getItem(CHUNK_RECOVERY_KEY)) return false;
  sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn('Chunk recovery cleanup failed:', err);
  }

  window.location.reload();
  return true;
}
