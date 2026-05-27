-- ==========================================
-- SafeKosh Production Database Migrations
-- ==========================================

-- --- MIGRATION 001: ENABLE EXTENSIONS ---
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- --- MIGRATION 002: USERS TABLE ---
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile VARCHAR(10) UNIQUE,
  email VARCHAR(255),
  name VARCHAR(100),
  aadhaar_last4 VARCHAR(4),
  aadhaar_verified BOOLEAN DEFAULT false,
  kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending','initiated','completed','failed')),
  language VARCHAR(5) DEFAULT 'hi' CHECK (language IN ('hi','mr','te','ta','en')),
  user_type VARCHAR(30) DEFAULT 'gig_worker' CHECK (user_type IN ('gig_worker','chit_organiser','chit_member','mixed')),
  upi_id VARCHAR(100),
  fcm_token VARCHAR(255),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role full access to users" ON public.users
  USING (auth.role() = 'service_role');

-- Auto-create user record when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_mobile VARCHAR(10);
BEGIN
  -- Strip country code if present (e.g., +91 to get 10 digits)
  clean_mobile := CASE
    WHEN NEW.phone LIKE '+91%' THEN SUBSTRING(NEW.phone FROM 4 FOR 10)
    WHEN NEW.phone LIKE '91%' THEN SUBSTRING(NEW.phone FROM 3 FOR 10)
    ELSE NEW.phone
  END;
  
  -- Insert user record with either mobile or email
  INSERT INTO public.users (id, mobile, email)
  VALUES (NEW.id, clean_mobile, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- --- MIGRATION 003: VAULT TABLES ---
CREATE TABLE public.vault_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance DECIMAL(12,2) DEFAULT 0.00 CHECK (balance >= 0),
  save_per_transaction DECIMAL(8,2) DEFAULT 20.00 CHECK (save_per_transaction BETWEEN 10 AND 200),
  daily_limit DECIMAL(8,2) DEFAULT 500.00 CHECK (daily_limit BETWEEN 100 AND 2000),
  daily_saved_today DECIMAL(8,2) DEFAULT 0.00,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  razorpay_mandate_id VARCHAR(100),
  mandate_status VARCHAR(20) DEFAULT 'inactive' CHECK (mandate_status IN ('inactive','pending','active','cancelled','paused')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vault_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vault" ON public.vault_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own vault settings" ON public.vault_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to vault_accounts" ON public.vault_accounts
  USING (auth.role() = 'service_role');

CREATE OR REPLACE TRIGGER set_vault_accounts_updated_at
  BEFORE UPDATE ON public.vault_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vault_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('credit','debit')),
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('auto_upi','manual','withdrawal','interest')),
  upi_ref_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('pending','success','failed','reversed')),
  note VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vault_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vault transactions" ON public.vault_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to vault_transactions" ON public.vault_transactions
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_vault_transactions_user_id ON public.vault_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_transactions_created_at ON public.vault_transactions(created_at DESC);


-- --- MIGRATION 004: CHIT FUND TABLES ---
CREATE TABLE public.chit_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  organiser_id UUID NOT NULL REFERENCES public.users(id),
  member_count INT NOT NULL CHECK (member_count BETWEEN 5 AND 50),
  contribution_per_member DECIMAL(10,2) NOT NULL CHECK (contribution_per_member BETWEEN 500 AND 50000),
  duration_months INT NOT NULL,
  organiser_commission_pct DECIMAL(5,2) DEFAULT 5.00 CHECK (organiser_commission_pct BETWEEN 2 AND 8),
  current_cycle INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'forming' CHECK (status IN ('forming','active','completed','cancelled')),
  invite_token UUID UNIQUE DEFAULT uuid_generate_v4(),
  blockchain_contract_address VARCHAR(100),
  blockchain_network VARCHAR(20) DEFAULT 'polygon_mumbai',
  razorpay_plan_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS setup below will reference chit_members; created first to avoid circular schema dependencies
CREATE TABLE public.chit_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.chit_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cashfree_mandate_id VARCHAR(100),
  mandate_status VARCHAR(20) DEFAULT 'pending',
  has_won BOOLEAN DEFAULT false,
  won_cycle INT,
  total_contributed DECIMAL(12,2) DEFAULT 0,
  total_dividend_received DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited','joined','active','defaulted','exited')),
  joined_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.chit_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and organisers can view their groups" ON public.chit_groups
  FOR SELECT USING (
    auth.uid() = organiser_id OR
    auth.uid() IN (
      SELECT user_id FROM public.chit_members WHERE group_id = id AND status != 'invited'
    )
  );

CREATE POLICY "Organisers can update their groups" ON public.chit_groups
  FOR UPDATE USING (auth.uid() = organiser_id);

CREATE POLICY "Authenticated users can create groups" ON public.chit_groups
  FOR INSERT WITH CHECK (auth.uid() = organiser_id);

CREATE POLICY "Service role full access to chit_groups" ON public.chit_groups
  USING (auth.role() = 'service_role');

CREATE OR REPLACE TRIGGER set_chit_groups_updated_at
  BEFORE UPDATE ON public.chit_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.chit_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view membership in own groups" ON public.chit_members
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT organiser_id FROM public.chit_groups WHERE id = group_id)
  );

CREATE POLICY "Service role full access to chit_members" ON public.chit_members
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_chit_members_group_id ON public.chit_members(group_id);
CREATE INDEX IF NOT EXISTS idx_chit_members_user_id ON public.chit_members(user_id);

CREATE TABLE public.chit_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.chit_groups(id) ON DELETE CASCADE,
  cycle_number INT NOT NULL,
  pot_amount DECIMAL(12,2),
  collection_opens_at TIMESTAMPTZ,
  collection_closes_at TIMESTAMPTZ,
  auction_opens_at TIMESTAMPTZ,
  auction_closes_at TIMESTAMPTZ,
  winner_id UUID REFERENCES public.users(id),
  winning_bid DECIMAL(12,2),
  organiser_commission DECIMAL(10,2),
  dividend_per_member DECIMAL(10,2),
  blockchain_tx_hash VARCHAR(100),
  blockchain_block_number BIGINT,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming','collection','auction','settling','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, cycle_number)
);

ALTER TABLE public.chit_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members and organisers can view cycles" ON public.chit_cycles
  FOR SELECT USING (
    auth.uid() IN (
      SELECT organiser_id FROM public.chit_groups WHERE id = group_id
      UNION
      SELECT user_id FROM public.chit_members WHERE group_id = group_id AND status = 'active'
    )
  );

CREATE POLICY "Service role full access to chit_cycles" ON public.chit_cycles
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_chit_cycles_group_id ON public.chit_cycles(group_id);

CREATE TABLE public.chit_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES public.chit_cycles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.chit_groups(id),
  member_id UUID NOT NULL REFERENCES public.users(id),
  bid_amount DECIMAL(12,2) NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_winner BOOLEAN DEFAULT false,
  UNIQUE(cycle_id, member_id)
);

ALTER TABLE public.chit_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view bids in their groups" ON public.chit_bids
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.chit_members WHERE group_id = group_id AND status = 'active'
      UNION
      SELECT organiser_id FROM public.chit_groups WHERE id = group_id
    )
  );

CREATE POLICY "Members can insert own bid" ON public.chit_bids
  FOR INSERT WITH CHECK (auth.uid() = member_id);

CREATE POLICY "Service role full access to chit_bids" ON public.chit_bids
  USING (auth.role() = 'service_role');

CREATE TABLE public.chit_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES public.chit_cycles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.chit_groups(id),
  member_id UUID NOT NULL REFERENCES public.users(id),
  amount DECIMAL(10,2) NOT NULL,
  cashfree_order_id VARCHAR(100),
  cashfree_payment_id VARCHAR(100),
  upi_ref_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cycle_id, member_id)
);

ALTER TABLE public.chit_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view contributions in their groups" ON public.chit_contributions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.chit_members WHERE group_id = group_id AND status = 'active'
      UNION
      SELECT organiser_id FROM public.chit_groups WHERE id = group_id
    )
  );

CREATE POLICY "Service role full access to chit_contributions" ON public.chit_contributions
  USING (auth.role() = 'service_role');


-- --- MIGRATION 005: LENDING TABLES ---
CREATE TABLE public.lender_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lender_id VARCHAR(50) NOT NULL,
  lender_name VARCHAR(100),
  loan_amount DECIMAL(12,2),
  loan_purpose VARCHAR(50),
  utm_source VARCHAR(50) DEFAULT 'safekosh',
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  disbursed BOOLEAN DEFAULT false,
  disbursed_at TIMESTAMPTZ,
  disbursed_amount DECIMAL(12,2),
  commission_pct DECIMAL(5,2),
  commission_amount DECIMAL(10,2),
  webhook_received_at TIMESTAMPTZ
);

ALTER TABLE public.lender_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications" ON public.lender_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to lender_applications" ON public.lender_applications
  USING (auth.role() = 'service_role');


-- --- MIGRATION 006: INCOME CERTIFICATE TABLES ---
CREATE TABLE public.income_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cert_ref VARCHAR(30) UNIQUE NOT NULL,
  aa_consent_handle VARCHAR(100),
  aa_data_session_id VARCHAR(100),
  monthly_avg DECIMAL(10,2),
  highest_month_amount DECIMAL(10,2),
  lowest_month_amount DECIMAL(10,2),
  total_90_day DECIMAL(12,2),
  consistency_score INT CHECK (consistency_score BETWEEN 0 AND 100),
  gig_platforms TEXT[],
  unique_payers_count INT,
  pdf_storage_path VARCHAR(255),
  pdf_public_url TEXT,
  blockchain_hash VARCHAR(100),
  blockchain_tx_hash VARCHAR(100),
  blockchain_block_number BIGINT,
  blockchain_network VARCHAR(20) DEFAULT 'polygon_mumbai',
  valid_until DATE,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'generating' CHECK (status IN ('generating','processing','ready','failed','revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.income_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates" ON public.income_certificates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public can verify certificates by cert_ref" ON public.income_certificates
  FOR SELECT USING (true);

CREATE POLICY "Service role full access to income_certificates" ON public.income_certificates
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_income_certificates_user_id ON public.income_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_income_certificates_cert_ref ON public.income_certificates(cert_ref);


-- --- MIGRATION 007: NUDGE TABLES ---
CREATE TABLE public.nudge_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nudge_type VARCHAR(50),
  nudge_id VARCHAR(50),
  message_hi TEXT,
  message_en TEXT,
  cta_action VARCHAR(50),
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  seen_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  cta_clicked_at TIMESTAMPTZ
);

ALTER TABLE public.nudge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nudges" ON public.nudge_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to nudge_log" ON public.nudge_log
  USING (auth.role() = 'service_role');


-- --- MIGRATION 008: AUDIT LOG TABLE ---
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(50),
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only audit log" ON public.audit_log
  USING (auth.role() = 'service_role');


-- --- MIGRATION 009: SUPABASE STORAGE BUCKETS ---
-- Modern PostgreSQL CREATE POLICY on the storage.objects table
-- Make sure the "certificates" bucket is created in the Supabase Storage dashboard.
DROP POLICY IF EXISTS "Users can access own certificates" ON storage.objects;

CREATE POLICY "Users can access own certificates" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'certificates' AND
    (auth.uid()::text = (storage.foldername(name))[1])
  );



-- --- MIGRATION 010: REALTIME SUBSCRIPTIONS ---
-- Enables standard realtime synchronization for active collaborative screens
ALTER PUBLICATION supabase_realtime ADD TABLE public.chit_contributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chit_bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chit_cycles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_transactions;
