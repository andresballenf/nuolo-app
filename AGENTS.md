# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds Expo Router routes; keep feature state near its owning screen.
- Shared UI and state live in `components/`, `hooks/`, and `contexts/`; extend existing patterns when adding flows.
- Business logic resides in `services/`, while singletons stay in `lib/` and pure helpers in `utils/`.
- Store media in `assets/`, backend artifacts in `supabase/`, and deployment notes in `docs/`.

## Build, Test, and Development Commands
- `npm install` (or `npm ci`) respects the tracked `package-lock.json`; re-run after pulling dependency updates.
- `npm run start` launches Metro; `npm run ios`, `npm run android`, and `npm run web` target specific runtimes.
- Clear caches with `npx expo start --clear`, and gate merges with `npx tsc --noEmit`.
- `node test-chunk-generation.js` and `node test-spanish-audio.js` cover audio regressions; rerun after editing `services/Audio*` or related contexts.
- Ship builds through `npx eas build --platform ios --profile production`; consult `BUILD_COMMANDS.md` before altering credentials.

## Coding Style & Naming Conventions
- Write TypeScript with explicit interfaces and enums; avoid `any` and untyped external data.
- Keep two-space indentation, trailing commas, and grouped imports (`react`, third-party, local).
- Name components in PascalCase, hooks with the `use` prefix, and context wrappers as `SomethingProvider`.
- Co-locate styles and small helpers with their component; promote widely reused tokens to `config/`.

## Testing Guidelines
- No formal test runner yet—manual coverage plus audio scripts act as the regression suite.
- Add new diagnostic scripts beside the existing ones with a descriptive suffix and a usage comment.
- When introducing Jest or RTL, place specs next to source files (`FeatureCard.test.tsx`) and update this guide.
- Log exploratory notes or gaps in `CURRENT_STATUS.md` so other agents can continue the thread.

## Commit & Pull Request Guidelines
- Follow the repo’s imperative, Title-Case subject line convention (e.g., `Tighten Supabase Session Handling`).
- List user-facing changes before technical notes, and link issues with `Fixes #id` when applicable.
- Include commands executed, platform screenshots, and any new config keys in the PR description.
- Request a Supabase-savvy reviewer before merging updates to `lib/supabase.ts` or anything under `supabase/`.

## Security & Configuration Tips
- Keep secrets out of version control; push updates with `npx eas secret:push` and list requirements in `README.md`.
- Validate OAuth, purchases, and Supabase roles in staging before toggling production flags; capture findings in `SECURITY_IMPLEMENTATION_STATUS.md`.
- Rotate Apple credentials with `setup-ios-credentials.sh` when accounts change.
