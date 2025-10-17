# RevenueCat Webhook Troubleshooting Guide

## Current Status

✅ Webhook function deployed: `revenuecat-webhook` (Version 5)
✅ Webhook secret configured: `REVENUECAT_WEBHOOK_SECRET`

## Common Issues & Solutions

### 1. Webhook URL Not Configured in RevenueCat

**Check**: Go to RevenueCat Dashboard → Project → Integrations → Webhooks

**Correct URL Format**:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/revenuecat-webhook
```

**Steps to Configure**:
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to your project
3. Click "Integrations" in the left sidebar
4. Click "Webhooks"
5. Click "Add Webhook"
6. Enter the webhook URL above
7. ⚠️ **IMPORTANT**: Add a **Custom Header** (NOT Authorization Header):
   - **Header Name**: `X-RevenueCat-Signature`
   - **Header Value**: `YOUR_WEBHOOK_SECRET`
8. Select event types to receive:
   - ✅ Initial Purchase
   - ✅ Renewal
   - ✅ Cancellation
   - ✅ Expiration
   - ✅ Billing Issue
   - ✅ Product Change
   - ✅ Non Renewing Purchase
9. Save the webhook

**Why Custom Header?**
The error `"Auth header is not 'Bearer {token}'"` occurs when using the Authorization header.
Supabase Edge Functions expect `Authorization: Bearer {token}` format, but RevenueCat sends plain values.
Using a custom header (`X-RevenueCat-Signature`) solves this conflict.

### 2. Authorization Header Error (FIXED)

**Issue**: Getting error `"Auth header is not 'Bearer {token}'"`

**Root Cause**: Supabase Edge Functions require `Authorization: Bearer {token}` format, but RevenueCat sends webhook secrets as plain values.

**Solution**: Use a **Custom Header** instead of Authorization Header in RevenueCat:

1. In RevenueCat webhook configuration, remove any Authorization Header
2. Add a **Custom Header**:
   - Name: `X-RevenueCat-Signature`
   - Value: Your webhook secret

3. **Check webhook secret matches**:
   ```bash
   npx supabase secrets list | grep REVENUECAT
   ```
   The secret in Supabase must EXACTLY match the custom header value in RevenueCat.

2. **Test with RevenueCat's "Send Test Event"**:
   - In RevenueCat webhook configuration
   - Click "Send Test Event"
   - Check Supabase logs immediately after

3. **View function logs**:
   ```bash
   # Real-time logs (keep running)
   npx supabase functions serve revenuecat-webhook

   # Or check recent invocations in Supabase Dashboard
   # Dashboard → Edge Functions → revenuecat-webhook → Logs
   ```

### 3. CORS or Authentication Issues

**Issue**: Webhook might be blocked by CORS or missing authentication.

**Solution**: The webhook implementation already handles CORS properly. Check if:

1. **Service Role Key is set** (automatically set by Supabase):
   ```bash
   npx supabase secrets list | grep SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Supabase URL is correct**:
   ```bash
   npx supabase secrets list | grep SUPABASE_URL
   ```

### 4. Database Tables Don't Exist

**Issue**: Webhook tries to insert into `user_subscriptions` or `user_package_purchases` but tables don't exist.

**Solution**: Run the database migration:

```bash
# Check if migration was applied
npx supabase db remote commit

# Apply the migration
npx supabase db push

# Or manually check tables exist
npx supabase db diff
```

**Required Tables**:
- `user_subscriptions` - stores subscription data
- `user_package_purchases` - stores package purchase data
- `profiles` - stores user data with `revenuecat_customer_id` column
- `user_usage` - stores user attraction usage limits

### 5. User ID Mismatch

**Issue**: RevenueCat `app_user_id` doesn't match Supabase user UUID.

**Debug**:
1. Make a test purchase
2. Check what `app_user_id` RevenueCat sends in the webhook
3. Compare with your Supabase user ID

**Solution**: Ensure you're calling `monetizationService.setUserId(user.id)` when user logs in.

Check in `contexts/MonetizationContext.tsx`:
```typescript
useEffect(() => {
  if (isAuthenticated && user) {
    monetizationService.setUserId(user.id); // ← Should use Supabase user.id
  }
}, [isAuthenticated, user]);
```

### 6. Webhook Not Receiving Events

**Checklist**:

- [ ] Webhook URL is correct and accessible
- [ ] Authorization header matches webhook secret
- [ ] Event types are selected in RevenueCat
- [ ] Test event sent from RevenueCat dashboard
- [ ] Function is deployed (check `npx supabase functions list`)
- [ ] Function has no deployment errors
- [ ] RevenueCat API keys are configured in app
- [ ] You've made a test purchase (sandbox or production)

## Testing the Webhook

### Step 1: Send Test Event from RevenueCat

1. Go to RevenueCat Dashboard → Integrations → Webhooks
2. Find your webhook
3. Click "Send Test Event"
4. Choose event type: "INITIAL_PURCHASE"
5. Click "Send"

### Step 2: Check Supabase Logs

**Via Dashboard**:
1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Click on `revenuecat-webhook`
4. Click "Logs" tab
5. Look for recent invocations

**Via CLI** (real-time monitoring):
```bash
# Start local development server to see logs
npx supabase functions serve revenuecat-webhook

# In another terminal, make a test purchase or send test event
```

### Step 3: Make a Test Purchase

1. Build development version:
   ```bash
   npx expo run:ios
   ```

2. Sign in with a test user

3. Make a test purchase using StoreKit configuration

4. Check webhook logs immediately after purchase

## Debugging Commands

```bash
# Check function deployment status
npx supabase functions list

# View all secrets
npx supabase secrets list

# Check database tables exist
npx supabase db remote commit

# View real-time function logs (run in separate terminal)
npx supabase functions serve revenuecat-webhook

# Redeploy webhook function
npx supabase functions deploy revenuecat-webhook

# Check Supabase project status
npx supabase status
```

## Expected Log Output (Success)

```
[WEBHOOK] Received event: INITIAL_PURCHASE
[SUCCESS] Updated subscription for user abc-123-def-456
```

## Expected Log Output (Errors)

**Missing Signature**:
```
[SECURITY] Missing webhook signature
```
→ Check RevenueCat webhook configuration has Authorization header

**Invalid Signature**:
```
[SECURITY] Invalid webhook signature
```
→ Webhook secret doesn't match. Update in RevenueCat or Supabase.

**Database Error**:
```
[ERROR] Failed to update subscription: { error details }
```
→ Check database tables exist and migration was applied

**Missing Environment Variable**:
```
[ERROR] REVENUECAT_WEBHOOK_SECRET not configured
```
→ Set webhook secret: `npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=your_secret`

## Manual Testing with cURL

You can test the webhook endpoint directly:

```bash
# Get your project URL
PROJECT_URL="https://YOUR_PROJECT_ID.supabase.co"
WEBHOOK_SECRET="your_webhook_secret_here"

# Create test payload
PAYLOAD='{"api_version":"1.0","event":{"type":"TEST","app_user_id":"test-user-123","product_id":"nuolo_unlimited_monthly","purchased_at_ms":1234567890000}}'

# Calculate HMAC signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')

# Send test request
curl -X POST "$PROJECT_URL/functions/v1/revenuecat-webhook" \
  -H "Content-Type: application/json" \
  -H "X-RevenueCat-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

Expected response: `{"received":true}`

## Quick Fix Checklist

Try these in order:

1. **Verify webhook URL is configured in RevenueCat**
   - Must be: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/revenuecat-webhook`

2. **Verify webhook secret matches**
   ```bash
   npx supabase secrets list | grep REVENUECAT
   ```
   - Must match Authorization Header in RevenueCat exactly

3. **Send test event from RevenueCat**
   - Dashboard → Integrations → Webhooks → Send Test Event

4. **Check logs immediately**
   - Dashboard → Edge Functions → revenuecat-webhook → Logs

5. **Verify database tables exist**
   ```bash
   npx supabase db push
   ```

6. **Make a real test purchase**
   - Build with: `npx expo run:ios`
   - Use StoreKit test account

## Still Not Working?

**Get detailed webhook response from RevenueCat**:
1. Go to RevenueCat Dashboard
2. Integrations → Webhooks
3. Click on your webhook
4. Scroll to "Recent Deliveries"
5. Check the response status and body

**Common response codes**:
- `200` - Success ✅
- `401` - Signature validation failed ❌
- `500` - Server error (check function logs) ❌
- `timeout` - Function took too long or URL unreachable ❌

## Need More Help?

Check these resources:
- [RevenueCat Webhook Documentation](https://docs.revenuecat.com/docs/webhooks)
- [Supabase Edge Functions Logs](https://supabase.com/dashboard/project/_/functions)
- [RevenueCat Community](https://community.revenuecat.com/)

## Contact Information

If webhook is still not working after following all steps:
1. Check RevenueCat "Recent Deliveries" for error details
2. Export Supabase function logs
3. Verify database schema matches migration
4. Test with cURL to isolate the issue
