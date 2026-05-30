-- ==========================================
-- MIGRATION: LENDERS TABLE
-- ==========================================

CREATE TABLE public.lenders (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('NBFC','MFI','P2P','SHG')),
  logo_initials VARCHAR(10),
  logo_color VARCHAR(20),
  min_loan DECIMAL(12,2) NOT NULL,
  max_loan DECIMAL(12,2) NOT NULL,
  interest_rate_annual DECIMAL(5,2) NOT NULL,
  max_tenure_months INT NOT NULL,
  processing_fee_pct DECIMAL(5,2) DEFAULT 0,
  processing_fee_flat DECIMAL(10,2) DEFAULT 0,
  documents TEXT[],
  accepts_gig_cert BOOLEAN DEFAULT false,
  apply_url TEXT,
  commission_pct DECIMAL(5,2) DEFAULT 0,
  description_hi TEXT,
  description_en TEXT,
  rbi_registration VARCHAR(50),
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view approved lenders" ON public.lenders
  FOR SELECT USING (approved = true);

CREATE POLICY "Service role full access to lenders" ON public.lenders
  USING (auth.role() = 'service_role');

CREATE OR REPLACE TRIGGER set_lenders_updated_at
  BEFORE UPDATE ON public.lenders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed initial lenders
INSERT INTO public.lenders (id, name, type, logo_initials, logo_color, min_loan, max_loan, interest_rate_annual, max_tenure_months, processing_fee_pct, processing_fee_flat, documents, accepts_gig_cert, apply_url, commission_pct, description_hi, description_en, rbi_registration, approved) VALUES
  ('navi', 'Navi', 'NBFC', 'NV', '0D9488', 10000, 2000000, 9.9, 84, 0, 0, ARRAY['Aadhaar', 'PAN'], false, 'https://navi.com', 1.5, 'Zero processing fee. Sabse low interest rate.', 'Zero processing fee. Lowest interest rate.', 'N-14.03268', true),
  ('moneyview', 'MoneyView', 'NBFC', 'MV', '6366F1', 5000, 500000, 16.0, 60, 2.0, 0, ARRAY['Aadhaar', 'PAN', 'Bank Statement'], true, 'https://moneyview.in', 2.0, 'Gig income certificate accept karte hain.', 'Accepts SafeKosh gig income certificate.', 'B-14.01094', true),
  ('kreditbee', 'KreditBee', 'NBFC', 'KB', 'F59E0B', 1000, 200000, 17.0, 24, 2.0, 0, ARRAY['Aadhaar', 'PAN'], true, 'https://kreditbee.in', 1.8, 'Sirf Aadhaar aur PAN chahiye. Turant approval.', 'Just Aadhaar and PAN. Instant approval.', 'N-13.02358', true),
  ('stashfin', 'StashFin', 'NBFC', 'SF', '8B5CF6', 1000, 500000, 19.99, 36, 3.0, 0, ARRAY['Aadhaar', 'PAN'], false, 'https://stashfin.com', 2.0, 'Flexible tenure. Quick disbursal.', 'Flexible tenure. Quick disbursal.', 'B-14.01045', true),
  ('ayefinance', 'Aye Finance', 'MFI', 'AF', '10B981', 1000, 200000, 29.0, 18, 1.0, 0, ARRAY['Aadhaar'], true, 'https://ayefin.com', 2.5, 'Sirf Aadhaar. Rural aur semi-urban ke liye.', 'Aadhaar only. For rural and semi-urban borrowers.', 'N-14.03126', true),
  ('faircent', 'Faircent', 'P2P', 'FC', 'F97316', 30000, 1000000, 12.0, 36, 1.5, 0, ARRAY['Aadhaar', 'PAN', 'ITR'], true, 'https://faircent.com', 1.5, 'P2P lending. Peer se loan, bank se nahi.', 'P2P lending. Borrow from peers, not banks.', 'N-14.03017', true),
  ('shg_network', 'SHG Credit Network', 'SHG', 'SH', 'EC4899', 1000, 50000, 12.0, 12, 0, 0, ARRAY['Aadhaar', 'SHG membership'], true, '#', 0, 'Self-Help Group network. Women ke liye.', 'Self-Help Group network. Designed for women borrowers.', 'NABARD-SHG', true);
