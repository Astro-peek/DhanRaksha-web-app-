import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let active = true;

    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (active) {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setLoading(false);
      }
    });

    // Listen to changes in auth state (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (active) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Control path guards dynamically
  useEffect(() => {
    if (loading) return;

    const isPublicPath = location.pathname === '/login';

    if (!session && !isPublicPath) {
      // User is not authenticated; redirect to login
      navigate('/login', { replace: true });
    } else if (session && isPublicPath) {
      // User is authenticated but trying to access login; redirect to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [session, loading, location.pathname, navigate]);

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during signout:', error);
    } finally {
      setSession(null);
      setUser(null);
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

export const useAuth = () => useContext(AuthContext);
