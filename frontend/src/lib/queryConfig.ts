/**
 * React Query configuration constants
 * Moved to separate file to avoid fast-refresh issues
 */

// Query stale time constants for different data types
export const STALE_TIMES = {
  // Frequently changing data - refetch more often
  LABELS: 30 * 1000, // 30 seconds - labels can be created/edited frequently
  ARTICLES: 60 * 1000, // 1 minute - articles change less frequently
  JOBS: 5 * 1000, // 5 seconds - job status updates quickly

  // Relatively static data - cache longer
  TEMPLATES: 5 * 60 * 1000, // 5 minutes - templates rarely change
  SETTINGS: 10 * 60 * 1000, // 10 minutes - settings are static
  CATEGORIES: 5 * 60 * 1000, // 5 minutes - categories rarely change
} as const;
