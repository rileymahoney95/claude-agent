// TypeScript interfaces for the Finance Dashboard
// Aligned with finance/api backend responses

export interface Portfolio {
  success: boolean;
  as_of: string;
  total_value: number;
  by_category: Record<string, CategoryData>;
  by_asset: Asset[];
  data_freshness: DataFreshness;
  warnings: string[];
}

export interface CategoryData {
  value: number;
  pct: number;
  assets: string[];
}

export interface Asset {
  name: string;
  category: string;
  value: number;
  source: string;
  as_of: string;
  details?: Record<string, unknown>;
}

export interface DataFreshness {
  sofi_snapshots: string | null;
  holdings: string | null;
  crypto_prices: 'live' | 'unavailable' | 'skipped';
}

export interface CryptoHolding {
  symbol: string;
  quantity: number;
  price: number | null;
  value: number | null;
  notes?: string | null;
}

export interface AccountHolding {
  key: string;
  name: string;
  balance: number;
}

export interface HoldingsResponse {
  success: boolean;
  crypto: CryptoHolding[];
  bank_accounts: AccountHolding[];
  other: AccountHolding[];
  total_value: number;
  last_updated: string | null;
}

export interface HoldingsFreshnessResponse {
  success: boolean;
  is_stale: boolean;
  days_since_update: number | null;
  last_updated: string | null;
  message: string;
}

export interface HoldingUpdateResponse {
  success: boolean;
  error?: string;
}

export interface Profile {
  monthly_cash_flow: CashFlow;
  household_context: HouseholdContext;
  tax_situation: TaxSituation;
  goals: Goals;
  last_updated: string;
}

export interface ProfileResponse {
  success: boolean;
  monthly_cash_flow: CashFlow;
  household_context: HouseholdContext;
  tax_situation: TaxSituation;
  goals: Goals;
  last_updated: string;
}

export interface ProfileUpdateResponse {
  success: boolean;
  profile?: Profile;
}

export interface ProfileSectionUpdateResponse {
  success: boolean;
  section: string;
  data: Record<string, unknown>;
}

export interface CashFlow {
  gross_income: number;
  shared_expenses: number;
  crypto_contributions: number;
  roth_contributions: number;
  hsa_contributions: number;
  discretionary: number;
}

export interface HouseholdContext {
  wife_income: number;
  wife_assets: number;
  mortgage_payment: number;
  mortgage_rate: number;
  mortgage_balance: number;
  home_value: number;
}

export interface TaxSituation {
  filing_status: string;
  federal_bracket: number;
  state_tax: number;
  roth_maxed: boolean;
  has_401k: boolean;
  hsa_eligible: boolean;
}

export interface Goal {
  description: string;
  target: number | null;
  deadline: string | null;
}

export interface Goals {
  short_term: Goal;
  medium_term: Goal;
  long_term: Goal;
}

export interface Recommendation {
  type: 'rebalance' | 'surplus' | 'opportunity' | 'warning';
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
  impact: string;
  numbers: Record<string, unknown>;
}

export interface PortfolioSummary {
  total_value: number;
  monthly_surplus: number;
  by_category: Record<string, CategoryData>;
}

export interface GoalDetail {
  type: string;
  description: string;
  target: number | null;
  deadline: string | null;
  current: number;
  current_value?: number; // alias for backward compatibility
  progress_pct: number | null;
  status: 'on_track' | 'off_track' | 'no_target' | 'behind' | 'not_set' | 'past_deadline';
  on_track: boolean | null;
  monthly_required: number | null;
  current_monthly: number | null;
  months_remaining: number | null;
}

export interface AdviceSummary {
  high_priority_count: number;
  total_count: number;
  action_required: boolean;
}

export interface GoalStatus {
  on_track: number;
  behind: number;
  most_urgent: string | null;
}

export interface Advice {
  success: boolean;
  recommendations: Recommendation[];
  portfolio_summary: PortfolioSummary;
  goal_details: GoalDetail[];
  data_freshness: DataFreshness;
  summary: AdviceSummary;
  goal_status: GoalStatus;
}

export interface Snapshot {
  date: string;
  account: string;
  total_value: number;
  delta: number | null;
  filename: string;
}

export interface StatementsHistory {
  success: boolean;
  snapshots: Snapshot[];
  count: number;
}

export interface PullStatementsResponse {
  success: boolean;
  count: number;
  files?: string[];
  error?: string;
}

export interface UploadStatementResponse {
  success: boolean;
  filename?: string;
  account?: string;
  date?: string;
  total_value?: number;
  snapshot_path?: string;
  template_updated?: boolean;
  error?: string;
}

// =============================================================================
// PROJECTION API TYPES (snake_case from API)
// =============================================================================

export interface ProjectionHistoryDataPoint {
  date: string;
  total_value: number;
  by_asset_class: Record<string, number>;
}

export interface ProjectionHistoryResponse {
  success: boolean;
  data_points: ProjectionHistoryDataPoint[];
  range: {
    start: string | null;
    end: string | null;
    months_requested: number;
    months_available: number;
  };
}

export interface ProjectionSettingsAPI {
  expected_returns: Record<string, number>;
  inflation_rate: number;
  withdrawal_rate: number;
  target_retirement_age: number;
  current_age: number;
}

export interface ProjectionSettingsResponse {
  success: boolean;
  settings: ProjectionSettingsAPI;
}

export interface ScenarioSettingsAPI {
  allocation_overrides?: Record<string, number> | null;
  return_overrides?: Record<string, number> | null;
  monthly_contribution?: number | null;
  projection_months?: number | null;
}

export interface ProjectionScenarioAPI {
  id: number;
  name: string;
  settings: ScenarioSettingsAPI;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectionScenariosResponse {
  success: boolean;
  scenarios: ProjectionScenarioAPI[];
  count: number;
}

export interface ProjectionScenarioResponse {
  success: boolean;
  scenario: ProjectionScenarioAPI;
}

// Focus options for advice endpoint
export type AdviceFocus =
  | 'all'
  | 'goals'
  | 'rebalance'
  | 'surplus'
  | 'opportunities';

// Profile section names for PATCH endpoint
export type ProfileSection =
  | 'monthly_cash_flow'
  | 'household_context'
  | 'tax_situation'
  | 'goals';
