# Supabase Email & Deep Link Configuration Guide

This guide documents the setup required for email authentication and deep linking to work properly in the Nuolo iOS app.

## 🔧 Supabase Dashboard Configuration

### 1. Navigate to Authentication Settings

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **Audigo MVP** (`odppmbshkubichmbwunl`)
3. Navigate to **Authentication** → **URL Configuration**

### 2. Configure Redirect URLs

Add the following URLs to the **Redirect URLs** section:

```
nuolo://**
com.nuolo.app://**
```

**Why these URLs?**
- `nuolo://` is the custom URL scheme defined in `app.json`
- `com.nuolo.app://` is the bundle identifier scheme for iOS
- The `**` wildcard allows any path after the scheme

### 3. Verify Site URL

Ensure the **Site URL** is set appropriately:
- For development: Can be left as default or set to your local URL
- For production: Should be your production domain (when you have one)

### 4. Check Email Templates

Navigate to **Authentication** → **Email Templates** and verify:

#### Confirm Signup Template
Should contain:
```html
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
```

#### Reset Password Template
Should contain:
```html
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

**Important**: The `{{ .ConfirmationURL }}` variable will automatically include the `redirectTo` parameter we set in the code.

### 5. Email Delivery Settings

Navigate to **Project Settings** → **Auth** → **SMTP Settings**

Verify email delivery is configured:
- **Using Supabase SMTP** (default): No additional configuration needed
- **Custom SMTP**: Ensure your SMTP credentials are correct

## 📱 Deep Link Flow

### Sign Up Email Verification Flow

1. User signs up with email/password
2. `AuthContext.signUp()` calls Supabase with `emailRedirectTo: 'nuolo://auth/confirm'`
3. Supabase sends confirmation email with link like:
   ```
   https://odppmbshkubichmbwunl.supabase.co/auth/v1/verify?token=HASH&type=email&redirect_to=nuolo://auth/confirm
   ```
4. User clicks link in email
5. Supabase verifies token and redirects to: `nuolo://auth/confirm?token_hash=HASH&type=email`
6. iOS opens Nuolo app via deep link
7. `app/_layout.tsx` handles deep link and routes to `/auth/confirm`
8. `/auth/confirm` screen calls `supabase.auth.verifyOtp()` to complete verification
9. User is logged in and redirected to `/map`

### Password Reset Flow

1. User requests password reset
2. `AuthContext.resetPassword()` calls Supabase with `redirectTo: 'nuolo://auth/reset-password'`
3. Supabase sends reset email with link like:
   ```
   https://odppmbshkubichmbwunl.supabase.co/auth/v1/verify?token=HASH&type=recovery&redirect_to=nuolo://auth/reset-password
   ```
4. User clicks link in email
5. Supabase verifies token and redirects to: `nuolo://auth/reset-password?token_hash=HASH&type=recovery`
6. iOS opens Nuolo app via deep link
7. `app/_layout.tsx` handles deep link and routes to `/auth/update-password`
8. `/auth/update-password` screen calls `supabase.auth.verifyOtp()` to verify reset token
9. User enters new password
10. Screen calls `supabase.auth.updateUser({ password })` to update password
11. User is redirected to login

## 🧪 Testing

### Test Email Verification

1. Sign up with a new email address
2. Check email inbox (including spam folder)
3. Click verification link
4. App should open automatically (if installed)
5. Verify email confirmation screen appears
6. Should redirect to map screen after success

### Test Password Reset

1. Go to "Forgot Password" screen
2. Enter email address
3. Check email inbox (including spam folder)
4. Click reset password link
5. App should open automatically (if installed)
6. Update password screen should appear
7. Enter and confirm new password
8. Should redirect to login screen after success

## 🐛 Troubleshooting

### Emails Not Arriving

1. **Check Spam Folder**: Email providers may flag authentication emails
2. **Verify SMTP Settings**: Go to Project Settings → Auth → SMTP Settings
3. **Check Rate Limits**: Supabase has rate limits on email sending
4. **Review Logs**: Check Supabase logs for email delivery errors

### Deep Links Not Working

1. **Verify URL Scheme**: Check `app.json` has `"scheme": "nuolo"`
2. **Check iOS Info.plist**: Verify `CFBundleURLSchemes` includes `nuolo` and `com.nuolo.app`
3. **Rebuild App**: Deep link changes require app rebuild
4. **Test URL Manually**: Use Safari to test: `nuolo://auth/confirm?test=true`
5. **Check Logs**: Console logs will show deep link events

### Invalid or Expired Token

1. **Token Expiration**: Reset tokens expire after 1 hour by default
2. **Single Use**: Tokens can only be used once
3. **Request New Link**: If expired, user must request new reset email

## 📝 Code References

- Deep link handler: `app/_layout.tsx:34-80`
- Sign up with redirect: `contexts/AuthContext.tsx:517-524`
- Password reset with redirect: `contexts/AuthContext.tsx:794-799`
- Email verification screen: `app/auth/confirm.tsx`
- Password update screen: `app/auth/update-password.tsx`

## ✅ Checklist

Before deploying to production:

- [ ] Redirect URLs configured in Supabase dashboard
- [ ] Site URL set correctly
- [ ] Email templates verified
- [ ] SMTP settings configured (if using custom SMTP)
- [ ] Test email verification flow on device
- [ ] Test password reset flow on device
- [ ] Deep links work when app is closed
- [ ] Deep links work when app is open
- [ ] Email delivery is reliable
- [ ] Links don't expire too quickly for users

## 🔐 Security Notes

- Tokens are single-use and expire after 1 hour
- Deep links use HTTPS redirect through Supabase first
- Token hashes (not plain tokens) are sent via deep link
- Supabase handles token verification server-side
- Sessions are properly managed after verification
