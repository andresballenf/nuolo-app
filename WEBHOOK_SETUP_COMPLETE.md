# ✅ RevenueCat Webhook Setup - Complete Solution

## Problem Solved

Supabase Edge Functions enforce JWT authentication on ALL incoming requests, blocking RevenueCat webhooks that don't use Bearer tokens. The solution uses a two-layer authentication approach:

1. **Supabase Layer**: Use the public anon key for Supabase authentication
2. **Application Layer**: Use custom `X-RevenueCat-Signature` header for webhook verification

## Current Configuration

### Webhook Endpoint
```
https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook
```

### Authentication Details

**Supabase Authentication** (for all requests):
- Header: `Authorization` or `apikey`
- Value: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kcHBtYnNoa3ViaWNobWJ3dW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MTIyOTgsImV4cCI6MjA1OTA4ODI5OH0.5pNOE6cre5FI6ZrFp0LmayQUZidXZ5KH-KMqaRO3KVA`

**Webhook Signature** (for verification):
- Header: `X-RevenueCat-Signature`
- Value: `507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a`

## RevenueCat Dashboard Configuration

### Step 1: Access Webhook Settings

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your project: **Nuolo**
3. Navigate to **Integrations** → **Webhooks**

### Step 2: Configure Webhook

Click "Add Webhook" or "Edit" existing webhook and configure:

**Basic Settings:**
- **Webhook URL**: `https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook`
- **Environment**: Both Production and Sandbox

**Headers Configuration:**

Add these TWO headers (this is critical):

1. **First Header** (Supabase Auth):
   - Name: `Authorization`
   - Value: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kcHBtYnNoa3ViaWNobWJ3dW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MTIyOTgsImV4cCI6MjA1OTA4ODI5OH0.5pNOE6cre5FI6ZrFp0LmayQUZidXZ5KH-KMqaRO3KVA`

2. **Second Header** (Webhook Signature):
   - Name: `X-RevenueCat-Signature`
   - Value: `507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a`

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
4. Verify response: **200 OK** with `{"received":true}`

## Testing the Webhook

### Manual Test with cURL

```bash
curl -X POST https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kcHBtYnNoa3ViaWNobWJ3dW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MTIyOTgsImV4cCI6MjA1OTA4ODI5OH0.5pNOE6cre5FI6ZrFp0LmayQUZidXZ5KH-KMqaRO3KVA' \
  -H 'X-RevenueCat-Signature: 507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a' \
  -d '{"api_version":"1.0","event":{"type":"INITIAL_PURCHASE","app_user_id":"test-user-123","aliases":[],"original_app_user_id":"test-user-123","product_id":"nuolo_unlimited_monthly","entitlement_ids":["unlimited"],"period_type":"trial","purchased_at_ms":1697472000000,"expiration_at_ms":1700064000000,"environment":"sandbox","presented_offering_id":"default","transaction_id":"test-txn","original_transaction_id":"test-txn","is_trial_conversion":false,"store":"APP_STORE","takehome_percentage":0.7,"price":9.99,"currency":"USD","tax_percentage":0,"commission_percentage":0.3}}'
```

**Expected Response**: `{"received":true}`

### View Webhook Logs

**Supabase Dashboard**:
1. Go to [Supabase Functions](https://supabase.com/dashboard/project/odppmbshkubichmbwunl/functions)
2. Click **revenuecat-webhook**
3. Click **Logs** tab

**Expected Success Logs**:
```
[DEBUG] Signature found: Yes
[SUCCESS] Webhook signature verified
[WEBHOOK] Received event: INITIAL_PURCHASE
[SUCCESS] Updated subscription for user test-user-123
```

**RevenueCat Dashboard**:
1. Go to webhook configuration
2. Scroll to **"Recent Deliveries"**
3. Check status: **200 OK**

## Troubleshooting

### Error: "Missing authorization header"

**Cause**: Request doesn't include Supabase auth token

**Solution**: Make sure `Authorization` header is set with the Bearer token in RevenueCat webhook configuration

### Error: "Invalid signature"

**Cause**: X-RevenueCat-Signature doesn't match the configured secret

**Solution**:
1. Verify the secret in Supabase:
   ```bash
   npx supabase secrets list | grep REVENUECAT_WEBHOOK_SECRET
   ```
2. Update RevenueCat webhook configuration with matching value

### Error: "Unknown error"

**Cause**: Database tables don't exist or there's an error processing the event

**Solution**:
1. Apply database migration:
   ```bash
   npx supabase db push
   ```
2. Check function logs for specific error details

### Webhook Not Receiving Events

**Checklist**:
- [ ] Webhook URL is correct
- [ ] Both headers are configured in RevenueCat
- [ ] Event types are selected
- [ ] Configuration is saved
- [ ] Function is deployed (Version 9 or later)

## Maintenance

### Rotating the Webhook Secret

If you need to change the webhook secret:

1. Generate new secret:
   ```bash
   NEW_SECRET=$(openssl rand -hex 32)
   echo "New secret: $NEW_SECRET"
   ```

2. Update Supabase:
   ```bash
   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET="$NEW_SECRET"
   ```

3. Update RevenueCat webhook configuration:
   - Change `X-RevenueCat-Signature` header value to the new secret

4. Test the webhook

### Updating the Webhook Function

1. Make changes to `supabase/functions/revenuecat-webhook/index.ts`
2. Deploy:
   ```bash
   npx supabase functions deploy revenuecat-webhook
   ```
3. Test with RevenueCat "Send Test Event"

## Technical Details

### How It Works

1. **Request arrives** at Supabase Edge Functions
2. **Supabase validates** the `Authorization` header (anon key)
3. **Request passes** to our function code
4. **Function validates** the `X-RevenueCat-Signature` header
5. **Function processes** the webhook event
6. **Database updated** with subscription/purchase data

### Security

- **Two-layer authentication**: Both Supabase and custom signature required
- **Signature validation**: Simple string comparison (RevenueCat doesn't use HMAC)
- **Public anon key**: Safe to expose (has limited permissions)
- **Webhook secret**: Keep private, only share with RevenueCat

### Event Handling

The webhook handles these event types:

- `INITIAL_PURCHASE`: Creates subscription or package purchase record
- `RENEWAL`: Updates subscription expiration date
- `CANCELLATION`: Sets auto_renew to false
- `EXPIRATION`: Deactivates subscription
- `BILLING_ISSUE`: Logs billing problems
- `PRODUCT_CHANGE`: Updates subscription type on upgrade/downgrade
- `NON_RENEWING_PURCHASE`: Records one-time package purchases

## Quick Reference

**Project**: Nuolo
**Function**: revenuecat-webhook (Version 9)
**Webhook URL**: `https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook`
**Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kcHBtYnNoa3ViaWNobWJ3dW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1MTIyOTgsImV4cCI6MjA1OTA4ODI5OH0.5pNOE6cre5FI6ZrFp0LmayQUZidXZ5KH-KMqaRO3KVA`
**Webhook Secret**: `507752e1a667f37812218f0f4396579f0eb07a789263a02528a9e58fd0a8cf8a`

## Success Criteria

✅ Webhook endpoint accessible
✅ Supabase authentication working
✅ Custom signature validation working
✅ Test events return 200 OK
✅ Events processed and logged
✅ Database records created/updated

---

**Last Updated**: October 14, 2025
**Status**: ✅ WORKING
**Version**: 9
