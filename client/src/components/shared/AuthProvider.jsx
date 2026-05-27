import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/authStore';
import api from '../../lib/api';

const AuthContext = React.createContext({
  session: null,
  user: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }) => {
  const { session, user, loading, setSession, setUser, setLoading, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession }, error: sessionErr } = await supabase.auth.getSession();
        
        if (sessionErr) throw sessionErr;

        if (initialSession) {
          // Check if session is expired or close to it
          const isExpired = initialSession.expires_at && (initialSession.expires_at * 1000) < Date.now();
          let currentSession = initialSession;

          if (isExpired) {
            console.log('Session expired, refreshing...');
            const { data: { session: refreshedSession }, error: refreshErr } = await supabase.auth.refreshSession();
            if (refreshErr) {
              console.error('Session refresh failed:', refreshErr);
              clearAuth();
              setLoading(false);
              return;
            }
            currentSession = refreshedSession;
          }

          if (active && currentSession) {
            setSession(currentSession);
            // Fetch DB profile via /api/auth/me
            try {
              const res = await api.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${currentSession.access_token}` }
              });
              setUser(res.data);
            } catch (err) {
              console.error('Failed to fetch user profile:', err);
              // Fallback user from session
              setUser({
                id: currentSession.user.id,
                mobile: currentSession.user.phone?.replace('+91', '') || '',
                onboarding_completed: false
              });
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearAuth();
      } finally {
        if (active) setLoading(false);
      }
    };

    initializeAuth();

    // Listen to changes in auth state (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('onAuthStateChange event:', event);
      if (!active) return;

      if (currentSession) {
        setSession(currentSession);
        // Only fetch profile from server on actual sign-in events.
        // TOKEN_REFRESHED just updates the session token — no need to re-hit the server.
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          try {
            const res = await api.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${currentSession.access_token}` }
            });
            setUser(res.data);
          } catch (err) {
            console.error('Failed to fetch user profile on state change:', err);
            setUser({
              id: currentSession.user.id,
              mobile: currentSession.user.phone?.replace('+91', '') || '',
              onboarding_completed: false
            });
          }
        }
        setLoading(false);
      } else {
        clearAuth();
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setSession, setUser, setLoading, clearAuth]);

  // Path guards and redirection logic
  useEffect(() => {
    if (loading) return;

    const isPublicPath = location.pathname === '/login' || location.pathname.startsWith('/verify/');
    const isOnboardingPath = location.pathname === '/onboarding';

    if (!session) {
      if (!isPublicPath) {
        navigate('/login', { replace: true });
      }
    } else {
      // Authenticated
      if (user) {
        if (!user.onboarding_completed) {
          if (!isOnboardingPath) {
            navigate('/onboarding', { replace: true });
          }
        } else {
          // Onboarding completed
          if (isPublicPath || isOnboardingPath) {
            navigate('/dashboard', { replace: true });
          }
        }
      }
    }
  }, [session, user, loading, location.pathname, navigate]);

  const logout = async () => {
    setLoading(true);
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout API call failed, signing out locally:', err);
    } finally {
      await supabase.auth.signOut();
      clearAuth();
      setLoading(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
export default AuthProvider;
