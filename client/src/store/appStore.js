import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set) => ({
      language: 'hi',
      sidebarOpen: false,
      onlineStatus: navigator.onLine,
      setLanguage: (language) => set({ language }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setOnlineStatus: (onlineStatus) => set({ onlineStatus }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'safekosh-app-storage',
      partialize: (state) => ({ language: state.language }),
    }
  )
);

export default useAppStore;
