# Apple App Store Connect - Complete Setup Guide

## 📱 Nuolo In-App Purchase Configuration

This guide walks you through setting up all in-app purchases in Apple App Store Connect.

---

## Product Overview

You'll create **7 total products**:

| Product | Type | Price | Status |
|---------|------|-------|--------|
| Unlimited Monthly | Auto-Renewable Subscription | $29.99/month | ✅ Active |
| Basic Package | Consumable | $3.99 | ✅ Active |
| Standard Package | Consumable | $9.99 | ✅ Active |
| Premium Package | Consumable | $19.99 | ✅ Active |
| Premium Monthly (Legacy) | Auto-Renewable Subscription | $9.99/month | ⚠️ Inactive (existing subscribers only) |
| Premium Yearly (Legacy) | Auto-Renewable Subscription | $59.99/year | ⚠️ Inactive (existing subscribers only) |
| Lifetime (Legacy) | Non-Consumable | $99.99 | ⚠️ Inactive (grandfathered) |

---

## Prerequisites

Before you start:

- ✅ Apple Developer Program membership ($99/year)
- ✅ App created in App Store Connect
- ✅ Bundle ID: `com.nuolo.app`
- ✅ Paid Applications Agreement signed
- ✅ Banking and tax info submitted

---

## Step 1: Access In-App Purchases

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **"My Apps"** → Select **"Nuolo"**
3. Click **"Features"** tab → **"In-App Purchases"**

---

## Step 2: Create Subscription Group

Before creating subscriptions, you need a subscription group:

1. Click **"Subscription Groups"** section
2. Click **"Create"** (or **"+"** button)
3. **Reference Name:** `Nuolo Subscriptions`
4. Click **"Create"**

### Configure Group Localization

1. Click on **"Nuolo Subscriptions"** group
2. Click **"App Store Localization"** → **"Create Localization"**
3. Select **"English (U.S.)"**
4. Fill in:
   ```
   Subscription Group Display Name: Nuolo Premium Access
   ```
5. Click **"Save"**

---

## Step 3: Create Active Products

### ✅ Product 1: Unlimited Monthly Subscription

1. Inside **"Nuolo Subscriptions"** group, click **"+"** (Create Subscription)
2. Fill in details:

**Reference Name:** `Nuolo Unlimited Monthly`
**Product ID:** `nuolo_unlimited_monthly` ⚠️ **MUST MATCH CODE EXACTLY**

**Subscription Duration:** `1 Month`

**Subscription Prices:**
1. Click **"Add Subscription Price"**
2. Select **"United States"** → **$29.99/month**
3. **Availability:** Starting immediately
4. Click **"Next"**
5. Click **"Add Prices in Multiple Territories"**
6. Select major markets (Canada, UK, Australia, etc.)
7. Let Apple auto-convert prices
8. Click **"Done"**

**App Store Localization:**
1. Click **"App Store Localization"** → **"Create Localization"**
2. Select **"English (U.S.)"**
3. Fill in:
   ```
   Subscription Display Name: Unlimited Audio Guides

   Description:
   Get unlimited access to all audio guides with a monthly subscription.
   Listen to as many guides as you want, whenever you want. New content
   added regularly with premium narration and offline listening.
   ```

**Subscription Benefits (Required - Add at least 3):**
Click **"Create Benefit"** for each:
1. `Unlimited audio guides for all attractions`
2. `Offline listening - download and listen anywhere`
3. `Premium narration with expert storytelling`
4. `New content added monthly`

**Review Information:**
- Upload screenshot showing unlimited subscription in your paywall
- Add any notes for Apple reviewers

Click **"Save"**

---

### ✅ Product 2: Basic Package (Consumable)

1. Go back to **In-App Purchases** main page
2. Click **"+"** → Select **"Consumable"**

**Reference Name:** `Nuolo Basic Package`
**Product ID:** `nuolo_basic_package` ⚠️ **MUST MATCH CODE EXACTLY**

**Price Schedule:**
1. Click **"Add Price"**
2. Select **"United States"** → **$3.99** (Tier 4)
3. **Availability:** Starting immediately
4. Click **"Add Prices in Multiple Territories"**
5. Auto-convert for other regions
6. Click **"Done"**

**App Store Localization:**
1. Click **"Create Localization"**
2. Select **"English (U.S.)"**
3. Fill in:
   ```
   Display Name: 5 Audio Guides

   Description:
   Get 5 audio guide credits to use on any attractions you choose.
   Perfect for trying out premium content or a weekend getaway.
   Credits are consumed as you generate guides.
   ```

**Review Information:**
- Upload screenshot showing basic package in paywall
- Note: "User receives 5 audio guide credits added to their account"

Click **"Save"**

---

### ✅ Product 3: Standard Package (Consumable)

**Reference Name:** `Nuolo Standard Package`
**Product ID:** `nuolo_standard_package`

**Price:** $9.99 (Tier 10)

**App Store Localization (English - U.S.):**
```
Display Name: 20 Audio Guides - Most Popular

Description:
Get 20 audio guide credits to use on any attractions worldwide.
Great value for regular travelers and city explorers. Credits
never expire and can be used anytime, anywhere.
```

**Review Notes:** "User receives 20 audio guide credits. Most popular package."

Click **"Save"**

---

### ✅ Product 4: Premium Package (Consumable)

**Reference Name:** `Nuolo Premium Package`
**Product ID:** `nuolo_premium_package`

**Price:** $19.99 (Tier 20)

**App Store Localization (English - U.S.):**
```
Display Name: 50 Audio Guides - Best Value

Description:
Get 50 audio guide credits - the best value for frequent explorers.
Use them on any attractions worldwide. Perfect for travel enthusiasts
who want maximum flexibility. Credits never expire.
```

**Review Notes:** "User receives 50 audio guide credits. Best value package."

Click **"Save"**

---

## Step 4: Create Legacy Products (Inactive)

These products are for **existing subscribers only**. They should NOT be available for new purchases.

### ⚠️ Legacy Product 1: Premium Monthly (Inactive)

1. Inside **"Nuolo Subscriptions"** group, click **"+"**
2. Fill in:

**Reference Name:** `Nuolo Premium Monthly (Legacy - Existing Subscribers Only)`
**Product ID:** `nuolo_premium_monthly`

**Subscription Duration:** `1 Month`
**Price:** $9.99/month

**App Store Localization:**
```
Subscription Display Name: Premium Monthly (Legacy)

Description:
Legacy subscription plan. No longer available for new subscribers.
Existing subscribers retain full unlimited access.
```

**CRITICAL STEP - Make Unavailable for New Users:**
1. After creating, go to **"Availability"** section
2. Set to: ✅ **"Available in These Territories: [Select None]"**
   - OR ensure it's not promoted in your app's paywall
3. This allows existing subscribers to renew but prevents new purchases

Click **"Save"**

---

### ⚠️ Legacy Product 2: Premium Yearly (Inactive)

**Reference Name:** `Nuolo Premium Yearly (Legacy - Existing Subscribers Only)`
**Product ID:** `nuolo_premium_yearly`

**Subscription Duration:** `1 Year`
**Price:** $59.99/year

**Availability:** Not available in any territories (or not shown in app)

Click **"Save"**

---

### ⚠️ Legacy Product 3: Lifetime (Inactive)

1. Go to main **In-App Purchases** page
2. Click **"+"** → Select **"Non-Consumable"**

**Reference Name:** `Nuolo Lifetime (Legacy - Grandfathered)`
**Product ID:** `nuolo_lifetime`

**Price:** $99.99

**App Store Localization:**
```
Display Name: Lifetime Access (Legacy)

Description:
Legacy one-time purchase. No longer available. Existing
customers retain lifetime unlimited access.
```

**Availability:** Not available (keep for existing users only)

Click **"Save"**

---

## Step 5: Configure Subscription Ranking

Subscription ranking determines upgrade/downgrade behavior:

1. Go to **"Nuolo Subscriptions"** group
2. Click **"Subscription Ranking"**
3. Set order (highest to lowest):
   - **Level 1:** `nuolo_unlimited_monthly` (current offering)
   - **Level 2:** `nuolo_premium_yearly` (legacy)
   - **Level 3:** `nuolo_premium_monthly` (legacy)
4. Click **"Save"**

---

## Step 6: Verify Product IDs Match Code

**CRITICAL:** Product IDs must match **EXACTLY** (case-sensitive, no spaces):

Open `config/products.ts` and verify:

```typescript
UNLIMITED_MONTHLY: 'nuolo_unlimited_monthly' ✅
BASIC_PACKAGE: 'nuolo_basic_package' ✅
STANDARD_PACKAGE: 'nuolo_standard_package' ✅
PREMIUM_PACKAGE: 'nuolo_premium_package' ✅

// Legacy
PREMIUM_MONTHLY: 'nuolo_premium_monthly' ✅
PREMIUM_YEARLY: 'nuolo_premium_yearly' ✅
LIFETIME: 'nuolo_lifetime' ✅
```

**Any mismatch = products won't load!**

---

## Step 7: Submit Products for Review

Products are reviewed when you submit your app:

1. **Prepare Screenshots:**
   - Screenshot showing unlimited subscription in paywall
   - Screenshot showing packages in paywall
   - Screenshot showing purchase confirmation

2. **Submit App for Review:**
   - Build app with In-App Purchase capability
   - Upload to App Store Connect
   - Submit for review
   - Products will be reviewed alongside app

**Review Timeline:** 24-48 hours (up to 5 business days)

---

## Step 8: Set Up Sandbox Testing

### Create Sandbox Tester Account

1. Go to **App Store Connect** home
2. Click **"Users and Access"**
3. Click **"Sandbox Testers"** tab
4. Click **"+"** button
5. Create test account:
   ```
   First Name: Test
   Last Name: User
   Email: test.nuolo.1@icloud.com (must be unique, can be fake)
   Password: TestPassword123!
   Country: United States
   ```
6. Click **"Invite"**

### Test Purchases

1. **On iOS Device:**
   - Settings → App Store → Sign Out
   - Build and run Nuolo app
   - Trigger purchase in app
   - Sign in with sandbox test account when prompted
   - Complete purchase (NO REAL MONEY CHARGED)

2. **Verify:**
   - Check product access granted
   - Check Supabase database for purchase record
   - Verify receipt validation succeeds

---

## Step 9: Enable In-App Purchase Capability (Xcode)

1. Open Nuolo project in Xcode
2. Select project target → **"Signing & Capabilities"**
3. Click **"+ Capability"**
4. Add **"In-App Purchase"**
5. Verify Bundle ID: `com.nuolo.app`

---

## Step 10: Configure Paid Applications Agreement

**REQUIRED** before products work:

1. App Store Connect home → **"Agreements, Tax, and Banking"**
2. **"Paid Applications"** section → Click **"Set Up"** or **"Request"**
3. Fill out:
   - ✅ Contact Information
   - ✅ Bank Account (for receiving payments)
   - ✅ Tax Forms (W-9 for US, W-8BEN for international)
4. Submit

**Processing Time:** 24-48 hours

---

## Product Status Reference

### Status Icons

- ✅ **Ready to Submit** - Product configured, ready for app review
- 🕐 **Waiting for Review** - Under Apple review
- ✅ **Approved** - Live and available for purchase
- ❌ **Rejected** - Check rejection reason and fix

### How to Check Status

1. Go to **In-App Purchases**
2. Look at each product's status icon
3. Click product to see detailed status

---

## Common Issues & Solutions

### ❌ "Cannot connect to iTunes Store"

**Cause:** Products not yet propagated or Agreement not signed

**Solution:**
1. Wait 2-3 hours after creating products
2. Verify Paid Apps Agreement is "Active"
3. Check products are "Ready to Submit"

---

### ❌ "No products available"

**Cause:** Product ID mismatch or products not ready

**Solution:**
1. Verify product IDs match exactly (case-sensitive)
2. Check products show "Ready to Submit" status
3. Use sandbox environment for testing
4. Wait 2-3 hours for propagation

---

### ❌ "Invalid Product ID"

**Cause:** Typo in product ID

**Solution:**
1. Compare App Store Connect ID vs code character-by-character
2. Product IDs are case-sensitive
3. No spaces allowed
4. Use `console.log(PRODUCT_IDS)` to debug

---

### ❌ Purchases fail immediately

**Cause:** Not using sandbox account

**Solution:**
1. Sign out of production Apple ID on device
2. Use ONLY sandbox test account for testing
3. Never use real Apple ID for sandbox testing

---

## Post-Launch Checklist

After products go live:

- [ ] Monitor first 10 real purchases closely
- [ ] Check receipt validation works correctly
- [ ] Verify Supabase records purchases
- [ ] Test "Restore Purchases" functionality
- [ ] Monitor App Store Connect → Sales and Trends
- [ ] Set up alerts for billing failures
- [ ] Check customer reviews for purchase issues

---

## Product Summary

**Active Products (4):**
- ✅ `nuolo_unlimited_monthly` - Auto-Renewable Subscription, $29.99/month
- ✅ `nuolo_basic_package` - Consumable, $3.99, 5 credits
- ✅ `nuolo_standard_package` - Consumable, $9.99, 20 credits
- ✅ `nuolo_premium_package` - Consumable, $19.99, 50 credits

**Legacy Products (3) - Existing Subscribers Only:**
- ⚠️ `nuolo_premium_monthly` - Auto-Renewable Subscription, $9.99/month
- ⚠️ `nuolo_premium_yearly` - Auto-Renewable Subscription, $59.99/year
- ⚠️ `nuolo_lifetime` - Non-Consumable, $99.99

---

## Need Help?

- 📚 [Apple In-App Purchase Documentation](https://developer.apple.com/in-app-purchase/)
- 📚 [Subscription Best Practices](https://developer.apple.com/app-store/subscriptions/)
- 📧 Apple Developer Support: [developer.apple.com/contact](https://developer.apple.com/contact/)

---

**Estimated Setup Time:** 2-3 hours

**Last Updated:** January 2025
