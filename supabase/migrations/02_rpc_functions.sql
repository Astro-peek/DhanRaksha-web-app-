-- ============================================================================
-- SafeKosh Database Migrations: Atomic Functions & RPC APIs
-- ============================================================================

-- --- FUNCTION 1: process_vault_credit ---
-- Atomically credits vault balance and logs transaction, avoiding auto-save race conditions.
CREATE OR REPLACE FUNCTION public.process_vault_credit(
  p_user_id UUID,
  p_amount DECIMAL,
  p_trigger_type VARCHAR,
  p_upi_ref_id VARCHAR DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Lock the vault account row for this user
  PERFORM id FROM public.vault_accounts WHERE user_id = p_user_id FOR UPDATE;

  -- Insert transaction
  INSERT INTO public.vault_transactions (user_id, amount, direction, trigger_type, upi_ref_id, status)
  VALUES (p_user_id, p_amount, 'credit', p_trigger_type, p_upi_ref_id, 'success')
  RETURNING id INTO v_transaction_id;

  -- Update balance and daily saved
  UPDATE public.vault_accounts
  SET 
    balance = balance + p_amount,
    daily_saved_today = daily_saved_today + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN json_build_object(
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'amount_credited', p_amount
  );
END;
$$;

-- --- FUNCTION 2: process_vault_debit ---
-- Atomically debits vault balance. Prevents overdraft and enforces ₹100 minimum.
CREATE OR REPLACE FUNCTION public.process_vault_debit(
  p_user_id UUID,
  p_amount DECIMAL,
  p_destination_upi VARCHAR
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
  v_transaction_id UUID;
BEGIN
  -- Lock and check balance
  SELECT balance INTO v_current_balance
  FROM public.vault_accounts
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Balance % is less than requested %', v_current_balance, p_amount;
  END IF;

  IF p_amount < 100 THEN
    RAISE EXCEPTION 'MINIMUM_WITHDRAWAL: Minimum withdrawal is ₹100';
  END IF;

  -- Insert transaction
  INSERT INTO public.vault_transactions (user_id, amount, direction, trigger_type, status, note)
  VALUES (p_user_id, p_amount, 'debit', 'withdrawal', 'pending', 'To: ' || p_destination_upi)
  RETURNING id INTO v_transaction_id;

  -- Update balance
  UPDATE public.vault_accounts
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN json_build_object(
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'amount_debited', p_amount
  );
END;
$$;

-- --- FUNCTION 3: reverse_vault_debit ---
-- Reverses a failed withdrawal and changes the transaction state.
CREATE OR REPLACE FUNCTION public.reverse_vault_debit(
  p_transaction_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction public.vault_transactions%ROWTYPE;
  v_new_balance DECIMAL;
END;
$$;

-- Wait! Let's write the complete body of reverse_vault_debit as specified:
CREATE OR REPLACE FUNCTION public.reverse_vault_debit(
  p_transaction_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction public.vault_transactions%ROWTYPE;
  v_new_balance DECIMAL;
BEGIN
  -- Get the original transaction
  SELECT * INTO v_transaction FROM public.vault_transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_transaction.status != 'pending' THEN
    RAISE EXCEPTION 'CANNOT_REVERSE: Transaction status is %', v_transaction.status;
  END IF;

  -- Update original transaction to failed
  UPDATE public.vault_transactions SET status = 'failed' WHERE id = p_transaction_id;

  -- Create reversal transaction
  INSERT INTO public.vault_transactions (user_id, amount, direction, trigger_type, status, note)
  VALUES (v_transaction.user_id, v_transaction.amount, 'credit', 'withdrawal', 'success', 'Reversal of failed withdrawal');

  -- Restore balance
  UPDATE public.vault_accounts
  SET balance = balance + v_transaction.amount, updated_at = NOW()
  WHERE user_id = v_transaction.user_id
  RETURNING balance INTO v_new_balance;

  RETURN json_build_object('reversed', true, 'new_balance', v_new_balance);
END;
$$;

-- --- FUNCTION 4: get_fully_collected_cycles ---
-- Returns chit cycles where all members have paid but status is still 'collection'.
CREATE OR REPLACE FUNCTION public.get_fully_collected_cycles()
RETURNS TABLE(id UUID, group_id UUID, cycle_number INT, pot_amount DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT cc.id, cc.group_id, cc.cycle_number, cc.pot_amount
  FROM public.chit_cycles cc
  JOIN public.chit_groups cg ON cc.group_id = cg.id
  WHERE cc.status = 'collection'
  AND (
    SELECT COUNT(*) FROM public.chit_contributions
    WHERE cycle_id = cc.id AND status = 'paid'
  ) >= cg.member_count;
END;
$$;

-- --- FUNCTION 5: get_user_dashboard_summary ---
-- Single RPC call that returns everything needed for dashboard.
CREATE OR REPLACE FUNCTION public.get_user_dashboard_summary(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vault JSON;
  v_chit_count INT;
  v_cert JSON;
  v_recent_txns JSON;
BEGIN
  -- Vault balance
  SELECT json_build_object('balance', balance, 'save_per_transaction', save_per_transaction, 'daily_limit', daily_limit, 'mandate_status', mandate_status)
  INTO v_vault
  FROM public.vault_accounts WHERE user_id = p_user_id;

  -- Active chit count
  SELECT COUNT(*) INTO v_chit_count
  FROM public.chit_members
  WHERE user_id = p_user_id AND status = 'active';

  -- Latest certificate
  SELECT json_build_object('consistency_score', consistency_score, 'status', status, 'cert_ref', cert_ref, 'valid_until', valid_until)
  INTO v_cert
  FROM public.income_certificates
  WHERE user_id = p_user_id AND status = 'ready' AND revoked = false
  ORDER BY created_at DESC LIMIT 1;

  -- Recent 5 transactions
  SELECT json_agg(t) INTO v_recent_txns FROM (
    SELECT id, amount, direction, trigger_type, status, created_at
    FROM public.vault_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC LIMIT 5
  ) t;

  RETURN json_build_object(
    'vault', v_vault,
    'active_chit_count', v_chit_count,
    'latest_certificate', v_cert,
    'recent_transactions', v_recent_txns
  );
END;
$$;

-- --- FUNCTION 6: get_chit_group_ledger ---
-- Full transparent ledger for a chit group.
CREATE OR REPLACE FUNCTION public.get_chit_group_ledger(p_group_id UUID, p_requesting_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_member BOOLEAN;
  v_contributions JSON;
  v_cycles JSON;
  v_summary JSON;
BEGIN
  -- Verify access
  SELECT EXISTS(
    SELECT 1 FROM public.chit_members WHERE group_id = p_group_id AND user_id = p_requesting_user_id AND status = 'active'
    UNION
    SELECT 1 FROM public.chit_groups WHERE id = p_group_id AND organiser_id = p_requesting_user_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'ACCESS_DENIED: Not a member of this group';
  END IF;

  -- All contributions with member names
  SELECT json_agg(c ORDER BY c.paid_at DESC) INTO v_contributions FROM (
    SELECT 
      cc.id, cc.cycle_id, cc.amount, cc.status, cc.paid_at, cc.upi_ref_id,
      u.name AS member_name,
      cyc.cycle_number
    FROM public.chit_contributions cc
    JOIN public.users u ON cc.member_id = u.id
    JOIN public.chit_cycles cyc ON cc.cycle_id = cyc.id
    WHERE cc.group_id = p_group_id
  ) c;

  -- Completed cycles with winner names
  SELECT json_agg(cy ORDER BY cy.cycle_number) INTO v_cycles FROM (
    SELECT 
      cyc.id, cyc.cycle_number, cyc.pot_amount, cyc.winning_bid,
      cyc.organiser_commission, cyc.dividend_per_member, cyc.blockchain_tx_hash,
      cyc.status, cyc.auction_closes_at,
      u.name AS winner_name
    FROM public.chit_cycles cyc
    LEFT JOIN public.users u ON cyc.winner_id = u.id
    WHERE cyc.group_id = p_group_id
    ORDER BY cyc.cycle_number
  ) cy;

  -- Summary totals
  SELECT json_build_object(
    'total_collected', SUM(amount) FILTER (WHERE status = 'paid'),
    'total_paid_out', SUM(winning_bid),
    'total_commission', SUM(organiser_commission)
  ) INTO v_summary
  FROM public.chit_contributions cc
  FULL OUTER JOIN public.chit_cycles cyc ON cyc.group_id = p_group_id
  WHERE cc.group_id = p_group_id;

  RETURN json_build_object(
    'contributions', COALESCE(v_contributions, '[]'::JSON),
    'cycles', COALESCE(v_cycles, '[]'::JSON),
    'summary', v_summary
  );
END;
$$;

-- --- GRANTS ---
GRANT EXECUTE ON FUNCTION public.process_vault_credit TO service_role;
GRANT EXECUTE ON FUNCTION public.process_vault_debit TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_vault_debit TO service_role;
GRANT EXECUTE ON FUNCTION public.get_fully_collected_cycles TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_dashboard_summary TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_chit_group_ledger TO authenticated, service_role;
