/**
 * Feature Flags Service
 * Centralized feature flag management for gradual rollouts and A/B testing
 *
 * Supports:
 * - Environment variable configuration
 * - Per-user overrides
 * - Percentage-based rollouts
 * - Scheduled feature releases
 */

import logger from '../utils/logger';

// Feature flag definition
export interface FeatureFlag {
  name: string;
  description: string;
  enabled: boolean;
  // Optional: percentage of users to enable for (0-100)
  rolloutPercentage?: number;
  // Optional: specific user IDs to enable for
  enabledForUsers?: string[];
  // Optional: specific user IDs to disable for
  disabledForUsers?: string[];
  // Optional: environment-specific overrides
  environments?: {
    development?: boolean;
    staging?: boolean;
    production?: boolean;
  };
  // Optional: schedule for automatic enable/disable
  schedule?: {
    enableAt?: Date;
    disableAt?: Date;
  };
  // Metadata for tracking
  createdAt: Date;
  updatedAt: Date;
}

// Feature flag names as constants for type safety
export const FEATURE_FLAGS = {
  // Core features
  OCR_ENABLED: 'ocr_enabled',
  CRAWLER_ENABLED: 'crawler_enabled',
  BATCH_PROCESSING: 'batch_processing',
  AUTOMATION_JOBS: 'automation_jobs',

  // UI Features
  DARK_MODE: 'dark_mode',
  NEW_LABEL_EDITOR: 'new_label_editor',
  VIRTUAL_SCROLLING: 'virtual_scrolling',
  I18N_ENABLED: 'i18n_enabled',

  // Performance Features
  CACHING_ENABLED: 'caching_enabled',
  LAZY_LOADING: 'lazy_loading',
  IMAGE_OPTIMIZATION: 'image_optimization',

  // Experimental Features
  AI_SUGGESTIONS: 'ai_suggestions',
  BULK_IMPORT: 'bulk_import',
  EXPORT_PDF: 'export_pdf',

  // Monitoring
  TRACING_ENABLED: 'tracing_enabled',
  DETAILED_LOGGING: 'detailed_logging',
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

// Default feature flag configurations
const DEFAULT_FLAGS: Record<FeatureFlagName, Partial<FeatureFlag>> = {
  // Core features - enabled by default
  [FEATURE_FLAGS.OCR_ENABLED]: {
    description: 'Enable OCR text recognition',
    enabled: true,
  },
  [FEATURE_FLAGS.CRAWLER_ENABLED]: {
    description: 'Enable web crawler for product data',
    enabled: true,
  },
  [FEATURE_FLAGS.BATCH_PROCESSING]: {
    description: 'Enable batch processing of labels',
    enabled: true,
  },
  [FEATURE_FLAGS.AUTOMATION_JOBS]: {
    description: 'Enable automation job queue',
    enabled: true,
  },

  // UI Features
  [FEATURE_FLAGS.DARK_MODE]: {
    description: 'Enable dark mode theme',
    enabled: true,
  },
  [FEATURE_FLAGS.NEW_LABEL_EDITOR]: {
    description: 'Use new label editor component',
    enabled: false,
    rolloutPercentage: 0,
  },
  [FEATURE_FLAGS.VIRTUAL_SCROLLING]: {
    description: 'Enable virtual scrolling for large lists',
    enabled: true,
  },
  [FEATURE_FLAGS.I18N_ENABLED]: {
    description: 'Enable internationalization',
    enabled: true,
  },

  // Performance Features
  [FEATURE_FLAGS.CACHING_ENABLED]: {
    description: 'Enable Redis caching',
    enabled: true,
  },
  [FEATURE_FLAGS.LAZY_LOADING]: {
    description: 'Enable lazy loading of components',
    enabled: true,
  },
  [FEATURE_FLAGS.IMAGE_OPTIMIZATION]: {
    description: 'Enable image optimization',
    enabled: true,
  },

  // Experimental Features
  [FEATURE_FLAGS.AI_SUGGESTIONS]: {
    description: 'AI-powered product suggestions',
    enabled: false,
    rolloutPercentage: 0,
    environments: {
      development: true,
      staging: true,
      production: false,
    },
  },
  [FEATURE_FLAGS.BULK_IMPORT]: {
    description: 'Bulk import from multiple sources',
    enabled: true,
  },
  [FEATURE_FLAGS.EXPORT_PDF]: {
    description: 'Export labels as PDF',
    enabled: true,
  },

  // Monitoring
  [FEATURE_FLAGS.TRACING_ENABLED]: {
    description: 'Enable distributed tracing',
    enabled: process.env.OTEL_TRACING_ENABLED !== 'false',
  },
  [FEATURE_FLAGS.DETAILED_LOGGING]: {
    description: 'Enable detailed debug logging',
    enabled: process.env.NODE_ENV === 'development',
  },
};

// In-memory feature flag store
const featureFlags: Map<string, FeatureFlag> = new Map();

// User-specific overrides (in production, this would be in a database)
const userOverrides: Map<string, Map<string, boolean>> = new Map();

/**
 * Initialize feature flags from environment and defaults
 */
function initializeFlags(): void {
  const now = new Date();

  Object.entries(DEFAULT_FLAGS).forEach(([name, config]) => {
    // Check for environment variable override
    const envKey = `FEATURE_${name.toUpperCase()}`;
    const envValue = process.env[envKey];

    let enabled = config.enabled ?? false;

    // Environment variable takes precedence
    if (envValue !== undefined) {
      enabled = envValue === 'true' || envValue === '1';
    }

    // Environment-specific override
    const env = process.env.NODE_ENV || 'development';
    if (config.environments?.[env as keyof typeof config.environments] !== undefined) {
      enabled = config.environments[env as keyof typeof config.environments]!;
    }

    const flag: FeatureFlag = {
      name,
      description: config.description || '',
      enabled,
      rolloutPercentage: config.rolloutPercentage,
      enabledForUsers: config.enabledForUsers,
      disabledForUsers: config.disabledForUsers,
      environments: config.environments,
      schedule: config.schedule,
      createdAt: now,
      updatedAt: now,
    };

    featureFlags.set(name, flag);
  });

  logger.info('Feature flags initialized', {
    count: featureFlags.size,
    enabled: Array.from(featureFlags.values())
      .filter((f) => f.enabled)
      .map((f) => f.name),
  });
}

// Initialize on module load
initializeFlags();

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(flagName: FeatureFlagName, userId?: string): boolean {
  const flag = featureFlags.get(flagName);

  if (!flag) {
    logger.warn('Unknown feature flag', { flagName });
    return false;
  }

  // Check schedule
  if (flag.schedule) {
    const now = new Date();
    if (flag.schedule.enableAt && now < flag.schedule.enableAt) {
      return false;
    }
    if (flag.schedule.disableAt && now > flag.schedule.disableAt) {
      return false;
    }
  }

  // Check user-specific override
  if (userId) {
    const userFlags = userOverrides.get(userId);
    if (userFlags?.has(flagName)) {
      return userFlags.get(flagName)!;
    }

    // Check if user is in enabled list
    if (flag.enabledForUsers?.includes(userId)) {
      return true;
    }

    // Check if user is in disabled list
    if (flag.disabledForUsers?.includes(userId)) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      // Use consistent hashing based on user ID for stable rollout
      const hash = hashUserId(userId, flagName);
      return hash < flag.rolloutPercentage;
    }
  }

  return flag.enabled;
}

/**
 * Get all feature flags with their current status
 */
export function getAllFlags(userId?: string): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  featureFlags.forEach((flag, name) => {
    result[name] = isFeatureEnabled(name as FeatureFlagName, userId);
  });

  return result;
}

/**
 * Get detailed information about all flags
 */
export function getDetailedFlags(): FeatureFlag[] {
  return Array.from(featureFlags.values());
}

/**
 * Set a user-specific override for a feature flag
 */
export function setUserOverride(userId: string, flagName: FeatureFlagName, enabled: boolean): void {
  if (!userOverrides.has(userId)) {
    userOverrides.set(userId, new Map());
  }

  userOverrides.get(userId)!.set(flagName, enabled);

  logger.info('User feature override set', { userId, flagName, enabled });
}

/**
 * Remove a user-specific override
 */
export function removeUserOverride(userId: string, flagName: FeatureFlagName): void {
  const userFlags = userOverrides.get(userId);
  if (userFlags) {
    userFlags.delete(flagName);
    if (userFlags.size === 0) {
      userOverrides.delete(userId);
    }
  }
}

/**
 * Update a feature flag configuration
 */
export function updateFlag(
  flagName: FeatureFlagName,
  updates: Partial<FeatureFlag>
): FeatureFlag | null {
  const flag = featureFlags.get(flagName);

  if (!flag) {
    logger.warn('Cannot update unknown feature flag', { flagName });
    return null;
  }

  const updatedFlag: FeatureFlag = {
    ...flag,
    ...updates,
    name: flag.name, // Name cannot be changed
    updatedAt: new Date(),
  };

  featureFlags.set(flagName, updatedFlag);

  logger.info('Feature flag updated', {
    flagName,
    enabled: updatedFlag.enabled,
    rolloutPercentage: updatedFlag.rolloutPercentage,
  });

  return updatedFlag;
}

/**
 * Hash user ID for consistent percentage-based rollout
 */
function hashUserId(userId: string, flagName: string): number {
  const str = `${userId}:${flagName}`;
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Return value between 0-99
  return Math.abs(hash) % 100;
}

// Export the service as a singleton
export const featureFlagsService = {
  isFeatureEnabled,
  getAllFlags,
  getDetailedFlags,
  setUserOverride,
  removeUserOverride,
  updateFlag,
  FEATURE_FLAGS,
};

export default featureFlagsService;
