"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFeatureFlags = initFeatureFlags;
exports.getFeatureFlag = getFeatureFlag;
exports.setFeatureFlag = setFeatureFlag;
exports.subscribe = subscribe;
exports.useFeatureFlag = useFeatureFlag;
exports.getAllFeatureFlags = getAllFeatureFlags;
const async_storage_1 = require("@react-native-async-storage/async-storage");
const STORAGE_KEY = 'nuolo_feature_flags_v1';
const envDefault = (key, fallback) => {
    const raw = process.env[key];
    if (raw === undefined || raw === null)
        return fallback;
    const val = String(raw).toLowerCase();
    return val === '1' || val === 'true' || val === 'yes' || val === 'on';
};
const defaultFlags = {
    audio_chunked_pipeline: envDefault('EXPO_PUBLIC_FF_AUDIO_CHUNKED', true),
    audio_streaming_pipeline: envDefault('EXPO_PUBLIC_FF_AUDIO_STREAMING', false),
    telemetry_enabled: envDefault('EXPO_PUBLIC_FF_TELEMETRY', true),
    perf_overlay_enabled: envDefault('EXPO_PUBLIC_FF_PERF_OVERLAY', false),
};
let state = { ...defaultFlags };
const listeners = new Set();
let initialized = false;
async function initFeatureFlags() {
    if (initialized)
        return;
    try {
        const raw = await async_storage_1.default.getItem(STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            state = { ...state, ...saved };
        }
    }
    catch (e) {
        // ignore
    }
    finally {
        initialized = true;
        notify();
    }
}
function notify() {
    for (const l of Array.from(listeners))
        l(state);
}
function getFeatureFlag(key) {
    return state[key];
}
async function setFeatureFlag(key, value) {
    state = { ...state, [key]: value };
    await async_storage_1.default.setItem(STORAGE_KEY, JSON.stringify(state));
    notify();
}
function subscribe(listener) {
    listeners.add(listener);
    // call immediately with current state
    listener(state);
    return () => listeners.delete(listener);
}
function useFeatureFlag(key) {
    // Lightweight inline hook without importing React to keep deps light
    // Consumers in React components should wrap this in a real useEffect/useState pair.
    const set = (value) => setFeatureFlag(key, value);
    return [getFeatureFlag(key), set];
}
function getAllFeatureFlags() {
    return { ...state };
}
