export type FeatureFlags = {
  L_TOOL_HEALTH_SIGNALS: boolean;
  M_SMART_AUTO_DIAGNOSTICS: boolean;
  N_PERMISSION_PROFILES: boolean;
  N_RUN_TIMELINE: boolean;
  N_EXPORT_RUN_BUNDLE: boolean;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  L_TOOL_HEALTH_SIGNALS: false,
  M_SMART_AUTO_DIAGNOSTICS: false,
  N_PERMISSION_PROFILES: false,
  N_RUN_TIMELINE: false,
  N_EXPORT_RUN_BUNDLE: false,
};

export function mergeFeatureFlags(
  input?: Partial<FeatureFlags> | null,
): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...(input || {}) };
}
