import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import useVaultStore from '../store/vaultStore';
import useChitStore from '../store/chitStore';
import api from '../lib/api';

/**
 * Real-time subscription hook for User's Vault Account
 */
export const useVaultRealtime = (userId) => {
  const { setBalance, addTransaction } = useVaultStore();

  useEffect(() => {
    if (!userId) return;

    // Fetch the absolute source of truth for the balance from backend
    const refreshVaultBalance = async () => {
      try {
        const res = await api.get(`/api/vault/account?userId=${userId}`);
        if (res.data?.balance !== undefined) {
          setBalance(res.data.balance);
        }
      } catch (err) {
        console.error('Error fetching vault balance on real-time update:', err);
      }
    };

    console.log(`Subscribing to vault transactions for user: ${userId}`);

    const channel = supabase
      .channel(`vault_transactions_user_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vault_transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Realtime Vault Transaction received:', payload);
          const newTx = payload.new;
          addTransaction(newTx);

          const amount = parseFloat(newTx.amount);
          
          if (newTx.direction === 'credit') {
            toast.success(`₹${amount} credited successfully!`, {
              icon: '💰',
              style: { border: '2px solid #10B981', color: '#064E3B' }
            });
          } else if (newTx.direction === 'debit') {
            toast.error(`₹${amount} debited from vault!`, {
              icon: '💸',
              style: { border: '2px solid #EF4444', color: '#7F1D1D' }
            });
          }

          // Trigger balance refresh to ensure alignment
          refreshVaultBalance();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to vault transactions channel.');
        } else if (status === 'CLOSED') {
          console.warn('Vault transactions subscription closed.');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Vault transactions channel connection error.');
        }
      });

    return () => {
      console.log(`Unsubscribing from vault transactions for user: ${userId}`);
      supabase.removeChannel(channel);
    };
  }, [userId, setBalance, addTransaction]);
};

/**
 * Real-time subscription hook for Chit Groups (Auctions, Bids, Contributions)
 */
export const useChitRealtime = (groupId, { onBid, onContribution, onCycleStatusChange } = {}) => {
  const { addBid, updateContribution } = useChitStore();

  useEffect(() => {
    if (!groupId) return;

    console.log(`Subscribing to chit group updates for group: ${groupId}`);

    const channel = supabase
      .channel(`chit_group_${groupId}`)
      // 1. Listen to Contributions
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chit_contributions',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          console.log('Realtime Chit Contribution update:', payload);
          const contribution = payload.new;
          updateContribution(contribution.id, contribution);

          if (onContribution) {
            onContribution(payload);
          }

          if (payload.eventType === 'UPDATE' && contribution.status === 'paid') {
            toast.success('Member payment verified in real-time!', { icon: '✅' });
          }
        }
      )
      // 2. Listen to Live Bidding Feed
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chit_bids',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          console.log('Realtime Chit Bid received:', payload);
          const newBid = payload.new;
          addBid(newBid);

          if (onBid) {
            onBid(newBid);
          }

          toast(`Naya Bid: Member ne ₹${parseFloat(newBid.bid_amount).toLocaleString('en-IN')} bid kiya!`, {
            icon: '🔨',
            duration: 4000
          });
        }
      )
      // 3. Listen to Cycle transitions (Auction starts, closures, payouts)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chit_cycles',
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          console.log('Realtime Chit Cycle update:', payload);
          const updatedCycle = payload.new;
          toast.success(`Cycle ${updatedCycle.cycle_number} status updated to: ${updatedCycle.status.toUpperCase()}`, {
            icon: '🔄'
          });
          if (onCycleStatusChange) {
            onCycleStatusChange(updatedCycle);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to chit group channel.');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Chit group channel connection error.');
        }
      });

    return () => {
      console.log(`Unsubscribing from chit group channel for group: ${groupId}`);
      supabase.removeChannel(channel);
    };
  }, [groupId, addBid, updateContribution, onBid, onContribution, onCycleStatusChange]);
};
