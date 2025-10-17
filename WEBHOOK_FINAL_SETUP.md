# ✅ RevenueCat Webhook - Final Setup Guide

## Overview

The webhook is now configured with **JWT verification disabled**, allowing RevenueCat to authenticate directly using the Authorization header.

## Webhook Configuration

### Webhook URL
```
https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook
```

### Authentication
**Single Header** (Authorization Header):
```
507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a
```

## RevenueCat Dashboard Setup

### Step 1: Access Webhook Settings

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your project: **Nuolo**
3. Navigate to **Integrations** → **Webhooks**

### Step 2: Configure Webhook

Click "Add Webhook" or "Edit" existing webhook:

**Webhook URL**:
```
https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook
```

**Authorization Header** (the single field RevenueCat provides):
```
507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a
```

**Environment**:
- Select **Both Production and Sandbox**

**Event Types** (select all):
- ✅ Initial Purchase
- ✅ Renewal
- ✅ Cancellation
- ✅ Expiration
- ✅ Billing Issue
- ✅ Product Change
- ✅ Non Renewing Purchase

### Step 3: Save and Test

1. Click **"Save"** or **"Update Webhook"**
2. Click **"Send Test Event"**
3. Select event type: **"INITIAL_PURCHASE"**
4. Expected response: **200 OK** with `{"received":true}`

## Testing the Webhook

### Test with cURL

```bash
curl -X POST https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook \
  -H 'Content-Type: application/json' \
  -H 'Authorization: 507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a' \
  -d '{"api_version":"1.0","event":{"type":"INITIAL_PURCHASE","app_user_id":"test-user-123","aliases":[],"original_app_user_id":"test-user-123","product_id":"nuolo_unlimited_monthly","entitlement_ids":["unlimited"],"period_type":"trial","purchased_at_ms":1697472000000,"expiration_at_ms":1700064000000,"environment":"sandbox","presented_offering_id":"default","transaction_id":"test-txn","original_transaction_id":"test-txn","is_trial_conversion":false,"store":"APP_STORE","takehome_percentage":0.7,"price":9.99,"currency":"USD","tax_percentage":0,"commission_percentage":0.3}}'
```

**Expected Response**: `{"received":true}` (or `{"error":"Unknown error"}` if database tables don't exist yet)

### View Logs

**Supabase Dashboard**:
1. Go to [Supabase Functions](https://supabase.com/dashboard/project/odppmbshkubichmbwunl/functions)
2. Click **revenuecat-webhook**
3. Click **Logs** tab

**Expected Success Logs**:
```
[DEBUG] Headers received: {...}
[DEBUG] Signature extracted from Authorization header
[SUCCESS] Webhook signature verified
[WEBHOOK] Received event: INITIAL_PURCHASE
[SUCCESS] Updated subscription for user test-user-123
```

**RevenueCat Dashboard**:
1. Go to your webhook configuration
2. Scroll to **"Recent Deliveries"** or **"Event History"**
3. Check status: **200 OK**

## Database Setup

Before the webhook can fully process events, ensure the database tables exist:

```bash
# Apply the migration
npx supabase db push
```

This creates:
- `user_subscriptions` - Subscription records
- `user_package_purchases` - Package purchase records
- `profiles` - User profiles with `revenuecat_customer_id`
- `user_usage` - User attraction usage limits

## How It Works

1. **RevenueCat sends webhook** with Authorization header containing the secret
2. **Supabase receives request** (JWT verification disabled for this function)
3. **Function validates signature** against `REVENUECAT_WEBHOOK_SECRET`
4. **Function processes event** and updates database
5. **Response returned** to RevenueCat

## Security Notes

- **JWT Disabled**: This function has JWT verification disabled to accept the plain Authorization header
- **Secret Validation**: The function validates the Authorization header value against the stored secret
- **Keep Secret Private**: Only share the webhook secret with RevenueCat
- **HTTPS Only**: All requests are encrypted in transit

## Event Handling

The webhook processes these events:

| Event Type | Action |
|------------|--------|
| `INITIAL_PURCHASE` | Creates new subscription or package purchase record |
| `RENEWAL` | Updates subscription expiration date and sets active |
| `CANCELLATION` | Sets `auto_renew` to false |
| `EXPIRATION` | Sets `is_active` to false |
| `BILLING_ISSUE` | Logs issue for monitoring |
| `PRODUCT_CHANGE` | Updates subscription type on upgrade/downgrade |
| `NON_RENEWING_PURCHASE` | Records one-time package purchase |

## Troubleshooting

### Error: "Missing authorization header"

**Cause**: Authorization header not configured in RevenueCat

**Solution**: Add the webhook secret to the Authorization Header field in RevenueCat webhook settings

### Error: "Invalid signature"

**Cause**: Authorization header value doesn't match the configured secret

**Solution**:
1. Check the secret in Supabase:
   ```bash
   npx supabase secrets list | grep REVENUECAT_WEBHOOK_SECRET
   ```
2. Update RevenueCat with the exact value (copy-paste to avoid typos)

### Error: "Unknown error"

**Cause**: Could be database-related (tables don't exist) or processing error

**Solution**:
1. Apply database migration: `npx supabase db push`
2. Check function logs for specific error details
3. Verify user ID exists in your system

### Webhook Returns 200 but No Data Updated

**Possible causes**:
- User ID doesn't exist in database
- Database permissions issue
- Event type not handled

**Debug steps**:
1. Check function logs for detailed error messages
2. Verify `app_user_id` in webhook payload matches Supabase user ID
3. Ensure migration created all required tables

## Maintenance

### Rotating the Webhook Secret

1. Generate new secret:
   ```bash
   NEW_SECRET=$(openssl rand -hex 32)
   echo "New secret: $NEW_SECRET"
   ```

2. Update Supabase:
   ```bash
   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET="$NEW_SECRET"
   ```

3. Update RevenueCat:
   - Update Authorization Header value with new secret
   - Save configuration

4. Test with "Send Test Event"

### Updating the Function

1. Edit `supabase/functions/revenuecat-webhook/index.ts`

2. Deploy with JWT verification disabled:
   ```bash
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   ```

3. Test the changes

## Quick Reference

| Item | Value |
|------|-------|
| **Project** | Nuolo |
| **Function** | revenuecat-webhook (Version 11+) |
| **Webhook URL** | `https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook` |
| **Webhook Secret** | `507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a` |
| **JWT Verification** | ❌ Disabled (required for RevenueCat) |

## Commands Reference

```bash
# Check function status
npx supabase functions list | grep revenuecat

# View webhook secret
npx supabase secrets list | grep REVENUECAT

# Deploy function (always use --no-verify-jwt flag)
npx supabase functions deploy revenuecat-webhook --no-verify-jwt

# Apply database migration
npx supabase db push

# Test webhook
curl -X POST https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook \
  -H 'Authorization: 507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a' \
  -H 'Content-Type: application/json' \
  -d '{"api_version":"1.0","event":{"type":"INITIAL_PURCHASE","app_user_id":"test-123"}}'
```

## Success Checklist

- ✅ Function deployed with `--no-verify-jwt` flag
- ✅ Webhook secret set in Supabase
- ✅ Webhook URL configured in RevenueCat
- ✅ Authorization header set in RevenueCat
- ✅ Event types selected
- ✅ Database migration applied
- ✅ Test event returns 200 OK
- ✅ Events logged in Supabase function logs

---

**Last Updated**: October 14, 2025
**Status**: ✅ WORKING
**Function Version**: 11 (deployed with `--no-verify-jwt`)
