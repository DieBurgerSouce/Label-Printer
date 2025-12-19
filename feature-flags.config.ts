/**
 * Feature Flags Configuration
 *
 * This module defines feature flags for Screenshot_Algo.
 * Feature flags allow gradual rollout, A/B testing, and safe deployments.
 */

export interface FeatureFlag {
  /** Unique identifier for the flag */
  key: string;
  /** Human-readable name */
  name: string;
  /** Description of what the flag controls */
  description: string;
  /** Whether the flag is enabled by default */
  defaultValue: boolean;
  /** Environment-specific overrides */
  environments?: {
    development?: boolean;
    staging?: boolean;
    production?: boolean;
  };
  /** Percentage of users/requests to enable for (0-100) */
  rolloutPercentage?: number;
  /** Specific user/tenant IDs to enable for */
  enabledFor?: string[];
  /** Specific user/tenant IDs to disable for */
  disabledFor?: string[];
  /** Tags for organization */
  tags?: string[];
  /** Owner team or person */
  owner?: string;
  /** When the flag was created */
  createdAt?: string;
  /** When the flag should be reviewed/removed */
  expiresAt?: string;
}

/**
 * All feature flags for the application
 */
export const featureFlags: FeatureFlag[] = [
  // ============================================
  // Screenshot Features
  // ============================================
  {
    key: 'screenshot_v2_engine',
    name: 'Screenshot V2 Engine',
    description: 'Use the new optimized screenshot capture engine with better performance',
    defaultValue: false,
    environments: {
      development: true,
      staging: true,
      production: false,
    },
    rolloutPercentage: 0,
    tags: ['screenshot', 'performance'],
    owner: 'screenshot-team',
    createdAt: '2024-10-01',
  },
  {
    key: 'screenshot_webp_support',
    name: 'WebP Screenshot Support',
    description: 'Enable WebP format for screenshots (smaller file sizes)',
    defaultValue: true,
    environments: {
      development: true,
      staging: true,
      production: true,
    },
    tags: ['screenshot', 'format'],
    owner: 'screenshot-team',
    createdAt: '2024-09-15',
  },
  {
    key: 'screenshot_parallel_capture',
    name: 'Parallel Screenshot Capture',
    description: 'Enable capturing multiple screenshots in parallel',
    defaultValue: false,
    environments: {
      development: true,
      staging: true,
      production: false,
    },
    rolloutPercentage: 25,
    tags: ['screenshot', 'performance', 'experimental'],
    owner: 'screenshot-team',
    createdAt: '2024-11-01',
    expiresAt: '2025-02-01',
  },

  // ============================================
  // Label Features
  // ============================================
  {
    key: 'label_qr_codes',
    name: 'QR Code Labels',
    description: 'Enable QR code generation on labels',
    defaultValue: true,
    tags: ['label', 'qr'],
    owner: 'label-team',
    createdAt: '2024-08-01',
  },
  {
    key: 'label_batch_generation',
    name: 'Batch Label Generation',
    description: 'Enable generating multiple labels in a single request',
    defaultValue: true,
    environments: {
      development: true,
      staging: true,
      production: true,
    },
    tags: ['label', 'batch'],
    owner: 'label-team',
    createdAt: '2024-07-15',
  },

  // ============================================
  // API Features
  // ============================================
  {
    key: 'api_v2_endpoints',
    name: 'API V2 Endpoints',
    description: 'Enable new v2 API endpoints',
    defaultValue: true,
    environments: {
      development: true,
      staging: true,
      production: true,
    },
    tags: ['api', 'v2'],
    owner: 'api-team',
    createdAt: '2024-06-01',
  },
  {
    key: 'api_rate_limiting_v2',
    name: 'Rate Limiting V2',
    description: 'Use new rate limiting algorithm with sliding window',
    defaultValue: false,
    environments: {
      development: true,
      staging: true,
      production: false,
    },
    rolloutPercentage: 10,
    tags: ['api', 'security', 'performance'],
    owner: 'platform-team',
    createdAt: '2024-10-15',
  },
  {
    key: 'api_graphql',
    name: 'GraphQL API',
    description: 'Enable experimental GraphQL API endpoint',
    defaultValue: false,
    environments: {
      development: true,
      staging: false,
      production: false,
    },
    tags: ['api', 'graphql', 'experimental'],
    owner: 'api-team',
    createdAt: '2024-11-01',
    expiresAt: '2025-03-01',
  },

  // ============================================
  // UI Features
  // ============================================
  {
    key: 'ui_dark_mode',
    name: 'Dark Mode',
    description: 'Enable dark mode UI option',
    defaultValue: true,
    tags: ['ui', 'accessibility'],
    owner: 'frontend-team',
    createdAt: '2024-05-01',
  },
  {
    key: 'ui_new_dashboard',
    name: 'New Dashboard',
    description: 'Enable the redesigned dashboard experience',
    defaultValue: false,
    environments: {
      development: true,
      staging: true,
      production: false,
    },
    rolloutPercentage: 50,
    tags: ['ui', 'dashboard', 'beta'],
    owner: 'frontend-team',
    createdAt: '2024-10-01',
  },

  // ============================================
  // Integration Features
  // ============================================
  {
    key: 'integration_slack',
    name: 'Slack Integration',
    description: 'Enable Slack notifications and commands',
    defaultValue: true,
    tags: ['integration', 'slack'],
    owner: 'integrations-team',
    createdAt: '2024-04-01',
  },
  {
    key: 'integration_webhooks_v2',
    name: 'Webhooks V2 (CloudEvents)',
    description: 'Use CloudEvents format for webhooks',
    defaultValue: false,
    environments: {
      development: true,
      staging: true,
      production: false,
    },
    tags: ['integration', 'webhooks', 'cloudevents'],
    owner: 'integrations-team',
    createdAt: '2024-09-01',
  },

  // ============================================
  // Performance Features
  // ============================================
  {
    key: 'perf_query_caching',
    name: 'Query Result Caching',
    description: 'Enable caching of frequently used database queries',
    defaultValue: true,
    environments: {
      development: false, // Disable in dev for testing
      staging: true,
      production: true,
    },
    tags: ['performance', 'caching'],
    owner: 'platform-team',
    createdAt: '2024-03-01',
  },
  {
    key: 'perf_cdn_optimization',
    name: 'CDN Optimization',
    description: 'Enable CDN optimization for static assets',
    defaultValue: true,
    tags: ['performance', 'cdn'],
    owner: 'platform-team',
    createdAt: '2024-02-15',
  },

  // ============================================
  // Security Features
  // ============================================
  {
    key: 'security_mfa',
    name: 'Multi-Factor Authentication',
    description: 'Enable MFA for user accounts',
    defaultValue: true,
    tags: ['security', 'auth'],
    owner: 'security-team',
    createdAt: '2024-01-01',
  },
  {
    key: 'security_audit_logging',
    name: 'Enhanced Audit Logging',
    description: 'Enable detailed audit logging for compliance',
    defaultValue: true,
    environments: {
      development: false,
      staging: true,
      production: true,
    },
    tags: ['security', 'compliance', 'logging'],
    owner: 'security-team',
    createdAt: '2024-06-01',
  },
];

/**
 * Get a feature flag by key
 */
export function getFeatureFlag(key: string): FeatureFlag | undefined {
  return featureFlags.find((f) => f.key === key);
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
  key: string,
  context?: {
    environment?: string;
    userId?: string;
    tenantId?: string;
  }
): boolean {
  const flag = getFeatureFlag(key);
  if (!flag) {
    console.warn(`Feature flag '${key}' not found, defaulting to false`);
    return false;
  }

  // Check if disabled for specific user/tenant
  if (context?.userId && flag.disabledFor?.includes(context.userId)) {
    return false;
  }
  if (context?.tenantId && flag.disabledFor?.includes(context.tenantId)) {
    return false;
  }

  // Check if enabled for specific user/tenant
  if (context?.userId && flag.enabledFor?.includes(context.userId)) {
    return true;
  }
  if (context?.tenantId && flag.enabledFor?.includes(context.tenantId)) {
    return true;
  }

  // Check environment override
  if (context?.environment && flag.environments) {
    const envValue = flag.environments[context.environment as keyof typeof flag.environments];
    if (envValue !== undefined) {
      return envValue;
    }
  }

  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
    // Use consistent hashing for user if available
    if (context?.userId) {
      const hash = simpleHash(context.userId + key);
      return hash % 100 < flag.rolloutPercentage;
    }
    // Random for anonymous
    return Math.random() * 100 < flag.rolloutPercentage;
  }

  return flag.defaultValue;
}

/**
 * Simple hash function for consistent rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get all flags with a specific tag
 */
export function getFlagsByTag(tag: string): FeatureFlag[] {
  return featureFlags.filter((f) => f.tags?.includes(tag));
}

/**
 * Get all expired or expiring soon flags
 */
export function getExpiringFlags(daysAhead = 30): FeatureFlag[] {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysAhead);

  return featureFlags.filter((f) => {
    if (!f.expiresAt) return false;
    return new Date(f.expiresAt) <= threshold;
  });
}

export default featureFlags;
