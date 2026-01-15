/**
 * localStorage helpers for persisting projection preferences.
 *
 * These are UI preferences (time horizon, inflation toggle) that survive
 * page refreshes. Scenario data is stored via the API, not localStorage.
 */

const STORAGE_KEY = 'finance-projections-prefs';
const CURRENT_VERSION = 1;

export interface ProjectionPreferences {
  version: number;
  projectionMonths: number;
  showInflationAdjusted: boolean;
  lockToCurrentAllocation: boolean;
}

const DEFAULT_PREFS: ProjectionPreferences = {
  version: CURRENT_VERSION,
  projectionMonths: 240, // 20 years
  showInflationAdjusted: false,
  lockToCurrentAllocation: true,
};

/**
 * Load projection preferences from localStorage.
 * Returns defaults if localStorage is unavailable or data is corrupted.
 */
export function loadProjectionPrefs(): ProjectionPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFS;

    const parsed = JSON.parse(stored);

    // Validate structure and merge with defaults for any missing fields
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_PREFS;
    }

    // Future: migrate if parsed.version < CURRENT_VERSION
    // For now, just merge with defaults
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      version: CURRENT_VERSION,
    };
  } catch {
    // JSON parse error or other issue - return defaults
    return DEFAULT_PREFS;
  }
}

/**
 * Save projection preferences to localStorage.
 * Merges with existing preferences and updates version.
 */
export function saveProjectionPrefs(
  prefs: Partial<Omit<ProjectionPreferences, 'version'>>
): void {
  if (typeof window === 'undefined') return;

  try {
    const current = loadProjectionPrefs();
    const updated: ProjectionPreferences = {
      ...current,
      ...prefs,
      version: CURRENT_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail - localStorage may be unavailable (private browsing, quota exceeded)
  }
}

/**
 * Clear projection preferences from localStorage.
 * Useful for testing or resetting to defaults.
 */
export function clearProjectionPrefs(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}
