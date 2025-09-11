# Nuolo Monetization System - Next Steps Guide

## Overview
Your monetization system has been successfully implemented and integrated with the existing database. This guide provides the step-by-step process to get your in-app purchases live in both Apple App Store and Google Play Store.

## 🛠️ Phase 1: Development Testing (Week 1)

### Step 1: Local Testing Setup
```bash
# 1. Install dependencies (already done)
npm install expo-in-app-purchases date-fns

# 2. Start development server
npx expo start

# 3. Test on physical devices (required for IAP)
npx expo start --ios    # iOS device
npx expo start --android # Android device
```

### Step 2: Test Monetization Components
- [ ] Open the app and verify MonetizationProvider loads without errors
- [ ] Check EntitlementStatus component displays "Free Tier" with "2/2 free guides remaining"
- [ ] Test PaywallModal by triggering it manually (add temp button)
- [ ] Verify free tier limit enforcement (test generating 3rd audio guide)
- [ ] Test error handling with network disconnected

### Step 3: Integration with Audio Generation
Add paywall integration to your existing audio generation flow:

```typescript
// In your audio generation component
import { useContentAccess } from '../contexts/MonetizationContext';

const { generateAudioGuideWithValidation } = useContentAccess();

const handleGenerateAudio = async (attractionId: string, attractionName: string) => {
  const result = await generateAudioGuideWithValidation(attractionId, attractionName);
  
  if (result.canGenerate) {
    // Proceed with your existing audio generation
    await yourExistingAudioGenerationFunction(attractionId);
  } else if (result.shouldShowPaywall && result.paywallContext) {
    // Paywall will show automatically via context
    console.log('Paywall triggered for:', attractionName);
  }
};
```

## 🏪 Phase 2: App Store Configuration (Week 2)

### Step 4: Apple App Store Connect Setup

#### 4.1 Create Products
1. Log into [App Store Connect](https://appstoreconnect.apple.com)
2. Go to your Nuolo app → Features → In-App Purchases
3. Create the following products:

**Subscriptions (Auto-Renewable):**
- Product ID: `nuolo_premium_monthly`
  - Name: "Nuolo Premium Monthly"
  - Subscription Group: "Nuolo Premium"
  - Price: $9.99/month
  - Description: "Unlimited audio guides for all attractions worldwide"

- Product ID: `nuolo_premium_yearly`  
  - Name: "Nuolo Premium Yearly"
  - Subscription Group: "Nuolo Premium"
  - Price: $99.99/year
  - Description: "Unlimited audio guides for all attractions worldwide - Save 17%"

**Non-Consumable (Lifetime):**
- Product ID: `nuolo_lifetime`
  - Name: "Nuolo Lifetime Access"
  - Price: $49.99
  - Description: "One-time purchase for lifetime unlimited access"

**Non-Consumable (Attraction Packs):**
- Product ID: `pack_nyc_landmarks`
  - Name: "NYC Landmarks Pack"  
  - Price: $7.99
  - Description: "5 iconic NYC attractions including Statue of Liberty, Empire State Building"

- Product ID: `pack_paris_museums`
  - Name: "Paris Museums Pack"
  - Price: $8.99  
  - Description: "5 world-famous museums including Louvre, Musée d'Orsay"

- Product ID: `pack_london_royalty`
  - Name: "London Royal Heritage Pack"
  - Price: $6.99
  - Description: "4 royal attractions including Buckingham Palace, Tower of London"

#### 4.2 Configure Subscription Details
- [ ] Set up subscription groups
- [ ] Configure free trial periods (optional: 7-day free trial)
- [ ] Set up promotional offers
- [ ] Add localized descriptions for major markets

#### 4.3 Submit for Review
- [ ] Submit all products for Apple review
- [ ] Wait for approval (usually 24-48 hours)

### Step 5: Google Play Console Setup

#### 5.1 Enable Google Play Billing
1. Go to [Google Play Console](https://play.google.com/console)
2. Select your Nuolo app
3. Go to Monetize → Products → Subscriptions

#### 5.2 Create Base Plans and Offers
**Monthly Subscription:**
- Product ID: `nuolo_premium_monthly`
- Base plan ID: `monthly-base`
- Billing period: Monthly
- Price: $9.99

**Yearly Subscription:**
- Product ID: `nuolo_premium_yearly`  
- Base plan ID: `yearly-base`
- Billing period: Yearly
- Price: $99.99

#### 5.3 Create In-App Products
Go to Monetize → Products → In-app products:
- [ ] `nuolo_lifetime` - $49.99
- [ ] `pack_nyc_landmarks` - $7.99  
- [ ] `pack_paris_museums` - $8.99
- [ ] `pack_london_royalty` - $6.99

#### 5.4 Activate Products
- [ ] Activate all products in Google Play Console
- [ ] Set up real-time developer notifications (optional but recommended)

## 📱 Phase 3: App Build Configuration (Week 3)

### Step 6: Update App Configuration

#### 6.1 Verify app.json Configuration
Already completed - verify these settings exist:
```json
{
  "expo": {
    "plugins": ["expo-in-app-purchases"],
    "ios": {
      "infoPlist": {
        "SKAdNetworkItems": [{"SKAdNetworkIdentifier": "cstr6suwn9.skadnetwork"}]
      }
    },
    "android": {
      "permissions": ["com.android.vending.BILLING"]
    }
  }
}
```

#### 6.2 Environment Variables
Add to your environment configuration:
```bash
# For development testing
EXPO_PUBLIC_IAP_DEBUG=true
```

### Step 7: Build and Test

#### 7.1 Create Development Builds
```bash
# iOS development build
eas build --platform ios --profile development

# Android development build  
eas build --platform android --profile development
```

#### 7.2 TestFlight/Internal Testing
- [ ] Upload iOS build to TestFlight
- [ ] Upload Android build to Google Play Internal Testing
- [ ] Test with sandbox/test accounts
- [ ] Verify all purchase flows work correctly

## 🚀 Phase 4: Production Release (Week 4)

### Step 8: Production Builds

#### 8.1 Create Production Builds
```bash
# Production builds
eas build --platform ios --profile production
eas build --platform android --profile production
```

#### 8.2 Store Submissions
- [ ] Submit iOS build to App Store Review
- [ ] Submit Android build to Google Play Review
- [ ] Include IAP testing instructions for reviewers

### Step 9: Go Live Checklist

#### 9.1 Pre-Launch Verification
- [ ] All IAP products approved and active
- [ ] Subscription management links added to app descriptions
- [ ] Privacy policy updated to mention subscriptions
- [ ] Terms of service updated for IAP terms

#### 9.2 Launch Day
- [ ] Release app updates in both stores
- [ ] Monitor purchase success rates
- [ ] Check error reporting systems
- [ ] Monitor user feedback

## 📊 Phase 5: Post-Launch Monitoring (Ongoing)

### Step 10: Analytics and Optimization

#### 10.1 Set Up Monitoring
```typescript
// Add to your existing analytics
analytics.track('Paywall Viewed', {
  trigger: paywallContext?.trigger,
  attractionId: paywallContext?.attractionId,
});

analytics.track('Purchase Completed', {
  type,
  success,
  error: success ? null : error
});
```

#### 10.2 Key Metrics to Track
- [ ] Paywall conversion rates
- [ ] Free-to-paid conversion percentage
- [ ] Subscription retention rates (monthly/yearly)
- [ ] Revenue per user (ARPU)
- [ ] Churn rates and reasons

#### 10.3 A/B Testing Opportunities
- [ ] Different paywall designs (already supported in PaywallModal)
- [ ] Pricing experiments
- [ ] Free trial length variations
- [ ] Pack content and pricing

### Step 11: Ongoing Optimization

#### 11.1 Monthly Reviews
- [ ] Analyze conversion data
- [ ] Review customer feedback
- [ ] Optimize paywall timing and messaging
- [ ] Adjust pricing if needed

#### 11.2 Feature Enhancements
- [ ] Add referral programs
- [ ] Implement promotional codes
- [ ] Create seasonal packs
- [ ] Add family sharing support

## 🆘 Troubleshooting Guide

### Common Issues and Solutions

**IAP Products Not Loading:**
- Verify product IDs match exactly between app and stores
- Check if products are approved and active
- Ensure app is signed correctly for production testing

**Purchases Not Processing:**
- Check Supabase connection and user authentication
- Verify webhook configuration for receipt validation
- Monitor server logs for processing errors

**Free Tier Not Working:**
- Check `get_user_entitlements()` function in database
- Verify `track_attraction_usage()` is called correctly
- Ensure user authentication is working

### Testing Commands
```bash
# Clear app data for fresh testing
npx expo start --clear

# Debug mode with detailed IAP logging
EXPO_PUBLIC_IAP_DEBUG=true npx expo start

# Test with different user accounts
# (Use TestFlight sandbox accounts or Google Play test accounts)
```

## 📞 Support Resources

- **Expo IAP Documentation:** https://docs.expo.dev/versions/latest/sdk/in-app-purchases/
- **Apple IAP Guide:** https://developer.apple.com/in-app-purchase/
- **Google Play Billing:** https://developer.android.com/google/play/billing
- **Supabase RLS Policies:** https://supabase.com/docs/guides/auth/row-level-security

---

## 📋 Quick Status Checklist

- [ ] Phase 1: Development Testing Complete
- [ ] Phase 2: App Store Products Created and Approved  
- [ ] Phase 3: Production Builds Successful
- [ ] Phase 4: Apps Live in Both Stores
- [ ] Phase 5: Monitoring and Analytics Active

**Estimated Timeline:** 4 weeks to full production launch
**Priority:** Focus on Phase 1 testing first, then proceed sequentially through phases.

Good luck with your monetization launch! 🚀