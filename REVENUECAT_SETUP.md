# RevenueCat Setup Guide for Nuolo

This guide will help you set up RevenueCat for Nuolo's in-app purchases and subscriptions.

## Overview

Nuolo uses RevenueCat for cross-platform monetization management. RevenueCat handles:
- Server-side receipt validation
- Cross-platform purchase restoration
- Subscription management
- Webhook events for real-time updates
- Customer analytics

## Prerequisites

- RevenueCat account at [https://www.revenuecat.com/](https://www.revenuecat.com/)
- Apple Developer Account (for iOS)
- Google Play Developer Account (for Android)
- Supabase project with database access

## Step 1: RevenueCat Dashboard Setup

### 1.1 Create RevenueCat Project

1. Go to [https://app.revenuecat.com/](https://app.revenuecat.com/)
2. Click "Create New Project"
3. Enter project name: "Nuolo"
4. Select your organization

### 1.2 Configure iOS App

1. In RevenueCat dashboard, go to "Apps"
2. Click "Add iOS App"
3. Enter:
   - **App Name**: Nuolo iOS
   - **Bundle ID**: `com.nuolo.app`
   - **App Store Connect Shared Secret**: Get from App Store Connect
4. Save configuration

### 1.3 Configure Android App

1. In RevenueCat dashboard, go to "Apps"
2. Click "Add Android App"
3. Enter:
   - **App Name**: Nuolo Android
   - **Package Name**: `com.nuolo.app`
   - **Google Play Service Account Credentials**: Upload JSON key
4. Save configuration

## Step 2: Product & Entitlement Configuration

### 2.1 Create Entitlements

Entitlements are the features users get access to. Create these in RevenueCat:

1. Go to "Entitlements" in dashboard
2. Create the following entitlements:

| Entitlement ID | Description |
|----------------|-------------|
| `unlimited` | Unlimited access to all audio guides |
| `basic_package` | 5 audio guide credits |
| `standard_package` | 20 audio guide credits |
| `premium_package` | 50 audio guide credits |

### 2.2 Create Products

Products are the actual items users purchase. Configure these in both app stores first, then add to RevenueCat:

#### iOS Products (App Store Connect)

1. Go to App Store Connect
2. Navigate to your app → Features → In-App Purchases
3. Create the following products:

| Product ID | Type | Price | Entitlement |
|------------|------|-------|-------------|
| `nuolo_unlimited_monthly` | Auto-Renewable Subscription | $29.99/month | unlimited |
| `nuolo_basic_package` | Consumable | $3.99 | basic_package |
| `nuolo_standard_package` | Consumable | $9.99 | standard_package |
| `nuolo_premium_package` | Consumable | $19.99 | premium_package |

#### Android Products (Google Play Console)

1. Go to Google Play Console
2. Navigate to your app → Monetize → Products
3. Create the following products:

| Product ID | Type | Price | Entitlement |
|------------|------|-------|-------------|
| `nuolo_unlimited_monthly` | Subscription | $29.99/month | unlimited |
| `nuolo_basic_package` | Managed Product | $3.99 | basic_package |
| `nuolo_standard_package` | Managed Product | $9.99 | standard_package |
| `nuolo_premium_package` | Managed Product | $19.99 | premium_package |

#### Add Products to RevenueCat

1. In RevenueCat dashboard, go to "Products"
2. For each product above:
   - Click "Add Product"
   - Enter Product ID (must match store)
   - Select entitlement it grants
   - Configure for both iOS and Android

### 2.3 Create Offering

Offerings group products together for display in your app:

1. Go to "Offerings" in RevenueCat dashboard
2. Click "Create New Offering"
3. Name it: "default"
4. Mark as "Current Offering"
5. Add all 4 products to the offering
6. Set package identifiers:
   - Subscription: `$rc_monthly` or custom identifier
   - Basic Package: `basic`
   - Standard Package: `standard`
   - Premium Package: `premium`
7. Save offering

## Step 3: Get API Keys

1. In RevenueCat dashboard, go to "API Keys"
2. Copy your API keys:
   - **iOS API Key**: Starts with `appl_`
   - **Android API Key**: Starts with `goog_`

## Step 4: Configure API Keys in Code

RevenueCat API keys are configured directly in the `MonetizationService.ts` file. You have two options:

### Option 1: Hardcode Keys (Quick Testing)

Edit `services/MonetizationService.ts` and replace the placeholder keys:

```typescript
const apiKey = Platform.select({
  ios: 'appl_YOUR_ACTUAL_IOS_KEY',
  android: 'goog_YOUR_ACTUAL_ANDROID_KEY',
  default: '',
});
```

### Option 2: Use Environment Variables (Recommended for Production)

1. Create `.env` file in project root:

```bash
REVENUECAT_IOS_API_KEY=appl_YOUR_IOS_API_KEY_HERE
REVENUECAT_ANDROID_API_KEY=goog_YOUR_ANDROID_API_KEY_HERE
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
```

2. For EAS Build, set secrets:

```bash
eas secret:create --scope project --name REVENUECAT_IOS_API_KEY --value appl_YOUR_KEY
eas secret:create --scope project --name REVENUECAT_ANDROID_API_KEY --value goog_YOUR_KEY
```

3. Update `services/MonetizationService.ts` to use env vars:

```typescript
const apiKey = Platform.select({
  ios: process.env.REVENUECAT_IOS_API_KEY || 'appl_YOUR_KEY',
  android: process.env.REVENUECAT_ANDROID_API_KEY || 'goog_YOUR_KEY',
  default: '',
});
```

**Note**: The app will run in "mock mode" during development if keys are not configured.

## Step 5: Configure Webhook

### 5.1 Deploy Webhook Function

Deploy the RevenueCat webhook handler to Supabase:

```bash
cd supabase/functions
supabase functions deploy revenuecat-webhook
```

### 5.2 Set Webhook Secret

Generate a secure webhook secret:

```bash
openssl rand -hex 32
```

Set it in Supabase:

```bash
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your_generated_secret
```

### 5.3 Configure Webhook in RevenueCat

1. In RevenueCat dashboard, go to "Integrations" → "Webhooks"
2. Click "Add Webhook"
3. Enter:
   - **Webhook URL**: `https://your-project.supabase.co/functions/v1/revenuecat-webhook`
   - **Custom Header Name**: `X-RevenueCat-Signature`
   - **Custom Header Value**: Your webhook secret (from step 5.2)
   - ⚠️ **Important**: DO NOT use the "Authorization Header" field - use a custom header instead
4. Select events to receive:
   - ✅ Initial Purchase
   - ✅ Renewal
   - ✅ Cancellation
   - ✅ Expiration
   - ✅ Billing Issue
   - ✅ Product Change
   - ✅ Non Renewing Purchase
5. Save webhook configuration

**Why Custom Header?**
Supabase Edge Functions require the `Authorization` header to have the format `Bearer {token}`.
RevenueCat sends webhook secrets as plain values, which conflicts with Supabase's authentication.
Using a custom header (`X-RevenueCat-Signature`) avoids this conflict.

## Step 6: Run Database Migration

Apply the RevenueCat database migration:

```bash
# Local development
supabase migration up

# Production
supabase db push
```

This will add the `revenuecat_customer_id` column to your profiles table.

## Step 7: Test the Integration

### 7.1 iOS Sandbox Testing

1. Create a sandbox test account in App Store Connect
2. Sign in to the sandbox account on your iOS device
3. Build and run the app
4. Make a test purchase
5. Verify in RevenueCat dashboard that the purchase appears

### 7.2 Android Testing

1. Add test accounts in Google Play Console
2. Build and install a signed test build
3. Make a test purchase
4. Verify in RevenueCat dashboard

### 7.3 Verify Webhook

1. Make a test purchase
2. Check Supabase logs to see webhook event
3. Verify database was updated correctly

## Product IDs Reference

### Current Products

| Product ID | Type | Platform | Price | Description |
|------------|------|----------|-------|-------------|
| `nuolo_unlimited_monthly` | Subscription | Both | $29.99/mo | Unlimited audio guides |
| `nuolo_basic_package` | Consumable | Both | $3.99 | 5 audio guide credits |
| `nuolo_standard_package` | Consumable | Both | $9.99 | 20 audio guide credits |
| `nuolo_premium_package` | Consumable | Both | $19.99 | 50 audio guide credits |

### Legacy Products (For Reference Only)

These products are deprecated but must remain configured for existing subscribers:

| Product ID | Type | Status |
|------------|------|--------|
| `nuolo_premium_monthly` | Subscription | Legacy - Do Not Remove |
| `nuolo_premium_yearly` | Subscription | Legacy - Do Not Remove |
| `nuolo_lifetime` | Non-Consumable | Legacy - Do Not Remove |

## Troubleshooting

### Issue: "RevenueCat API key not configured"

**Solution**: Make sure environment variables are set correctly in `app.config.js` and rebuild the app.

### Issue: Products not loading

**Solution**:
1. Verify products are configured in both App Store Connect / Google Play Console
2. Check that products are added to RevenueCat dashboard
3. Ensure offering is marked as "Current Offering"
4. Wait a few minutes for changes to propagate

### Issue: Webhook not receiving events

**Solution**:
1. Verify webhook URL is correct and accessible
2. Check webhook secret matches between RevenueCat and Supabase
3. Review Supabase function logs for errors
4. Test webhook with RevenueCat's "Send Test Event" button

### Issue: Purchases not syncing to database

**Solution**:
1. Check Supabase function logs for webhook errors
2. Verify database permissions for service role
3. Ensure user_subscriptions and user_package_purchases tables exist
4. Check that RevenueCat customer ID is being set correctly

## Support

For RevenueCat-specific issues:
- Documentation: [https://docs.revenuecat.com/](https://docs.revenuecat.com/)
- Support: [https://community.revenuecat.com/](https://community.revenuecat.com/)

For Nuolo-specific issues:
- Check the codebase documentation
- Review the MonetizationService implementation
- Test with sandbox accounts first

## Next Steps

After setup is complete:

1. ✅ Test purchases on iOS sandbox
2. ✅ Test purchases on Android test track
3. ✅ Verify webhook integration
4. ✅ Monitor RevenueCat dashboard for analytics
5. ✅ Submit apps for review with in-app purchases
6. ✅ Monitor production purchases and subscriptions

## Migration from expo-iap

If you're migrating from the old expo-iap system:

1. ✅ All code has been updated to use RevenueCat
2. ✅ Old expo-iap dependency has been removed
3. ✅ Legacy verify-receipt edge function is no longer needed (can be deleted)
4. ✅ Existing subscriptions will continue to work through Supabase fallback
5. ⚠️ New purchases will use RevenueCat system
6. ⚠️ Monitor both systems during transition period
7. ⚠️ Consider migrating existing subscribers to RevenueCat (optional)

### Clean up old files (optional):

```bash
# Remove old verify-receipt function
rm -rf supabase/functions/verify-receipt

# Old code is already updated, no further action needed
```
