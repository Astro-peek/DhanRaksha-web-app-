import { create } from 'zustand';

export const useChitStore = create((set) => ({
  groups: [],
  currentGroup: null,
  currentCycle: null,
  bids: [],
  contributions: [],
  setGroups: (groups) => set({ groups }),
  setCurrentGroup: (currentGroup) => set({ currentGroup }),
  setCurrentCycle: (currentCycle) => set({ currentCycle }),
  setBids: (bids) => set({ bids }),
  addBid: (bid) => set((state) => ({ bids: [bid, ...state.bids] })),
  setContributions: (contributions) => set({ contributions }),
  updateContribution: (contributionId, updates) => set((state) => ({
    contributions: state.contributions.map((c) => c.id === contributionId ? { ...c, ...updates } : c)
  }))
}));

export default useChitStore;
