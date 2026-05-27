import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      session: null,
      user: null,
      loading: true,
      setSession: (session) => set({ session }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ session: null, user: null }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'safekosh-auth-storage',
      partialize: (state) => ({ session: state.session, user: state.user }),
    }
  )
);

export default useAuthStore;
