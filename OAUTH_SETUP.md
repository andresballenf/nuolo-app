# OAuth Setup Instructions for Nuolo App

## Implementation Complete ✅

The OAuth authentication code has been successfully implemented in your React Native app with:
- **Native Apple Sign-In** on iOS using `expo-apple-authentication` (recommended by Supabase)
- **OAuth flow for Google** using `expo-auth-session`
- Both providers support **automatic sign-up and sign-in** - new users will have accounts created, and existing users will be signed in.

## Manual Configuration Required

### 1. Configure OAuth in Supabase Dashboard

You need to manually configure the OAuth providers in your Supabase project:

#### Google OAuth Setup

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (Audigo MVP)
3. Navigate to **Authentication** → **Providers**
4. Find **Google** in the list and click to expand
5. Enable Google provider
6. You'll need to add:
   - **Client ID** (from Google Cloud Console)
   - **Client Secret** (from Google Cloud Console)

#### Getting Google Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth Client ID**
5. Choose **Web application** type
6. Add authorized redirect URI: `https://[YOUR-PROJECT-ID].supabase.co/auth/v1/callback`
7. Copy the Client ID and Client Secret to Supabase

#### Apple OAuth Setup

1. In Supabase Dashboard, find **Apple** provider
2. Enable Apple provider
3. You'll need:
   - **Services ID** (from Apple Developer Portal)
   - **Secret Key** (generated from Apple Developer Portal)

#### Getting Apple Credentials

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Register an App ID with Sign in with Apple capability
3. Create a Services ID
4. Configure the Services ID with your redirect URL
5. Generate a private key for Sign in with Apple
6. Add these to Supabase Dashboard

### 2. Create a Development Build

OAuth authentication **will NOT work** in Expo Go. You must create a development build:

#### For iOS (Mac required):
```bash
npx expo run:ios
```

#### For Android:
```bash
npx expo run:android
```

#### Or use EAS Build (recommended for team development):
```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Configure your project
eas build:configure

# Create a development build
eas build --profile development --platform ios
eas build --profile development --platform android
```

### 3. Test the Implementation

Once you have:
1. ✅ Configured OAuth providers in Supabase Dashboard
2. ✅ Created a development build
3. ✅ Installed the app on a device/simulator

You can test by:
1. Opening the app
2. Going to the login/signup screen
3. Tapping on "Google" or "Apple" buttons
4. Following the OAuth flow
5. Being redirected back to your app

## Redirect URL Configuration

The app is configured to use the following redirect schemes:
- **iOS**: `nuolo://auth` and `com.nuolo.app://auth`
- **Android**: `nuolo://auth` and `com.nuolo.app://auth`

These are already configured in your `app.json`.

## Troubleshooting

### Common Issues:

1. **"OAuth doesn't work in Expo Go"**
   - Solution: Create a development build using `expo run:ios` or `expo run:android`

2. **"Authentication failed" error**
   - Check that OAuth providers are enabled in Supabase Dashboard
   - Verify Client ID and Secret are correctly entered
   - Ensure redirect URLs match

3. **Apple Sign-In only shows on iOS**
   - This is intentional - Apple Sign-In button only appears on iOS devices

4. **Google Sign-In not working on iOS**
   - Make sure you've added the URL schemes to app.json (already done)
   - Ensure Google OAuth is properly configured in Supabase

## Next Steps

1. Configure OAuth providers in Supabase Dashboard (manual step)
2. Create a development build
3. Test OAuth flow on real devices
4. Consider adding more OAuth providers (Facebook, Twitter, etc.) if needed

## Important Notes

- The implementation automatically handles both sign-up and sign-in
- User profiles are created automatically for new OAuth users
- The app extracts name and avatar from OAuth providers when available
- Sessions are persisted using AsyncStorage