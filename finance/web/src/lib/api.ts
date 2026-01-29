// API client for Finance Dashboard
// Wired to FastAPI backend at /api/v1

import type {
  Portfolio,
  PortfolioHistoryResponse,
  HoldingsResponse,
  HoldingsFreshnessResponse,
  HoldingUpdateResponse,
  ProfileResponse,
  Profile,
  ProfileUpdateResponse,
  ProfileSectionUpdateResponse,
  ProfileSection,
  Advice,
  AdviceFocus,
  StatementsHistory,
  PullStatementsResponse,
  UploadStatementResponse,
  ProjectionHistoryResponse,
  ProjectionSettingsResponse,
  ProjectionSettingsAPI,
  ProjectionScenariosResponse,
  ProjectionScenarioResponse,
  ScenarioSettingsAPI,
  SessionResponse,
  SessionFormat,
  ExpenseTransactionsResponse,
  ExpenseSummary,
  ExpenseRecurringResponse,
  ExpenseMonthOverMonthResponse,
  ExpenseStatementsResponse,
  ExpenseImportResponse,
  ExpenseCategoriesResponse,
  ImportStatementsResponse,
} from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// ============================================================================
// Portfolio
// ============================================================================

/**
 * Get unified portfolio view across all accounts.
 * @param options.noPrices - Skip live crypto price fetch
 */
export async function getPortfolio(options?: {
  noPrices?: boolean;
}): Promise<Portfolio> {
  const params = new URLSearchParams();
  if (options?.noPrices) {
    params.set('no_prices', 'true');
  }
  const url = params.toString()
    ? `${API_URL}/portfolio?${params}`
    : `${API_URL}/portfolio`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get portfolio value history over time with account breakdown.
 * @param months - Months of history (default 12)
 */
export async function getPortfolioHistory(
  months = 12
): Promise<PortfolioHistoryResponse> {
  const params = new URLSearchParams({ months: months.toString() });
  const response = await fetch(`${API_URL}/portfolio/history?${params}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch portfolio history: ${response.statusText}`
    );
  }
  return response.json();
}

// ============================================================================
// Holdings
// ============================================================================

/**
 * Get all holdings with live crypto prices.
 */
export async function getHoldings(): Promise<HoldingsResponse> {
  const response = await fetch(`${API_URL}/holdings`);
  if (!response.ok) {
    throw new Error(`Failed to fetch holdings: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update a single holding value.
 * @param category - One of 'crypto', 'bank', or 'other'
 * @param key - The holding key (e.g., 'BTC', 'hysa', 'hsa')
 * @param data - New value and optional notes
 */
export async function updateHolding(
  category: string,
  key: string,
  data: { value: number; notes?: string }
): Promise<HoldingUpdateResponse> {
  const response = await fetch(`${API_URL}/holdings/${category}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return { success: false, error: error.detail || response.statusText };
  }
  return response.json();
}

/**
 * Delete a holding.
 * @param category - One of 'crypto', 'bank', or 'other'
 * @param key - The holding key (e.g., 'BTC', 'hysa', 'hsa')
 */
export async function deleteHolding(
  category: string,
  key: string
): Promise<HoldingUpdateResponse> {
  const response = await fetch(`${API_URL}/holdings/${category}/${key}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return { success: false, error: error.detail || response.statusText };
  }
  return response.json();
}

/**
 * Check if holdings data is stale (> 7 days old).
 */
export async function getHoldingsFreshness(): Promise<HoldingsFreshnessResponse> {
  const response = await fetch(`${API_URL}/holdings/freshness`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch holdings freshness: ${response.statusText}`
    );
  }
  return response.json();
}

// ============================================================================
// Profile
// ============================================================================

/**
 * Get the full financial profile.
 */
export async function getProfile(): Promise<ProfileResponse> {
  const response = await fetch(`${API_URL}/profile`);
  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Replace the entire profile.
 */
export async function updateProfile(
  profile: Partial<Profile>
): Promise<ProfileUpdateResponse> {
  const response = await fetch(`${API_URL}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!response.ok) {
    throw new Error(`Failed to update profile: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Update a specific section of the profile.
 * @param section - One of 'monthly_cash_flow', 'household_context', 'tax_situation', 'goals'
 * @param updates - Partial updates to merge into the section
 */
export async function updateProfileSection(
  section: ProfileSection,
  updates: Record<string, unknown>
): Promise<ProfileSectionUpdateResponse> {
  const response = await fetch(`${API_URL}/profile/${section}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(`Failed to update profile section: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// Advice
// ============================================================================

/**
 * Get prioritized financial recommendations.
 * @param focus - Filter by: 'all' | 'goals' | 'rebalance' | 'surplus' | 'opportunities'
 */
export async function getAdvice(focus?: AdviceFocus): Promise<Advice> {
  const params = new URLSearchParams();
  if (focus && focus !== 'all') {
    params.set('focus', focus);
  }
  const url = params.toString()
    ? `${API_URL}/advice?${params}`
    : `${API_URL}/advice`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch advice: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// Statements
// ============================================================================

/**
 * Get snapshot history.
 * @param account - Optional filter by account type (roth_ira, brokerage, traditional_ira)
 */
export async function getStatementsHistory(
  account?: string
): Promise<StatementsHistory> {
  const params = new URLSearchParams();
  if (account) {
    params.set('account', account);
  }
  const url = params.toString()
    ? `${API_URL}/statements/history?${params}`
    : `${API_URL}/statements/history`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch statements history: ${response.statusText}`
    );
  }
  return response.json();
}

/**
 * Pull and process statements from Downloads folder.
 * @param latest - Only pull the most recent statement
 */
export async function pullStatements(
  latest?: boolean
): Promise<PullStatementsResponse> {
  const params = new URLSearchParams();
  if (latest) {
    params.set('latest', 'true');
  }
  const url = params.toString()
    ? `${API_URL}/statements/pull?${params}`
    : `${API_URL}/statements/pull`;

  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      success: false,
      count: 0,
      error: error.detail || response.statusText,
    };
  }
  return response.json();
}

/**
 * Upload and process a statement PDF file.
 * @param file - PDF file to upload
 */
export async function uploadStatement(
  file: File
): Promise<UploadStatementResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/statements/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      success: false,
      error: error.detail || response.statusText,
    };
  }
  return response.json();
}

/**
 * Upload and process multiple statement PDFs with auto-classification.
 * Each file is classified (SoFi/Apex brokerage or Chase CC) and routed to the correct parser.
 */
export async function importStatements(
  files: File[],
  options?: { noCategorize?: boolean }
): Promise<ImportStatementsResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  const params = new URLSearchParams();
  if (options?.noCategorize) {
    params.set('no_categorize', 'true');
  }
  const url = params.toString()
    ? `${API_URL}/statements/import?${params}`
    : `${API_URL}/statements/import`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      success: false,
      total: files.length,
      imported: 0,
      failed: files.length,
      template_updated: false,
      results: files.map((f) => ({
        filename: f.name,
        type: null,
        success: false,
        error: error.detail || response.statusText,
      })),
    };
  }
  return response.json();
}

// ============================================================================
// Projections
// ============================================================================

/**
 * Get historical portfolio data for projection chart.
 * @param months - Months of history (1-60)
 */
export async function getProjectionHistory(
  months = 12
): Promise<ProjectionHistoryResponse> {
  const params = new URLSearchParams({ months: months.toString() });
  const response = await fetch(`${API_URL}/projection/history?${params}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch projection history: ${response.statusText}`
    );
  }
  return response.json();
}

/**
 * Get projection settings from profile.
 */
export async function getProjectionSettings(): Promise<ProjectionSettingsResponse> {
  const response = await fetch(`${API_URL}/projection/settings`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch projection settings: ${response.statusText}`
    );
  }
  return response.json();
}

/**
 * Update projection settings in profile.
 */
export async function updateProjectionSettings(
  updates: Partial<ProjectionSettingsAPI>
): Promise<ProjectionSettingsResponse> {
  const response = await fetch(`${API_URL}/projection/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
}

/**
 * List all projection scenarios.
 */
export async function getProjectionScenarios(): Promise<ProjectionScenariosResponse> {
  const response = await fetch(`${API_URL}/projection/scenarios`);
  if (!response.ok) {
    throw new Error(`Failed to fetch scenarios: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get a single projection scenario by ID.
 */
export async function getProjectionScenario(
  id: number
): Promise<ProjectionScenarioResponse> {
  const response = await fetch(`${API_URL}/projection/scenarios/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch scenario: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Create a new projection scenario.
 */
export async function createProjectionScenario(
  name: string,
  settings?: ScenarioSettingsAPI,
  isPrimary?: boolean
): Promise<ProjectionScenarioResponse> {
  const response = await fetch(`${API_URL}/projection/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      settings: settings ?? {},
      is_primary: isPrimary,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
}

/**
 * Update a projection scenario.
 */
export async function updateProjectionScenario(
  id: number,
  updates: {
    name?: string;
    settings?: ScenarioSettingsAPI;
    is_primary?: boolean;
  }
): Promise<ProjectionScenarioResponse> {
  const response = await fetch(`${API_URL}/projection/scenarios/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
}

/**
 * Delete a projection scenario.
 * Note: Cannot delete primary scenario.
 */
export async function deleteProjectionScenario(
  id: number
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_URL}/projection/scenarios/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
}

// ============================================================================
// Session
// ============================================================================

/**
 * Generate an advisor session prompt.
 * @param format - 'json' for structured data, 'markdown' for raw prompt
 */
export async function getSession(
  format: SessionFormat = 'json'
): Promise<SessionResponse | string> {
  const params = new URLSearchParams({ format });
  const response = await fetch(`${API_URL}/session?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to generate session: ${response.statusText}`);
  }

  // For markdown format, return the raw text
  if (format === 'markdown') {
    return response.text();
  }

  return response.json();
}

/**
 * Get session prompt as markdown string (convenience function).
 * Returns the raw markdown prompt text for clipboard copy.
 */
export async function getSessionMarkdown(): Promise<string> {
  const result = await getSession('markdown');
  return typeof result === 'string' ? result : (result.prompt ?? '');
}

// ============================================================================
// Expenses
// ============================================================================

/**
 * Get credit card transactions with optional filters.
 */
export async function getExpenses(options?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  merchant?: string;
  limit?: number;
}): Promise<ExpenseTransactionsResponse> {
  const params = new URLSearchParams();
  if (options?.startDate) params.set('start_date', options.startDate);
  if (options?.endDate) params.set('end_date', options.endDate);
  if (options?.category) params.set('category', options.category);
  if (options?.merchant) params.set('merchant', options.merchant);
  if (options?.limit) params.set('limit', options.limit.toString());
  const url = params.toString()
    ? `${API_URL}/expenses?${params}`
    : `${API_URL}/expenses`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch expenses: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get expense summary with category breakdown.
 * @param months - Number of months to include
 */
export async function getExpenseSummary(
  months = 1
): Promise<ExpenseSummary> {
  const params = new URLSearchParams({ months: months.toString() });
  const response = await fetch(`${API_URL}/expenses/summary?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch expense summary: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get recurring charges.
 */
export async function getRecurringExpenses(): Promise<ExpenseRecurringResponse> {
  const response = await fetch(`${API_URL}/expenses/recurring`);
  if (!response.ok) {
    throw new Error(`Failed to fetch recurring expenses: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get month-over-month spending comparison.
 */
export async function getMonthOverMonth(
  months = 6
): Promise<ExpenseMonthOverMonthResponse> {
  const params = new URLSearchParams({ months: months.toString() });
  const response = await fetch(`${API_URL}/expenses/month-over-month?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch month over month: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get imported CC statement list.
 */
export async function getExpenseStatements(): Promise<ExpenseStatementsResponse> {
  const response = await fetch(`${API_URL}/expenses/statements`);
  if (!response.ok) {
    throw new Error(`Failed to fetch expense statements: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Upload and import a credit card statement PDF.
 */
export async function importExpenseStatement(
  file: File,
  options?: { noCategorize?: boolean }
): Promise<ExpenseImportResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const params = new URLSearchParams();
  if (options?.noCategorize) params.set('no_categorize', 'true');
  const url = params.toString()
    ? `${API_URL}/expenses/import?${params}`
    : `${API_URL}/expenses/import`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return { success: false, error: error.detail || response.statusText };
  }
  return response.json();
}

/**
 * Get merchant category mappings.
 */
export async function getExpenseCategories(): Promise<ExpenseCategoriesResponse> {
  const response = await fetch(`${API_URL}/expenses/categories`);
  if (!response.ok) {
    throw new Error(`Failed to fetch expense categories: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Override a merchant's category.
 */
export async function setExpenseCategory(
  merchant: string,
  category: string
): Promise<{ success: boolean; transactions_updated: number }> {
  const response = await fetch(
    `${API_URL}/expenses/categories/${encodeURIComponent(merchant)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
}

/**
 * Get AI-powered spending insights.
 */
export async function getSpendingInsights(
  months = 3
): Promise<import("./types").SpendingInsightsResponse> {
  const response = await fetch(`${API_URL}/expenses/insights?months=${months}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
}

/**
 * Force regeneration of spending insights.
 */
export async function refreshSpendingInsights(
  months = 3
): Promise<import("./types").SpendingInsightsResponse> {
  const response = await fetch(
    `${API_URL}/expenses/insights/refresh?months=${months}`,
    { method: 'POST' }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || response.statusText);
  }
  return response.json();
}
