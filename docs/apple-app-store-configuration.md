# Apple App Store Configuration Guide - Nuolo Monetization

This guide covers configuring In-App Purchases for the new Nuolo pricing structure in Apple App Store Connect.

## Overview

**New Pricing Structure:**
- **Free Tier**: 2 attractions (no IAP)
- **Basic Package**: 5 attractions for $3.99 (non-consumable)
- **Standard Package**: 20 attractions for $9.99 (non-consumable)
- **Premium Package**: 50 attractions for $19.99 (non-consumable)
- **Unlimited Monthly**: $29.99/month (auto-renewable subscription)

## Prerequisites

1. **Apple Developer Account** with Admin or Finance role
2. **App Store Connect** access
3. **Nuolo app already created** in App Store Connect
4. **Banking and tax information** completed
5. **App version in "Prepare for Submission" or later**

## Step 1: Access In-App Purchases

1. **Log in to App Store Connect**
   - Go to https://appstoreconnect.apple.com
   - Sign in with your Apple Developer credentials

2. **Navigate to Your App**
   - Click "My Apps"
   - Select "Nuolo" from your app list

3. **Access In-App Purchases**
   - Click "Features" in the left sidebar
   - Select "In-App Purchases"

## Step 2: Create Attraction Packages (Non-Consumables)

### Basic Package - $3.99

1. **Click "Create New"**
2. **Select "Non-Consumable"**
3. **Fill in Details:**
   - **Product ID**: `nuolo_basic_package`
   - **Reference Name**: `Nuolo Basic Package`
   - **Cleared for Sale**: Yes

4. **Pricing and Availability:**
   - **Price**: $3.99 USD
   - **Availability Date**: Today's date
   - **Countries/Regions**: All territories where your app is available

5. **App Store Localization (English - US):**
   - **Display Name**: `Basic Package`
   - **Description**: `Get 5 premium audio guides to explore your favorite destinations. Perfect for trying out premium content with offline access.`

6. **Review Information:**
   - **Screenshot**: Upload a screenshot showing the package benefits
   - **Review Notes**: `Basic attraction package with 5 audio guide credits`

7. **Click "Save"**

### Standard Package - $9.99 (Most Popular)

1. **Click "Create New"**
2. **Select "Non-Consumable"**
3. **Fill in Details:**
   - **Product ID**: `nuolo_standard_package`
   - **Reference Name**: `Nuolo Standard Package`
   - **Cleared for Sale**: Yes

4. **Pricing and Availability:**
   - **Price**: $9.99 USD
   - **Availability Date**: Today's date
   - **Countries/Regions**: All territories

5. **App Store Localization (English - US):**
   - **Display Name**: `Standard Package`
   - **Description**: `Great value for regular travelers! Get 20 premium audio guides with offline access and exclusive content. Most popular choice.`

6. **Review Information:**
   - **Screenshot**: Upload screenshot highlighting "Most Popular" and 20 guides
   - **Review Notes**: `Standard attraction package with 20 audio guide credits - most popular option`

7. **Click "Save"**

### Premium Package - $19.99 (Best Value)

1. **Click "Create New"**
2. **Select "Non-Consumable"**
3. **Fill in Details:**
   - **Product ID**: `nuolo_premium_package`
   - **Reference Name**: `Nuolo Premium Package`
   - **Cleared for Sale**: Yes

4. **Pricing and Availability:**
   - **Price**: $19.99 USD
   - **Availability Date**: Today's date
   - **Countries/Regions**: All territories

5. **App Store Localization (English - US):**
   - **Display Name**: `Premium Package`
   - **Description**: `Maximum value for travel enthusiasts! Get 50 premium audio guides with offline access and all exclusive content. Best value per guide.`

6. **Review Information:**
   - **Screenshot**: Upload screenshot highlighting "Best Value" and 50 guides
   - **Review Notes**: `Premium attraction package with 50 audio guide credits - best value option`

7. **Click "Save"**

## Step 3: Create Unlimited Monthly Subscription

1. **Navigate to Subscriptions**
   - In "Features" sidebar, click "Subscriptions"
   - Click "Create New"

2. **Create Subscription Group**
   - **Reference Name**: `Nuolo Unlimited Access`
   - **Click "Create"**

3. **Add Subscription Level**
   - Click "Create Subscription"
   - **Product ID**: `nuolo_unlimited_monthly`
   - **Reference Name**: `Nuolo Unlimited Monthly`
   - **Subscription Duration**: 1 Month
   - **Cleared for Sale**: Yes

4. **Pricing and Availability:**
   - **Price**: $29.99 USD per month
   - **Availability Date**: Today's date
   - **Countries/Regions**: All territories

5. **App Store Localization (English - US):**
   - **Display Name**: `Unlimited Monthly`
   - **Description**: `Get unlimited access to all audio guides with new content added monthly. Listen to as many guides as you want with premium narration and offline access.`

6. **Subscription Settings:**
   - **Subscription Benefits**: List the key benefits
   - **Free Trial**: None (optional: 3-day free trial)
   - **Promotional Offers**: None initially

7. **Family Sharing**: Enable (recommended)

8. **Review Information:**
   - **Screenshot**: Upload screenshot showing unlimited features
   - **Review Notes**: `Unlimited monthly subscription for all audio guides`

9. **Click "Save"**

## Step 4: Configure App Store Review Information

For each In-App Purchase:

1. **Test User Account:**
   - Email: Create a sandbox test account
   - Password: Use secure password
   - **Note**: Don't use a real credit card

2. **Screenshots:**
   - Take screenshots showing each package/subscription in your app
   - Show the benefits clearly
   - Ensure UI matches your descriptions

3. **Review Notes:**
   - Explain what each purchase unlocks
   - Provide test instructions for reviewers

## Step 5: Pricing Validation

**Verify pricing across all storefronts:**

1. **Check Price Points:**
   - Basic: $3.99 USD
   - Standard: $9.99 USD  
   - Premium: $19.99 USD
   - Unlimited: $29.99 USD/month

2. **Price Tier Verification:**
   - Basic: Tier 4
   - Standard: Tier 10
   - Premium: Tier 20
   - Unlimited: Tier 30 (monthly)

3. **Currency Conversion:**
   - Apple automatically converts to local currencies
   - Review major markets (EUR, GBP, JPY, etc.)
   - Adjust if needed for psychological pricing

## Step 6: Submit for Review

1. **Review All Products:**
   - Ensure all fields are completed
   - Verify screenshots are uploaded
   - Check pricing is correct

2. **Submit with App Version:**
   - In-App Purchases are reviewed with app submissions
   - Add to your next app version for review
   - Include clear testing instructions

3. **Review Timeline:**
   - Typically 24-48 hours for IAPs
   - Can be rejected separately from app
   - Address any feedback promptly

## Step 7: Test in Sandbox

**Before going live:**

1. **Create Sandbox Account:**
   - Go to "Users and Access" > "Sandbox Testers"
   - Create test Apple ID accounts
   - Use different countries for testing

2. **Test Purchase Flows:**
   - Test each package purchase
   - Test subscription flow
   - Verify receipt validation
   - Test restore purchases

3. **Test Scenarios:**
   - First-time purchases
   - Subscription renewal
   - Subscription cancellation
   - Family sharing (if enabled)
   - Different regions/currencies

## Pricing Strategy Notes

**Package Positioning:**
- **Basic ($3.99)**: Low commitment entry point, high conversion expected
- **Standard ($9.99)**: "Most Popular" badge drives selection, optimal value perception
- **Premium ($19.99)**: "Best Value" for heavy users, highest revenue per user
- **Unlimited ($29.99/month)**: Premium tier for dedicated travelers

**Revenue Projections** (after Apple's 30% cut):
- Basic: $2.79 per purchase
- Standard: $6.99 per purchase
- Premium: $13.99 per purchase
- Unlimited: $20.99 per month

## Common Issues and Solutions

**Issue: "Metadata Rejected"**
- Solution: Ensure screenshots clearly show package benefits
- Add descriptive review notes for clarity

**Issue: "Price Point Not Available"**
- Solution: Check if price tier exists in your target countries
- Consider alternative price points if needed

**Issue: "Subscription Missing Information"**
- Solution: Complete all required fields in subscription settings
- Add privacy policy URL for subscriptions

**Issue: "Product ID Already Exists"**
- Solution: Product IDs must be globally unique
- Add prefix or suffix to make unique

## Post-Launch Monitoring

1. **Analytics Tracking:**
   - Monitor conversion rates per package
   - Track revenue per user (RPU)
   - Analyze regional performance

2. **A/B Testing:**
   - Test different package positioning
   - Experiment with pricing (with new product IDs)
   - Test subscription trial periods

3. **Performance Optimization:**
   - Adjust "Most Popular" placement based on data
   - Consider seasonal pricing strategies
   - Monitor churn rates for subscriptions

## Support and Troubleshooting

- **App Store Connect Help**: https://developer.apple.com/support/app-store-connect/
- **In-App Purchase Guide**: https://developer.apple.com/in-app-purchase/
- **Receipt Validation**: https://developer.apple.com/documentation/appstorereceipts

Remember: Always test thoroughly in sandbox before submitting to production!