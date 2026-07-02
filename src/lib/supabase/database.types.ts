export type DbRole = "Owner" | "Member" | "Viewer";
export type DbThemePreference = "light" | "dark" | "system";
export type DbRecurringFrequency = "weekly" | "monthly" | "yearly";

export interface DbProfile {
  id: string;
  email: string;
  display_name: string;
  role: DbRole;
  currency: string;
  theme_preference: DbThemePreference;
  recurring_reminders_enabled: boolean;
  partner_alerts_enabled: boolean;
  created_at: string;
}

export interface DbCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  monthly_budget: number | null;
  archived: boolean;
  created_at: string;
}

export interface DbExpense {
  id: string;
  user_id: string;
  amount: number;
  merchant: string;
  category_id: string;
  date: string;
  payment_method: string | null;
  notes: string | null;
  receipt_id: string | null;
  recurring_id: string | null;
  recurring_period: string | null;
  excluded_from_totals: boolean;
  reimbursement_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbReceipt {
  id: string;
  user_id: string;
  data_url: string;
  created_at: string;
}

export interface DbRecurring {
  id: string;
  user_id: string;
  amount: number;
  merchant: string;
  category_id: string;
  frequency: DbRecurringFrequency;
  next_due: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface DbIncomeEntry {
  id: string;
  user_id: string;
  amount: number;
  month: string;
  label: string | null;
  created_at: string;
}

export interface DbReimbursementRequest {
  id: string;
  expense_id: string;
  requester_id: string;
  payer_email: string;
  payer_name: string;
  requester_name: string;
  amount: number;
  merchant: string;
  status: "pending" | "awaiting_confirmation" | "completed";
  created_at: string;
  completed_at: string | null;
  payer_expense_id: string | null;
}
