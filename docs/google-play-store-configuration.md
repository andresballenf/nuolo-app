# Google Play Store Configuration Guide - Nuolo Monetization

This guide covers configuring In-App Products and Subscriptions for the new Nuolo pricing structure in Google Play Console.

## Overview

**New Pricing Structure:**
- **Free Tier**: 2 attractions (no IAP)
- **Basic Package**: 5 attractions for $3.99 (managed product)
- **Standard Package**: 20 attractions for $9.99 (managed product)
- **Premium Package**: 50 attractions for $19.99 (managed product)
- **Unlimited Monthly**: $29.99/month (subscription)

## Prerequisites

1. **Google Play Developer Account** with Admin or Finance role
2. **Google Play Console** access
3. **Nuolo app already uploaded** to Google Play Console
4. **Merchant account set up** for payments
5. **Tax and banking information** completed
6. **App in at least "Internal Testing" track**

## Step 1: Access In-App Products

1. **Log in to Google Play Console**
   - Go to https://play.google.com/console
   - Sign in with your Google Developer credentials

2. **Navigate to Your App**
   - Select "Nuolo" from your app list
   - Or use "All apps" if you have multiple apps

3. **Access Monetization**
   - In the left sidebar, expand "Monetization"
   - Click "In-app products"

## Step 2: Create Attraction Packages (Managed Products)

### Basic Package - $3.99

1. **Click "Create product"**
2. **Fill in Basic Information:**
   - **Product ID**: `nuolo_basic_package`
   - **Name**: `Basic Package`
   - **Description**: `Get 5 premium audio guides to explore your favorite destinations. Perfect for trying out premium content with offline access.`

3. **Set Default Price:**
   - **Price**: $3.99 USD
   - Click "Set local prices" to customize for other countries
   - **Note**: Google Play uses your default pricing template

4. **Additional Settings:**
   - **Status**: Active
   - **Managed product**: Yes (default)

5. **Add Translations (Optional but Recommended):**
   - Add Spanish: `Paquete Básico` / `Obtén 5 guías de audio premium...`
   - Add French: `Package de Base` / `Obtenez 5 guides audio premium...`
   - Add German: `Basis-Paket` / `Erhalten Sie 5 Premium-Audioguides...`

6. **Click "Save"**

### Standard Package - $9.99 (Most Popular)

1. **Click "Create product"**
2. **Fill in Basic Information:**
   - **Product ID**: `nuolo_standard_package`
   - **Name**: `Standard Package - Most Popular`
   - **Description**: `Great value for regular travelers! Get 20 premium audio guides with offline access and exclusive content. Our most popular choice for exploring the world.`

3. **Set Default Price:**
   - **Price**: $9.99 USD
   - Verify local pricing makes sense (€8.99, £8.49, ¥1,220, etc.)

4. **Additional Settings:**
   - **Status**: Active
   - **Managed product**: Yes

5. **Add Translations:**
   - Add localized "Most Popular" indicators in descriptions
   - Ensure value proposition is clear in each language

6. **Click "Save"**

### Premium Package - $19.99 (Best Value)

1. **Click "Create product"**
2. **Fill in Basic Information:**
   - **Product ID**: `nuolo_premium_package`
   - **Name**: `Premium Package - Best Value`
   - **Description**: `Maximum value for travel enthusiasts! Get 50 premium audio guides with offline access and all exclusive content. Best value per guide for frequent explorers.`

3. **Set Default Price:**
   - **Price**: $19.99 USD
   - Check psychological pricing in major markets
   - Consider: €18.99, £17.99, ¥2,400, etc.

4. **Additional Settings:**
   - **Status**: Active
   - **Managed product**: Yes

5. **Add Translations:**
   - Emphasize "Best Value" positioning
   - Include per-guide cost benefit in descriptions

6. **Click "Save"**

## Step 3: Create Unlimited Monthly Subscription

1. **Navigate to Subscriptions:**
   - In "Monetization" sidebar, click "Subscriptions"
   - Click "Create subscription"

2. **Basic Information:**
   - **Subscription ID**: `nuolo_unlimited_monthly`
   - **Name**: `Unlimited Monthly Access`
   - **Description**: `Get unlimited access to all audio guides with new content added monthly. Listen to as many guides as you want with premium narration and offline access.`

3. **Base Plans and Offers:**
   - Click "Add base plan"
   - **Base plan ID**: `monthly-unlimited`
   - **Billing period**: 1 month
   - **Price**: $29.99 USD
   - **Auto-renewing**: Yes

4. **Free Trial (Optional):**
   - **Offer trial**: 3 days (recommended)
   - **Eligibility**: New subscribers only
   - **Countries**: All supported countries

5. **Add Offer (Optional - Launch Promotion):**
   - **Offer ID**: `launch-discount`
   - **Offer type**: Introductory price
   - **Duration**: First month
   - **Price**: $19.99 USD (33% off)
   - **Phases**: Single phase, 1 month
   - **Eligibility**: New subscribers only

6. **Advanced Settings:**
   - **Grace period**: 3 days (recommended)
   - **Account hold**: 30 days (recommended)
   - **Proration mode**: Immediate without proration
   - **Resubscribe**: Allow

7. **Add Translations:**
   - Localize subscription name and description
   - Ensure benefits are clear in each market

8. **Click "Save"**

## Step 4: Configure Pricing Templates

**Create Global Pricing Template:**

1. **Go to "Pricing templates"**
2. **Create new template: "Nuolo Global Pricing"**
3. **Set target countries and pricing:**

   **Basic Package ($3.99):**
   - USD: $3.99
   - EUR: €3.99
   - GBP: £3.49
   - CAD: $4.99
   - AUD: $5.99
   - JPY: ¥490

   **Standard Package ($9.99):**
   - USD: $9.99
   - EUR: €9.99
   - GBP: £8.99
   - CAD: $12.99
   - AUD: $14.99
   - JPY: ¥1,220

   **Premium Package ($19.99):**
   - USD: $19.99
   - EUR: €19.99
   - GBP: £17.99
   - CAD: $24.99
   - AUD: $29.99
   - JPY: ¥2,400

   **Unlimited Monthly ($29.99):**
   - USD: $29.99
   - EUR: €29.99
   - GBP: £26.99
   - CAD: $37.99
   - AUD: $44.99
   - JPY: ¥3,680

4. **Apply template to all products**

## Step 5: Set Up Google Play Billing

**Verify Integration:**

1. **Check Billing Library Version:**
   - Ensure using Google Play Billing Library 5.0+
   - Update if necessary

2. **Test Connection:**
   - Verify your app can connect to Play Billing
   - Test product loading in sandbox environment

3. **Receipt Verification:**
   - Set up server-side verification
   - Configure webhook notifications for real-time updates

## Step 6: Testing Configuration

### Internal Testing Track

1. **Upload Test APK:**
   - Build and upload your app with new IAP integration
   - Include test accounts in internal testing

2. **License Testing:**
   - Add test accounts under "Settings > License Testing"
   - Add accounts that should have purchase success
   - Optionally add accounts that should fail for error testing

3. **Test Scenarios:**

   **Basic Package:**
   - Verify $3.99 purchase flow
   - Test offline access after purchase
   - Confirm 5 attraction limit enforcement

   **Standard Package:**
   - Test $9.99 purchase with "Most Popular" UI
   - Verify 20 attraction access
   - Test exclusive content access

   **Premium Package:**
   - Test $19.99 purchase with "Best Value" UI
   - Verify 50 attraction access
   - Test all premium features

   **Unlimited Subscription:**
   - Test subscription signup
   - Verify unlimited access
   - Test subscription management
   - Test cancellation flow

### Production Testing Checklist

- [ ] All product IDs match your app code exactly
- [ ] Prices are correct in major markets
- [ ] Descriptions are clear and compelling
- [ ] Translations are accurate and localized
- [ ] Purchase flows work end-to-end
- [ ] Receipt validation works correctly
- [ ] Restore purchases functions properly
- [ ] Subscription management is accessible

## Step 7: Real-Time Developer Notifications

**Set up webhooks for subscription events:**

1. **Go to "Monetization Settings"**
2. **Cloud Pub/Sub notifications:**
   - **Topic name**: `nuolo-play-billing`
   - **Create topic** in Google Cloud Console if needed

3. **Configure webhook endpoint:**
   ```
   https://your-api.com/webhooks/google-play-billing
   ```

4. **Handle notification types:**
   - `SUBSCRIPTION_PURCHASED`
   - `SUBSCRIPTION_RENEWED`
   - `SUBSCRIPTION_CANCELED`
   - `SUBSCRIPTION_ON_HOLD`
   - `SUBSCRIPTION_RECOVERED`

## Revenue Optimization

**Expected Revenue** (after Google's 30% cut):
- Basic: $2.79 per purchase
- Standard: $6.99 per purchase  
- Premium: $13.99 per purchase
- Unlimited: $20.99 per month

**Reduced Commission** (after 12 months or $1M revenue):
- Commission drops to 15%
- Basic: $3.39 per purchase
- Standard: $8.49 per purchase
- Premium: $16.99 per purchase
- Unlimited: $25.49 per month

## Step 8: Launch Strategy

### Soft Launch (Recommended)

1. **Select Test Markets:**
   - Canada, Australia, New Zealand
   - Test pricing and conversion rates
   - Gather user feedback

2. **Monitor Metrics:**
   - Install-to-purchase conversion
   - Revenue per user (RPU)
   - Package selection distribution
   - Subscription retention rates

3. **Iterate Based on Data:**
   - Adjust pricing if needed
   - Modify package positioning
   - Optimize paywall UI

### Global Launch

1. **Roll out to all countries**
2. **Monitor performance across regions**
3. **Localize marketing based on performance**

## Common Issues and Solutions

**Issue: "Developer payload verification failed"**
- Solution: Ensure your app correctly handles the developerPayload field
- Update to latest Google Play Billing Library

**Issue: "Item not found"**
- Solution: Verify product IDs match exactly between app and console
- Ensure products are set to "Active" status

**Issue: "Subscription not available in user's country"**
- Solution: Check country/region restrictions in console
- Ensure pricing is set for user's market

**Issue: "Authentication required"**
- Solution: User needs valid payment method
- Guide users to add payment method in Play Store

## Analytics and Monitoring

**Key Metrics to Track:**

1. **Conversion Rates:**
   - Free-to-paid conversion: Target >3%
   - Package selection rates: Monitor Standard vs Premium
   - Subscription signup rate from packages

2. **Revenue Metrics:**
   - Average Revenue Per User (ARPU): Target $8-15
   - Monthly Recurring Revenue (MRR) from subscriptions
   - Lifetime Value (LTV) by package type

3. **User Behavior:**
   - Time to first purchase
   - Package upgrade patterns
   - Subscription churn rate: Target <5% monthly

**Tools Integration:**
- Firebase Analytics for user behavior
- Google Analytics for e-commerce tracking
- RevenueCat or similar for subscription analytics

## Compliance and Policies

**Google Play Policies:**
- ✅ Clearly describe what users get for each purchase
- ✅ Don't use misleading pricing (e.g., fake sales)
- ✅ Provide clear subscription management options
- ✅ Honor cancellation requests properly
- ✅ Follow content policy for audio guides

**GDPR Compliance:**
- Obtain proper consent for data processing
- Allow data deletion requests
- Provide clear privacy policy
- Handle EU subscription cancellations properly

## Support Resources

- **Google Play Console Help**: https://support.google.com/googleplay/android-developer
- **Google Play Billing Documentation**: https://developer.android.com/google/play/billing
- **Policy Guidelines**: https://play.google.com/about/developer-content-policy/

## Post-Launch Optimization

1. **A/B Testing:**
   - Test different package naming
   - Experiment with pricing (create new product IDs)
   - Try different subscription trial lengths

2. **Seasonal Campaigns:**
   - Holiday promotions with introductory pricing
   - Travel season discounts
   - Back-to-school promotions

3. **User Feedback Integration:**
   - Monitor reviews for pricing feedback
   - Survey users about package preferences  
   - Adjust offerings based on usage patterns

Remember: Always test thoroughly before going live, and monitor performance closely after launch!