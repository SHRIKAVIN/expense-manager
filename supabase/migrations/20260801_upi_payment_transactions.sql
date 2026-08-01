-- Direct UPI payment ledger (server-verified; do not trust client status alone).

create table if not exists public.upi_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  -- Merchant transaction reference embedded in UPI `tr=` — opaque to the PWA beyond launch.
  transaction_id text not null unique,
  -- Maps to reimbursement_requests.id in this app (named expenseId on the API for clarity).
  expense_id uuid not null references public.reimbursement_requests (id) on delete cascade,
  -- When paying multiple reimbursements in one UPI intent.
  related_expense_ids uuid[] not null default '{}',
  payer_id uuid not null references public.profiles (id) on delete cascade,
  payee_vpa text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR',
  preferred_app text,
  note text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'FAILED', 'EXPIRED')),
  bank_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists upi_pay_tx_payer_idx
  on public.upi_payment_transactions (payer_id, created_at desc);
create index if not exists upi_pay_tx_expense_idx
  on public.upi_payment_transactions (expense_id);
create index if not exists upi_pay_tx_status_idx
  on public.upi_payment_transactions (status)
  where status = 'PENDING';

alter table public.upi_payment_transactions enable row level security;

-- Payers may read their own tracker rows (status polling). Never expose bank secrets here.
create policy "upi_pay_tx_select_payer"
  on public.upi_payment_transactions for select
  using (auth.uid() = payer_id);

-- Inserts/updates go through service role (Edge Functions / Express). No client INSERT.
-- (No insert/update policies for authenticated → default deny.)

notify pgrst, 'reload schema';
