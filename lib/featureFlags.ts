import { getFeatureFlag } from '../config/featureFlags';

/**
 * Compatibility layer.
 * Runtime feature flags are sourced from config/featureFlags.ts.
 */
export const FeatureFlags = {
  get SHOW_NARRATIVE_MODE_TOGGLE(): boolean {
    return getFeatureFlag('show_narrative_mode_toggle');
  },
} as const;

export type FeatureFlagKey = keyof typeof FeatureFlags;

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FeatureFlags[flag];
}
