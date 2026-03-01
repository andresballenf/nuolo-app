import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from '../lib/logger';

type RuntimeEnvKey =
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  | 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'
  | 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'
  | 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY';

interface ValidationIssue {
  key: RuntimeEnvKey;
  reason: string;
}

export interface RuntimeHealthReport {
  ok: boolean;
  missing: RuntimeEnvKey[];
  invalid: ValidationIssue[];
  checkedAt: string;
}

const COMMON_REQUIRED_KEYS: RuntimeEnvKey[] = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
];

const IOS_REQUIRED_KEYS: RuntimeEnvKey[] = ['EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'];
const ANDROID_REQUIRED_KEYS: RuntimeEnvKey[] = ['EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'];

const getEnvValue = (key: RuntimeEnvKey): string | undefined => {
  const processValue = (process.env as Record<string, string | undefined>)[key];
  if (typeof processValue === 'string' && processValue.trim().length > 0) {
    return processValue.trim();
  }

  const extraValue = (Constants?.expoConfig?.extra as Record<string, unknown> | undefined)?.[key];
  if (typeof extraValue === 'string' && extraValue.trim().length > 0) {
    return extraValue.trim();
  }

  return undefined;
};

const validateValue = (key: RuntimeEnvKey, value: string): string | null => {
  if (value.includes('YOUR_') || value.includes('__SET_')) {
    return 'placeholder value detected';
  }

  switch (key) {
    case 'EXPO_PUBLIC_SUPABASE_URL':
      if (!/^https:\/\/.+/i.test(value)) {
        return 'must start with https://';
      }
      if (!value.includes('.supabase.co')) {
        return 'must point to a supabase.co project URL';
      }
      return null;

    case 'EXPO_PUBLIC_SUPABASE_ANON_KEY':
      if (value.length < 80) {
        return 'value is too short for a Supabase anon key';
      }
      return null;

    case 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY':
      if (!value.startsWith('AIza')) {
        return 'unexpected Google Maps API key format';
      }
      return null;

    case 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY':
      if (!value.startsWith('appl_')) {
        return 'unexpected iOS RevenueCat API key format';
      }
      return null;

    case 'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY':
      if (!value.startsWith('goog_')) {
        return 'unexpected Android RevenueCat API key format';
      }
      return null;

    default:
      return null;
  }
};

const getRequiredKeysForPlatform = (): RuntimeEnvKey[] => {
  if (Platform.OS === 'ios') {
    return [...COMMON_REQUIRED_KEYS, ...IOS_REQUIRED_KEYS];
  }

  if (Platform.OS === 'android') {
    return [...COMMON_REQUIRED_KEYS, ...ANDROID_REQUIRED_KEYS];
  }

  return COMMON_REQUIRED_KEYS;
};

export function runStartupHealthChecks(): RuntimeHealthReport {
  const requiredKeys = getRequiredKeysForPlatform();
  const missing: RuntimeEnvKey[] = [];
  const invalid: ValidationIssue[] = [];

  for (const key of requiredKeys) {
    const value = getEnvValue(key);
    if (!value) {
      missing.push(key);
      continue;
    }

    const error = validateValue(key, value);
    if (error) {
      invalid.push({ key, reason: error });
    }
  }

  const report: RuntimeHealthReport = {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    checkedAt: new Date().toISOString(),
  };

  if (!report.ok) {
    const parts: string[] = [];

    if (missing.length > 0) {
      parts.push(`missing: ${missing.join(', ')}`);
    }

    if (invalid.length > 0) {
      const invalidSummary = invalid.map(issue => `${issue.key} (${issue.reason})`).join(', ');
      parts.push(`invalid: ${invalidSummary}`);
    }

    const message = `Runtime env health check failed on ${Platform.OS}: ${parts.join(' | ')}`;

    if (__DEV__) {
      logger.error(message);
    } else {
      logger.warn(message);
    }
  }

  return report;
}
