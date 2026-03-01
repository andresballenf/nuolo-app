# Agent Brief (Compact)

Use this as the first repo-context file after `AGENTS.md` / `CLAUDE.md`.

## 1) App Snapshot
- Product: `Nuolo` mobile app (Expo + React Native) for location-based audio guides.
- Main user journey: authenticate → open map → find attraction → generate/play narrated audio.
- Primary route files: `app/index.tsx`, `app/auth/*`, `app/map.tsx`, root providers in `app/_layout.tsx`.

## 2) Core Runtime Architecture
- Navigation: Expo Router (`app/`).
- Global providers (in order): `QueryClientProvider -> PrivacyProvider -> AppProvider -> MapSettingsProvider -> AuthProvider -> OnboardingProvider -> AudioProvider -> MonetizationProvider`.
- App state:
  - `contexts/AppContext.tsx`: GPS status + user preferences.
  - `contexts/AuthContext.tsx`: Supabase auth + OAuth + biometrics.
  - `contexts/AudioContext.tsx`: playback + chunk generation state.
  - `contexts/MonetizationContext.tsx`: RevenueCat + entitlement checks + paywall state.
  - `contexts/MapSettingsContext.tsx`: persisted map behavior.

## 3) High-Value Flows
- Auth + deep links:
  - Deep links handled in `app/_layout.tsx`.
  - Supabase session tokens parsed from URL hash and applied via `supabase.auth.setSession`.
- Map + discovery:
  - Map screen orchestration: `app/map.tsx`.
  - Map rendering/search: `components/map/MapView.tsx` + `hooks/usePlacesSearch.ts`.
  - Places API access goes through Supabase proxy (`supabase/functions/maps-proxy`), not direct client calls.
- Narration + audio:
  - Text/audio orchestration: `services/AttractionInfoService.ts`.
  - Progressive chunk generation: `services/AudioGenerationService.ts`.
  - Chunk playback/buffering/timeline: `services/AudioChunkManager.ts`.
  - TTS chunk splitting heuristics: `services/TTSChunkService.ts`.
  - Main backend narrative function: `supabase/functions/attraction-info/index.ts`.
  - Chunk TTS function: `supabase/functions/generate-audio-chunk/index.ts`.
- Monetization:
  - Active path: `contexts/MonetizationContext.tsx` + `services/MonetizationService.ts`.
  - Native paywall UI component: `components/ui/RevenueCatPaywallModal.tsx`.
  - Access guard used by map flow: `useContentAccess().generateAudioGuideWithValidation`.

## 4) Repo Map (Where To Edit)
- UI routes/screens: `app/`
- Reusable UI: `components/`
- State containers: `contexts/`
- Domain/service logic: `services/`
- Singleton clients/config: `lib/`
- Pure helpers: `utils/`
- Product IDs and feature flags: `config/`
- Supabase (edge functions + migrations): `supabase/`
- Utility/diagnostic scripts: `scripts/`
- Lightweight tests: `tests/`

## 5) Backend + Data Model (Practical)
- Client Supabase instance: `lib/supabase.ts`.
- Common tables/functions used by app services:
  - `user_preferences` (theme, audio_length, voice_style, language, ai_provider, narrative_mode)
  - `user_usage` (usage counters + package limits)
  - `user_subscriptions`
  - `attraction_packages`
  - `user_package_purchases`
  - RPCs such as `get_user_package_entitlements`, `can_user_access_attraction_with_packages`.
- Webhooks / billing:
  - RevenueCat webhook: `supabase/functions/revenuecat-webhook/index.ts`.
  - Receipt verification endpoint: `supabase/functions/verify-receipt/index.ts`.

## 6) Dev Commands (Most Useful)
- Install: `npm ci` (or `npm install`)
- Run app: `npm run start`, `npm run ios`, `npm run android`
- Typecheck: `npx tsc --noEmit`
- Clear cache: `npx expo start --clear`
- Audio diagnostics:
  - `node scripts/test-chunk-generation.js`
  - `node scripts/test-spanish-audio.js`

## 7) Required Env (Common)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- Optional toggles used in code:
  - `EXPO_PUBLIC_ENABLE_OAUTH_PROVIDERS`
  - `EXPO_PUBLIC_PROGRESSIVE_AUDIO`
  - `EXPO_PUBLIC_FF_*` feature flags

## 8) Important Caveats / Legacy Areas
- Active purchase path is `MonetizationContext`; legacy `PurchaseContext` has been removed.
- Entry point in use is Expo Router (`index.ts` / `expo-router/entry`); `index.js` is legacy.
- Supabase functions are excluded from app TypeScript compile (`tsconfig.json` excludes `supabase/functions`).
- Supabase edge functions are guarded by `scripts/check-supabase-functions.js` (syntax + merge-marker checks).
- Keep native/build keys in EAS environment variables and secrets, not tracked config files.

## 9) Quick Task Routing
- “Map behavior/search bug” → `app/map.tsx`, `components/map/MapView.tsx`, `hooks/usePlacesSearch.ts`, `services/GooglePlacesService.ts`, `supabase/functions/maps-proxy/index.ts`
- “Audio generation/playback bug” → `contexts/AudioContext.tsx`, `services/AudioGenerationService.ts`, `services/AudioChunkManager.ts`, `services/AttractionInfoService.ts`, `supabase/functions/attraction-info/*`
- “Paywall/entitlement bug” → `contexts/MonetizationContext.tsx`, `services/MonetizationService.ts`, `components/ui/RevenueCatPaywallModal.tsx`, relevant migrations/functions in `supabase/`
- “Auth/deep-link bug” → `contexts/AuthContext.tsx`, `app/_layout.tsx`, `app/auth/*`
