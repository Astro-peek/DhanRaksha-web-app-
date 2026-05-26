import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/api';

export default function useNudges() {
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef(null);

  const fetchNudges = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/nudges');
      if (response.data?.success) {
        const fetched = response.data.nudges || [];
        
        // Filter out dismissed nudges stored in localStorage
        const dismissed = JSON.parse(localStorage.getItem('sk_dismissed_nudges') || '[]');
        const now = new Date();
        
        const filtered = fetched.filter(nudge => {
          if (dismissed.includes(nudge.id)) return false;
          
          // Auto-dismiss after 24h
          const createdAt = new Date(nudge.created_at);
          const diffHours = (now - createdAt) / (1000 * 60 * 60);
          if (diffHours >= 24) {
            dismissed.push(nudge.id);
            localStorage.setItem('sk_dismissed_nudges', JSON.stringify(dismissed));
            return false;
          }
          return true;
        });

        setNudges(filtered);
      }
    } catch (err) {
      console.error('Error fetching nudges:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissNudge = useCallback((id) => {
    const dismissed = JSON.parse(localStorage.getItem('sk_dismissed_nudges') || '[]');
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem('sk_dismissed_nudges', JSON.stringify(dismissed));
    }
    setNudges(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAsSeen = useCallback(async (id) => {
    try {
      await api.post(`/api/nudges/${id}/seen`);
      setNudges(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(`Error marking nudge ${id} as seen:`, err);
    }
  }, []);

  // Callback ref for DOM elements to observe visibility
  const nudgeRef = useCallback((id) => (node) => {
    if (!node) return;
    
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const nudgeId = entry.target.getAttribute('data-nudge-id');
            if (nudgeId) {
              markAsSeen(nudgeId);
              observerRef.current.unobserve(entry.target);
            }
          }
        });
      }, { threshold: 0.5 });
    }
    
    node.setAttribute('data-nudge-id', id);
    observerRef.current.observe(node);
  }, [markAsSeen]);

  useEffect(() => {
    fetchNudges();
    const interval = setInterval(fetchNudges, 5 * 60 * 1000); // Poll 5 minutes
    
    return () => {
      clearInterval(interval);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [fetchNudges]);

  return { nudges, loading, dismissNudge, markAsSeen, nudgeRef, refresh: fetchNudges };
}
export { useNudges };
