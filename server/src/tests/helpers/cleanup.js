import supabaseAdmin from './supabaseTestClient.js';

export const cleanupTestData = async (userIds = [], groupIds = []) => {
  if (userIds.length > 0) {
    // Delete related child tables first to avoid foreign key violations
    await supabaseAdmin.from('vault_transactions').delete().in('user_id', userIds);
    await supabaseAdmin.from('vault_accounts').delete().in('user_id', userIds);
    await supabaseAdmin.from('chit_members').delete().in('user_id', userIds);
    await supabaseAdmin.from('chit_contributions').delete().in('member_id', userIds);
    await supabaseAdmin.from('chit_bids').delete().in('member_id', userIds);
    await supabaseAdmin.from('income_certificates').delete().in('user_id', userIds);
    await supabaseAdmin.from('audit_log').delete().in('user_id', userIds);
    
    // Now delete from core users
    await supabaseAdmin.from('users').delete().in('id', userIds);
    
    // Delete in Supabase Auth as well
    for (const id of userIds) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(id);
      } catch (err) {
        // Safe to ignore if auth user doesn't exist
      }
    }
  }

  if (groupIds.length > 0) {
    await supabaseAdmin.from('chit_contributions').delete().in('group_id', groupIds);
    await supabaseAdmin.from('chit_bids').delete().in('group_id', groupIds);
    await supabaseAdmin.from('chit_cycles').delete().in('group_id', groupIds);
    await supabaseAdmin.from('chit_members').delete().in('group_id', groupIds);
    await supabaseAdmin.from('chit_groups').delete().in('id', groupIds);
  }
};
