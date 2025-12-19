/**
 * Feature Flags Hook
 * React hook for checking feature flag status
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

// Feature flag names (must match backend)
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

interface FeatureFlagsResponse {
  success: boolean;
  data: {
    flags: Record<string, boolean>;
    userId: string | null;
  };
}

/**
 * Fetch all feature flags from the API
 */
async function fetchFeatureFlags(): Promise<Record<string, boolean>> {
  const response = await api.get<FeatureFlagsResponse>('/features');
  return response.data.data.flags;
}

/**
 * Hook to get all feature flags
 */
export function useFeatureFlags() {
  const query = useQuery({
    queryKey: ['featureFlags'],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    flags: query.data ?? {},
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const { flags } = useFeatureFlags();
  return flags[flagName] ?? false;
}

/**
 * Hook to check multiple feature flags at once
 */
export function useFeatureFlagsMulti(
  flagNames: FeatureFlagName[]
): Record<FeatureFlagName, boolean> {
  const { flags } = useFeatureFlags();

  return flagNames.reduce(
    (acc, name) => {
      acc[name] = flags[name] ?? false;
      return acc;
    },
    {} as Record<FeatureFlagName, boolean>
  );
}

/**
 * HOC to conditionally render based on feature flag
 */
export function withFeatureFlag<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  flagName: FeatureFlagName,
  FallbackComponent?: React.ComponentType<P>
) {
  return function FeatureFlaggedComponent(props: P) {
    const isEnabled = useFeatureFlag(flagName);

    if (!isEnabled) {
      return FallbackComponent ? <FallbackComponent {...props} /> : null;
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * Component that renders children only if feature is enabled
 */
interface FeatureGateProps {
  flag: FeatureFlagName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);
  return <>{isEnabled ? children : fallback}</>;
}

export default useFeatureFlags;
