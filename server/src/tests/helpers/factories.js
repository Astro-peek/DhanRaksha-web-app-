import supabaseAdmin from './supabaseTestClient.js';

export const createTestUser = async (customFields = {}) => {
  const defaultId = crypto.randomUUID();
  const testPhone = Math.floor(6000000000 + Math.random() * 3999999999).toString();
  
  const user = {
    id: defaultId,
    mobile: testPhone,
    name: `Test User ${testPhone.slice(-4)}`,
    language: 'hi',
    upi_id: `testuser${testPhone.slice(-4)}@upi`,
    user_type: 'gig_worker',
    onboarding_completed: true,
    ...customFields
  };

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert(user)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTestVaultAccount = async (userId, customFields = {}) => {
  const vault = {
    user_id: userId,
    balance: 500.00,
    save_per_transaction: 20.00,
    daily_limit: 500.00,
    mandate_status: 'active',
    ...customFields
  };

  const { data, error } = await supabaseAdmin
    .from('vault_accounts')
    .insert(vault)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const createTestChitGroup = async (organiserId, customFields = {}) => {
  const group = {
    name: 'Test Gig Workers Saver',
    description: 'Weekly mutual fund chit',
    contribution_per_member: 1000.00,
    duration_months: 5,
    member_count: 5,
    organiser_commission_pct: 2.00,
    status: 'forming',
    invite_token: crypto.randomUUID(),
    organiser_id: organiserId,
    current_cycle: 1,
    ...customFields
  };

  const { data, error } = await supabaseAdmin
    .from('chit_groups')
    .insert(group)
    .select()
    .single();

  if (error) throw error;
  return data;
};
