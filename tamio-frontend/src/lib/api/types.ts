// ============================================================================
// API Response Types for Tamio Backend
// ============================================================================

// Base Types
export type Currency = 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD';
export type ClientType = 'retainer' | 'project' | 'usage' | 'mixed';
export type ClientStatus = 'active' | 'paused' | 'deleted';
export type PaymentBehavior = 'on_time' | 'delayed' | 'unknown';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Priority = 'high' | 'medium' | 'low' | 'essential' | 'important' | 'discretionary';
export type ExpenseCategory = 'payroll' | 'rent' | 'contractors' | 'software' | 'marketing' | 'other';
export type BucketType = 'fixed' | 'variable';
export type Frequency = 'one_time' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'annually';
export type Direction = 'in' | 'out';
export type Confidence = 'high' | 'medium' | 'low';

// Auth Types
export interface User {
  id: string;
  email: string;
  base_currency: Currency;
  has_completed_onboarding: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

// Cash Account Types
export interface CashAccount {
  id: string;
  user_id: string;
  account_name: string;
  balance: string;
  currency: Currency;
  as_of_date: string;
  created_at: string;
  updated_at: string | null;
}

export interface CashPositionResponse {
  accounts: CashAccount[];
  total_starting_cash: string;
}

export interface CashAccountInput {
  account_name: string;
  balance: string;
  currency: Currency;
  as_of_date: string;
}

// Client Types
export interface BillingConfig {
  amount?: string;
  frequency?: Frequency;
  day_of_month?: number;
  payment_terms?: string;
  milestones?: Array<{
    name: string;
    amount: string;
    expected_date: string;
    trigger_type: 'date_based' | 'delivery_based';
  }>;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  client_type: ClientType;
  currency: Currency;
  status: ClientStatus;
  payment_behavior: PaymentBehavior;
  churn_risk: RiskLevel;
  scope_risk: RiskLevel;
  billing_config: BillingConfig;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ClientCreate {
  user_id: string;
  name: string;
  client_type: ClientType;
  currency: Currency;
  status: ClientStatus;
  payment_behavior?: PaymentBehavior;
  churn_risk?: RiskLevel;
  scope_risk?: RiskLevel;
  billing_config: BillingConfig;
  notes?: string;
}

export interface ClientWithEventsResponse {
  client: Client;
  generated_events: CashEvent[];
}

// Expense Bucket Types
export interface ExpenseBucket {
  id: string;
  user_id: string;
  name: string;
  category: ExpenseCategory;
  bucket_type: BucketType;
  monthly_amount: string;
  currency: Currency;
  priority: Priority;
  is_stable: boolean;
  due_day: number;
  frequency: Frequency;
  employee_count: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ExpenseBucketCreate {
  user_id: string;
  name: string;
  category: ExpenseCategory;
  bucket_type: BucketType;
  monthly_amount: string;
  currency: Currency;
  priority: Priority;
  is_stable?: boolean;
  due_day?: number;
  frequency?: Frequency;
  employee_count?: number;
  notes?: string;
}

export interface ExpenseBucketWithEventsResponse {
  bucket: ExpenseBucket;
  generated_events: CashEvent[];
}

// Cash Event Types
export interface CashEvent {
  id: string;
  user_id: string;
  date: string;
  week_number: number;
  amount: string;
  direction: Direction;
  event_type: string;
  category: string;
  client_id: string | null;
  bucket_id: string | null;
  confidence: Confidence;
  confidence_reason: string | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

// Forecast Types
export interface ForecastWeek {
  week_number: number;
  week_start: string;
  week_end: string;
  starting_balance: string;
  cash_in: string;
  cash_out: string;
  net_change: string;
  ending_balance: string;
  events: CashEvent[];
}

export interface ForecastSummary {
  lowest_cash_week: number;
  lowest_cash_amount: string;
  total_cash_in: string;
  total_cash_out: string;
  runway_weeks: number;
}

export interface ForecastResponse {
  starting_cash: string;
  forecast_start_date: string;
  weeks: ForecastWeek[];
  summary: ForecastSummary;
}

// Scenario Types
export type ScenarioType =
  | 'client_loss'
  | 'client_gain'
  | 'client_change'
  | 'hiring'
  | 'firing'
  | 'contractor_gain'
  | 'contractor_loss'
  | 'increased_expense'
  | 'decreased_expense'
  | 'payment_delay_in'
  | 'payment_delay_out';

export type ScenarioStatus = 'draft' | 'active' | 'saved' | 'discarded' | 'confirmed';
export type EntryPath = 'user_defined' | 'tamio_suggested';

export interface Scenario {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  scenario_type: ScenarioType;
  entry_path: EntryPath;
  suggested_reason: string | null;
  scope_config: Record<string, unknown>;
  parameters: Record<string, unknown>;
  status: ScenarioStatus;
  parent_scenario_id: string | null;
  layer_order: number;
  created_at: string;
  updated_at: string | null;
}

export interface ScenarioCreate {
  user_id: string;
  name: string;
  description?: string;
  scenario_type: ScenarioType;
  entry_path: EntryPath;
  suggested_reason?: string;
  scope_config: Record<string, unknown>;
  parameters: Record<string, unknown>;
  parent_scenario_id?: string;
  layer_order?: number;
}

export interface ScenarioComparisonResponse {
  base_forecast: ForecastResponse;
  scenario_forecast: ForecastResponse;
  deltas: Record<string, unknown>;
  rule_evaluations: RuleEvaluation[];
  decision_signals: Record<string, unknown>;
  suggested_scenarios: ScenarioSuggestion[];
}

export interface RuleEvaluation {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  breach_week: number | null;
  details: string;
}

export interface ScenarioSuggestion {
  scenario_type: ScenarioType;
  name: string;
  description: string;
  prefill_params: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
}

// Financial Rules
export interface FinancialRule {
  id: string;
  user_id: string;
  rule_type: string;
  name: string;
  description: string | null;
  threshold_config: Record<string, unknown>;
  is_active: boolean;
  evaluation_scope: string;
  created_at: string;
  updated_at: string | null;
}

// TAMI Chat Types
export type ChatMode =
  | 'explain_forecast'
  | 'suggest_scenarios'
  | 'build_scenario'
  | 'goal_planning'
  | 'clarify';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface SuggestedAction {
  label: string;
  action: 'call_tool' | 'none';
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
}

export interface UIHints {
  show_scenario_banner: boolean;
  suggested_actions: SuggestedAction[];
}

export interface ChatResponseContent {
  message_markdown: string;
  mode: ChatMode;
  ui_hints: UIHints;
}

export interface ChatResponse {
  response: ChatResponseContent;
  context_summary: Record<string, unknown>;
  tool_calls_made: string[];
}

export interface ChatRequest {
  user_id: string;
  message: string;
  conversation_history: ChatMessage[];
  active_scenario_id: string | null;
}

// Xero Integration Types
export interface XeroConnectionStatus {
  is_connected: boolean;
  tenant_name: string | null;
  tenant_id: string | null;
  last_sync_at: string | null;
  token_expires_at: string | null;
  sync_error: string | null;
}

export interface XeroAuthUrl {
  auth_url: string;
  state: string;
}

export interface XeroSyncResult {
  success: boolean;
  sync_type: string;
  records_fetched: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  started_at: string;
  completed_at: string;
}

// Onboarding Types
export interface OnboardingRequest {
  user: {
    email: string;
    base_currency: Currency;
  };
  cash_position: CashAccountInput[];
  clients: Omit<ClientCreate, 'user_id'>[];
  expenses: Omit<ExpenseBucketCreate, 'user_id'>[];
}

export interface OnboardingResponse {
  user_id: string;
  accounts_created: number;
  clients_created: number;
  expenses_created: number;
  events_generated: number;
}

// Obligation Types (3-Layer System)
export type ObligationType =
  | 'vendor_bill'
  | 'subscription'
  | 'payroll'
  | 'contractor'
  | 'loan_payment'
  | 'tax_obligation'
  | 'lease'
  | 'other';

export type AmountType = 'fixed' | 'variable' | 'milestone';
export type AmountSource = 'manual_entry' | 'xero_sync' | 'repeating_invoice' | 'contract_upload';
export type ScheduleStatus = 'scheduled' | 'due' | 'paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'reversed';
export type PaymentSource = 'manual_entry' | 'xero_sync' | 'bank_feed' | 'csv_import';

export interface ObligationAgreement {
  id: string;
  user_id: string;
  obligation_type: ObligationType;
  amount_type: AmountType;
  amount_source: AmountSource;
  base_amount: string;
  variability_rule: string | null;
  currency: Currency;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  category: ExpenseCategory;
  account_id: string | null;
  confidence: Confidence;
  vendor_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ObligationSchedule {
  id: string;
  obligation_id: string;
  due_date: string;
  period_start: string | null;
  period_end: string | null;
  estimated_amount: string;
  estimate_source: string;
  confidence: Confidence;
  status: ScheduleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PaymentEvent {
  id: string;
  user_id: string;
  obligation_id: string | null;
  schedule_id: string | null;
  amount: string;
  currency: Currency;
  payment_date: string;
  account_id: string | null;
  status: PaymentStatus;
  source: PaymentSource;
  is_reconciled: boolean;
  reconciled_at: string | null;
  vendor_name: string | null;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

// API Error
export interface ApiError {
  detail: string;
  status?: number;
}
