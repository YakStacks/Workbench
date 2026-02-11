export type FeatureFlags = {
  L_TOOL_HEALTH_SIGNALS: boolean;
  M_SMART_AUTO_DIAGNOSTICS: boolean;
  N_PERMISSION_PROFILES: boolean;
  N_RUN_TIMELINE: boolean;
  N_EXPORT_RUN_BUNDLE: boolean;
  // V2 Trust Core flags
  V2_GUARDRAILS: boolean;
  V2_ASSET_SYSTEM: boolean;
  V2_AUTO_DOCTOR: boolean;
  V2_SESSION_LOGS: boolean;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  L_TOOL_HEALTH_SIGNALS: false,
  M_SMART_AUTO_DIAGNOSTICS: false,
  N_PERMISSION_PROFILES: false,
  N_RUN_TIMELINE: false,
  N_EXPORT_RUN_BUNDLE: false,
  // V2 Trust Core - enabled by default
  V2_GUARDRAILS: true,
  V2_ASSET_SYSTEM: true,
  V2_AUTO_DOCTOR: true,
  V2_SESSION_LOGS: true,
};

export function mergeFeatureFlags(
  input?: Partial<FeatureFlags> | null,
): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...(input || {}) };
}
