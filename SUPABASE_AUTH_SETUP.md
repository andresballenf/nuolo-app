# Supabase Authentication Configuration

## Required Redirect URLs

To enable email verification, password reset, and OAuth authentication, add the following redirect URLs to your Supabase project:

### 1. Navigate to Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Scroll to **Redirect URLs** section

### 2. Add These URLs

Add each of the following URLs to the allowed redirect URLs list:

#### Email Verification (Signup)
```
nuolo://auth/confirm
com.nuolo.app://auth/confirm
```

#### Password Reset
```
nuolo://auth/update-password
com.nuolo.app://auth/update-password
```

#### OAuth Callback (Google/Apple Sign In)
```
nuolo://auth/callback
com.nuolo.app://auth/callback
```

### 3. Site URL Configuration

Set the **Site URL** to:
```
nuolo://
```

### 4. Testing Deep Links

After configuration, test each authentication flow:

#### Test Email Verification
1. Sign up with a new email
2. Check email inbox
3. Click verification link
4. App should open to `/auth/confirm` with token
5. User should be verified and redirected to `/map`

#### Test Password Reset
1. Click "Forgot Password" on login screen
2. Enter email and submit
3. Check email inbox
4. Click reset link
5. App should open to `/auth/update-password` with token
6. Enter new password
7. Should redirect to login screen

#### Test OAuth
1. Click "Sign in with Google" or "Sign in with Apple"
2. Complete OAuth flow in browser/native UI
3. App should open to `/map` with active session

## Troubleshooting

### Deep Link Not Opening App
- Verify URL schemes in `app.json` match the redirect URLs
- Rebuild the app after changing `app.json`
- Check iOS Simulator/Device logs for deep link errors

### "Invalid Redirect URL" Error
- Ensure all URLs are added to Supabase dashboard
- URLs are case-sensitive and must match exactly
- No trailing slashes

### OAuth Not Working
- Verify OAuth provider is enabled in Supabase Authentication settings
- For Apple Sign In: ensure `usesAppleSignIn: true` in `app.json`
- For Google: configure OAuth client ID in Supabase dashboard

## Current Implementation

The app uses custom URL schemes (`nuolo://` and `com.nuolo.app://`) for deep linking. These work on both iOS and Android without requiring a domain.

### Deep Link Handler
Location: `app/_layout.tsx:34-80`

Handles:
- Email confirmation: `nuolo://auth/confirm?token_hash=XXX&type=email`
- Password reset: `nuolo://auth/update-password?token_hash=XXX&type=recovery`
- OAuth callback: `nuolo://auth/callback?access_token=XXX&refresh_token=XXX`

### URL Scheme Configuration
Location: `app.json`

iOS (lines 32-39):
```json
"CFBundleURLTypes": [
  {
    "CFBundleURLSchemes": [
      "com.nuolo.app",
      "nuolo"
    ]
  }
]
```

Android (lines 49-62):
```json
"intentFilters": [
  {
    "action": "VIEW",
    "data": [
      { "scheme": "nuolo" },
      { "scheme": "com.nuolo.app" }
    ],
    "category": ["BROWSABLE", "DEFAULT"]
  }
]
```
