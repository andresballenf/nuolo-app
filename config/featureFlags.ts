import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeatureFlagKey =
  | 'audio_chunked_pipeline'
  | 'audio_streaming_pipeline'
  | 'telemetry_enabled'
  | 'perf_overlay_enabled';

export type FeatureFlagsState = Record<FeatureFlagKey, boolean>;

type Listener = (flags: FeatureFlagsState) => void;

const STORAGE_KEY = 'nuolo_feature_flags_v1';

const envDefault = (key: string, fallback: boolean): boolean => {
  const raw = (process.env as any)[key];
  if (raw === undefined || raw === null) return fallback;
  const val = String(raw).toLowerCase();
  return val === '1' || val === 'true' || val === 'yes' || val === 'on';
};

const defaultFlags: FeatureFlagsState = {
  audio_chunked_pipeline: envDefault('EXPO_PUBLIC_FF_AUDIO_CHUNKED', true),
  audio_streaming_pipeline: envDefault('EXPO_PUBLIC_FF_AUDIO_STREAMING', false),
  telemetry_enabled: envDefault('EXPO_PUBLIC_FF_TELEMETRY', true),
  perf_overlay_enabled: envDefault('EXPO_PUBLIC_FF_PERF_OVERLAY', false),
};

let state: FeatureFlagsState = { ...defaultFlags };
const listeners: Set<Listener> = new Set();
let initialized = false;

export async function initFeatureFlags(): Promise<void> {
  if (initialized) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<FeatureFlagsState>;
      state = { ...state, ...saved };
    }
  } catch (e) {
    // ignore
  } finally {
    initialized = true;
    notify();
  }
}

function notify() {
  for (const l of Array.from(listeners)) l(state);
}

export function getFeatureFlag<K extends FeatureFlagKey>(key: K): FeatureFlagsState[K] {
  return state[key];
}

export async function setFeatureFlag<K extends FeatureFlagKey>(key: K, value: FeatureFlagsState[K]): Promise<void> {
  state = { ...state, [key]: value } as FeatureFlagsState;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  notify();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // call immediately with current state
  listener(state);
  return () => listeners.delete(listener);
}

export function useFeatureFlag(key: FeatureFlagKey): [boolean, (value: boolean) => Promise<void>] {
  // Lightweight inline hook without importing React to keep deps light
  // Consumers in React components should wrap this in a real useEffect/useState pair.
  const set = (value: boolean) => setFeatureFlag(key, value);
  return [getFeatureFlag(key), set];
}

export function getAllFeatureFlags(): FeatureFlagsState {
  return { ...state };
}
