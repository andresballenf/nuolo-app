# How to Enable OAuth for Development Build

## Current Status
OAuth imports are currently **commented out** to allow the app to run in Expo Go.

## To Enable OAuth (for Development Builds):

### 1. Edit `/contexts/AuthContext.tsx`

Replace lines 9-26 with:
```typescript
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';

// This helps close the browser session after authentication
WebBrowser.maybeCompleteAuthSession();

// OAuth features are enabled in development build
const isExpoGo = false;
```

Remove the stub variables (lines 16-20):
```typescript
// DELETE THESE LINES:
const AuthSession: any = null;
const WebBrowser: any = null;
const Crypto: any = null;
const AppleAuthentication: any = null;
```

### 2. Create Development Build

```bash
# For iOS (Mac required)
npx expo run:ios

# For Android
npx expo run:android
```

### 3. Configure Supabase Dashboard

1. Go to Authentication → Providers
2. Enable Google and Apple providers
3. Add required credentials (see OAUTH_SETUP.md)

## Why This Is Necessary

Expo Go doesn't include the native modules required for OAuth authentication. These libraries:
- `expo-auth-session`
- `expo-web-browser`
- `expo-crypto`
- `expo-apple-authentication`

Must be compiled into your app binary, which requires a development build.

## Testing in Expo Go

While OAuth won't work in Expo Go, all other features of the app will continue to function normally. Users attempting to use OAuth in Expo Go will see a helpful error message.