import { toast } from 'react-hot-toast';

export const offlineQueue = [];

if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    // Clear the offline persistent toast if it exists
    toast.dismiss('offline');
    
    if (offlineQueue.length > 0) {
      toast.loading('Network mil gaya! Syncing pending actions...', { id: 'syncing' });
      
      while (offlineQueue.length > 0) {
        const { fn, args } = offlineQueue.shift();
        try {
          await fn(...args);
        } catch (e) {
          console.error('Retry failed for offline action:', e);
        }
      }
      
      toast.dismiss('syncing');
      toast.success('Wapas online! Sab kuch sync ho gaya.', { icon: '🔄' });
    }
  });

  window.addEventListener('offline', () => {
    toast.error('Internet nahi hai. Data baad mein sync hoga.', {
      duration: Infinity,
      id: 'offline',
      icon: '📡'
    });
  });
}

/**
 * Wraps critical API calls so they are queued when offline.
 */
export async function withOfflineQueue(fn, ...args) {
  if (!navigator.onLine) {
    offlineQueue.push({ fn, args });
    toast('Internet nahi hai. Yeh action baad mein hoga.', {
      icon: '📡',
      style: { border: '1px solid #D97706', color: '#78350F' }
    });
    return null;
  }
  return fn(...args);
}

export default withOfflineQueue;
