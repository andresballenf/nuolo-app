# 🔧 RevenueCat Webhook Fix - Quick Setup

## ✅ What Was Fixed

The error `{"code":401,"message":"Auth header is not 'Bearer {token}'"}` has been resolved.

**Problem**: Supabase Edge Functions expect `Authorization: Bearer {token}` format, but RevenueCat sends webhook secrets as plain values.

**Solution**: Use a custom header (`X-RevenueCat-Signature`) instead of the Authorization header.

## 🚀 Setup Instructions (5 minutes)

### Step 1: Go to RevenueCat Dashboard

1. Open [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to your project
3. Go to **Integrations** → **Webhooks**

### Step 2: Configure the Webhook

**If you already have a webhook configured:**
1. Click "Edit" on your existing webhook
2. Remove any value from the "Authorization Header" field (leave it blank)
3. Scroll to **Custom Headers** section
4. Add a new custom header:
   - **Header Name**: `X-RevenueCat-Signature`
   - **Header Value**: `b353291a13ede259af5f9433e627b0254df7e362b1cde3b24f91d4a7240a5f3d`

**If you need to create a new webhook:**
1. Click "Add Webhook"
2. Enter **Webhook URL**:
   ```
   https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook
   ```
3. Leave "Authorization Header" **BLANK**
4. Scroll to **Custom Headers** section
5. Add a new custom header:
   - **Header Name**: `X-RevenueCat-Signature`
   - **Header Value**: `b353291a13ede259af5f9433e627b0254df7e362b1cde3b24f91d4a7240a5f3d`

### Step 3: Select Event Types

Make sure these events are **checked**:
- ✅ Initial Purchase
- ✅ Renewal
- ✅ Cancellation
- ✅ Expiration
- ✅ Billing Issue
- ✅ Product Change
- ✅ Non Renewing Purchase

### Step 4: Save Configuration

Click **"Save"** or **"Update Webhook"**

## 🧪 Test It

### Option 1: Send Test Event (Fastest)

1. In RevenueCat webhook configuration
2. Click **"Send Test Event"**
3. Select event type: **"INITIAL_PURCHASE"**
4. Click **"Send"**
5. Check the response - should be `200 OK` with `{"received":true}`

### Option 2: Check Recent Deliveries

1. In RevenueCat webhook configuration
2. Scroll to **"Recent Deliveries"**
3. Check the latest attempt:
   - ✅ Status `200` = Success!
   - ❌ Status `401` = Still configuration issue
   - ❌ Status `500` = Server error (check Supabase logs)

## 📊 View Webhook Logs

**Supabase Dashboard**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/odppmbshkubichmbwunl/functions)
2. Click **Edge Functions** → **revenuecat-webhook**
3. Click **"Logs"** tab
4. Look for recent invocations

**Expected Success Logs**:
```
[SUCCESS] Webhook signature verified
[WEBHOOK] Received event: INITIAL_PURCHASE
[SUCCESS] Updated subscription for user abc-123
```

## ❓ Still Not Working?

### Check Configuration

Run these commands to verify setup:

```bash
# Verify webhook is deployed
npx supabase functions list

# Check webhook secret is set
npx supabase secrets list | grep REVENUECAT

# Expected output:
# REVENUECAT_WEBHOOK_SECRET | b353291a13ede259af5f9433e627b0254df7e362b1cde3b24f91d4a7240a5f3d
```

### Common Issues

1. **Wrong Header Name**: Must be exactly `X-RevenueCat-Signature`
2. **Wrong Header Value**: Must match your webhook secret exactly
3. **Authorization Header Not Empty**: Make sure it's blank/removed
4. **Wrong URL**: Should be `https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook`

## 📝 Summary

**What Changed:**
- ✅ Updated webhook function to accept custom header
- ✅ Added better error logging
- ✅ Deployed new version (Version 6)

**What You Need to Do:**
1. Configure webhook in RevenueCat with custom header
2. Test with "Send Test Event"
3. Verify it works!

**Your Webhook Details:**
- **URL**: `https://odppmbshkubichmbwunl.supabase.co/functions/v1/revenuecat-webhook`
- **Header Name**: `X-RevenueCat-Signature`
- **Header Value**: `b353291a13ede259af5f9433e627b0254df7e362b1cde3b24f91d4a7240a5f3d`

---

Need more help? Check `WEBHOOK_TROUBLESHOOTING.md` for detailed debugging steps.
