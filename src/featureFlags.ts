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
  // V3 Tool Selection Intelligence flags
  V3_SMART_DISPATCH: boolean;
  V3_DISAMBIGUATION: boolean;
  V3_CHAIN_PLANNING: boolean;
  V3_USAGE_TRACKING: boolean;
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
  // V3 Tool Selection Intelligence - enabled by default
  V3_SMART_DISPATCH: true,
  V3_DISAMBIGUATION: true,
  V3_CHAIN_PLANNING: true,
  V3_USAGE_TRACKING: true,
};

export function mergeFeatureFlags(
  input?: Partial<FeatureFlags> | null,
): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...(input || {}) };
}
