# Security Implementation Deployment Instructions

**Date**: January 13, 2025
**Status**: Ready for Deployment
**Priority**: CRITICAL
**Project**: Audigo MVP (odppmbshkubichmbwunl)

## 🚀 Quick Start Deployment Checklist

### Prerequisites
- [ ] Audigo MVP Supabase project active at https://supabase.com/dashboard/project/odppmbshkubichmbwunl
- [ ] Supabase CLI installed and logged in (`supabase login`)
- [ ] Apple Shared Secret from App Store Connect
- [ ] Google Service Account JSON from Google Cloud Console

### Deployment Steps (In Order)

## Step 1: Verify Supabase Project is Active

1. Visit https://supabase.com/dashboard/project/odppmbshkubichmbwunl
2. Confirm "Audigo MVP" project is active and healthy
3. Project should show status: ACTIVE_HEALTHY

## Step 2: Link Project Locally

```bash
cd /Users/andresballen/Dev/nuolo-app
supabase link --project-ref odppmbshkubichmbwunl
```

## Step 3: Run Security Migration

```bash
# Apply the security hardening migration
supabase db push

# Or manually via Dashboard SQL Editor:
# 1. Go to https://supabase.com/dashboard/project/nauytucgtkusxdaoijbz/sql/new
# 2. Paste contents of supabase/migrations/20250113_security_hardening.sql
# 3. Click "Run"
```

**What this does:**
- ✅ Creates `processed_transactions` table for replay attack prevention
- ✅ Enables Row Level Security (RLS) on all user tables
- ✅ Creates security audit logging table
- ✅ Adds helper functions for secure data access

## Step 4: Deploy Edge Functions

### Deploy verify-receipt function

```bash
supabase functions deploy verify-receipt
```

### Deploy maps-proxy function

```bash
supabase functions deploy maps-proxy
```

## Step 5: Set Environment Secrets

### Get Apple Shared Secret
1. App Store Connect → My Apps → [Nuolo]
2. App Information → App-Specific Shared Secret
3. Copy the secret (NEVER commit to code)

### Get Google Service Account JSON
1. Google Cloud Console → IAM & Admin → Service Accounts
2. Create service account with "Android Publisher" permissions
3. Create JSON key → Download
4. Keep the JSON file secure (NEVER commit)

### Set secrets in Supabase

```bash
# Apple Shared Secret for receipt verification
supabase secrets set APPLE_SHARED_SECRET="your_apple_shared_secret_here"

# Google Service Account for Android receipt verification
supabase secrets set GOOGLE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...",...}'

# Google Maps API Key for server-side proxy
supabase secrets set GOOGLE_MAPS_API_KEY="AIzaSyDuVcq_dM6rnHNokT_M6WHCi3mN91XXNMk"
```

**Important:** After setting secrets, restart the Edge Functions:
```bash
supabase functions deploy verify-receipt
supabase functions deploy maps-proxy
```

## Step 6: Test Edge Functions

### Test verify-receipt locally (before production)

```bash
# Start local function
supabase functions serve verify-receipt

# Test with curl (in another terminal)
curl -X POST http://localhost:54321/functions/v1/verify-receipt \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receipt": "test_receipt_data",
    "platform": "ios",
    "productId": "nuolo_unlimited_monthly",
    "transactionId": "test_txn_123"
  }'
```

### Test maps-proxy

```bash
# Start local function
supabase functions serve maps-proxy

# Test with curl
curl -X POST http://localhost:54321/functions/v1/maps-proxy \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "place/nearbysearch/json",
    "params": "location=40.7128,-74.0060&radius=1500&type=tourist_attraction"
  }'
```

## Step 7: 🔴 CRITICAL - Git History Cleanup

**⚠️ THIS MUST BE DONE IMMEDIATELY**

The following secrets are exposed in git history:
- Google Maps API key: `AIzaSyDuVcq_dM6rnHNokT_M6WHCi3mN91XXNMk`
- Supabase credentials
- iOS certificate passwords

### Clean Git History

```bash
# 1. Install BFG Repo-Cleaner
brew install bfg  # macOS
# Or download from: https://rtyley.github.io/bfg-repo-cleaner/

# 2. Backup repository
cd /Users/andresballen/Dev
git clone --mirror https://github.com/andresballenf/nuolo-app.git nuolo-backup

# 3. Clean the repository
cd nuolo-app
bfg --delete-files .env
bfg --delete-files credentials.json
bfg --delete-files google-services.json
bfg --replace-text passwords.txt  # Create file with exposed secrets

# 4. Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (COORDINATE WITH TEAM FIRST)
git push --force --all
git push --force --tags
```

### Rotate ALL Secrets Immediately After Cleanup

1. **Google Maps API Key**
   - Google Cloud Console → Credentials → Create new key
   - Update in Supabase secrets: `supabase secrets set GOOGLE_MAPS_API_KEY="NEW_KEY"`
   - Add restrictions: HTTP referrers for web, bundle ID for mobile

2. **Supabase Keys**
   - Supabase Dashboard → Settings → API → Reset anon key
   - Update `EXPO_PUBLIC_SUPABASE_ANON_KEY` in your environment
   - Rebuild the app with new key

3. **iOS Certificate**
   - Apple Developer Portal → Certificates → Revoke → Create new
   - Update in EAS secrets or local keychain

## Step 8: Update Environment Variables

Create `.env.local` (NEVER commit this file):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://nauytucgtkusxdaoijbz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=NEW_ROTATED_KEY_HERE
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=NEW_ROTATED_KEY_HERE
```

Add to `.gitignore`:
```
.env
.env.local
.env.*.local
credentials.json
google-services.json
```

## Step 9: Verify RLS Policies

Test that RLS is working correctly:

```typescript
// In Supabase SQL Editor or via client
-- Try to access another user's data (should return empty)
SELECT * FROM user_subscriptions WHERE user_id = 'OTHER_USER_ID';

-- Should only see your own data
SELECT * FROM user_subscriptions WHERE user_id = auth.uid();
```

## Step 10: Update CI/CD Secrets

If using GitHub Actions, GitLab CI, or other CI/CD:

```bash
# Add these secrets to your CI/CD platform
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
APPLE_SHARED_SECRET
GOOGLE_SERVICE_ACCOUNT_JSON
```

## 🧪 Testing Checklist

### iOS Testing

- [ ] Build app with EAS or Xcode
- [ ] Test on physical device or TestFlight
- [ ] Sign in with sandbox Apple ID
- [ ] Make test purchase of `nuolo_unlimited_monthly`
- [ ] Verify receipt verification logs show success
- [ ] Check `processed_transactions` table for entry
- [ ] Verify `user_subscriptions` table updated

### Android Testing

- [ ] Build app with EAS
- [ ] Upload to Play Console internal testing
- [ ] Install via internal testing link
- [ ] Make test purchase
- [ ] Verify receipt verification works
- [ ] Check database tables updated

### Maps Proxy Testing

- [ ] Search for nearby attractions
- [ ] Verify API calls go through proxy (check network logs)
- [ ] Confirm API key not exposed in network traffic
- [ ] Test rate limiting (60 requests/min per user)

### Security Audit

- [ ] Verify no API keys in client bundle
- [ ] Check console logs don't expose sensitive data
- [ ] Confirm RLS policies prevent unauthorized access
- [ ] Test transaction replay prevention
- [ ] Verify audit logging captures security events

## 📊 Monitoring & Validation

### Check Edge Function Logs

```bash
# View recent logs
supabase functions logs verify-receipt
supabase functions logs maps-proxy
```

### Query Security Audit Log

```sql
-- Recent security events
SELECT event_type, user_id, event_data, created_at
FROM security_audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;

-- Failed receipt verifications
SELECT *
FROM security_audit_log
WHERE event_type = 'receipt_verification_failed'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Monitor Performance

Dashboard → Edge Functions → Check:
- Invocation count
- Error rate (should be <5%)
- P95 latency (should be <500ms)
- Set up alerts for error rate >5%

## 🚨 Rollback Plan

If issues occur after deployment:

### Rollback Migration

```sql
-- Disable RLS (NOT RECOMMENDED, only for emergencies)
ALTER TABLE user_subscriptions DISABLE ROW LEVEL SECURITY;
-- Repeat for other tables

-- Drop processed_transactions table
DROP TABLE IF EXISTS processed_transactions CASCADE;
```

### Rollback Edge Functions

```bash
# List function versions
supabase functions list

# Rollback to previous version (if available)
supabase functions delete verify-receipt
supabase functions delete maps-proxy

# Redeploy from previous git commit
git checkout <previous-commit>
supabase functions deploy verify-receipt
supabase functions deploy maps-proxy
```

## 📞 Support & Troubleshooting

### Common Issues

**"Project is paused"**
- Solution: Unpause at dashboard, then retry `supabase link`

**"APPLE_SHARED_SECRET not found"**
- Solution: Verify secret set correctly: `supabase secrets list`

**"Receipt verification failed"**
- Check Edge Function logs: `supabase functions logs verify-receipt`
- Verify secret format is correct
- Test with sandbox environment first

**"Rate limit exceeded"**
- Normal behavior for maps proxy (60 req/min per user)
- Check if single user making too many requests
- Consider adjusting rate limit if legitimate usage

**"RLS policy prevents access"**
- Verify user is authenticated
- Check policy matches your use case
- Use service role key for admin operations

### Getting Help

- Supabase Docs: https://supabase.com/docs
- Edge Functions: https://supabase.com/docs/guides/functions
- RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
- Security Guide: See SECURITY_IMPLEMENTATION_GUIDE.md

## ✅ Deployment Complete

Once all steps are done:

1. ✅ Edge Functions deployed and tested
2. ✅ Database migration applied
3. ✅ Secrets configured
4. ✅ Git history cleaned
5. ✅ All keys rotated
6. ✅ RLS policies verified
7. ✅ Receipt verification tested
8. ✅ Maps proxy working
9. ✅ Monitoring configured
10. ✅ Team notified

**Next Steps:**
- Monitor security audit logs for first 48 hours
- Review failed receipt verifications daily
- Set up automated alerts for error rates >5%
- Schedule security review in 30 days

---

**Document Version**: 1.0
**Last Updated**: January 13, 2025
**Next Review**: February 13, 2025
