import { create } from 'zustand';

export const useVaultStore = create((set) => ({
  balance: 0.00,
  transactions: [],
  account: null,
  loading: false,
  setBalance: (balance) => set({ balance: parseFloat(balance) }),
  addTransaction: (tx) => set((state) => ({ 
    transactions: [tx, ...state.transactions].slice(0, 50) 
  })),
  setAccount: (account) => set({ account }),
  setLoading: (loading) => set({ loading }),
  setTransactions: (transactions) => set({ transactions })
}));

export default useVaultStore;
