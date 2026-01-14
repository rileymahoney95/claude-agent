// API client for Finance Dashboard
// Wired to FastAPI backend at /api/v1

import type {
  Portfolio,
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
