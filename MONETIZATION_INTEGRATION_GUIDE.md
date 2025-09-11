# Nuolo App - Monetization System Integration Guide

## Overview

This guide provides comprehensive instructions for integrating and using the Nuolo app's in-app purchase and subscription system. The system includes free tier limits, individual attraction purchases, attraction packs, and unlimited subscriptions.

## Architecture

The monetization system consists of:

- **Supabase Database**: Complete schema for subscriptions, purchases, usage tracking, and attraction packs
- **MonetizationService**: Singleton service handling all IAP operations
- **MonetizationContext**: React context providing monetization state and actions
- **UI Components**: PaywallModal, EntitlementStatus, and integration helpers
- **Platform Support**: iOS App Store and Google Play Store compatible

## Database Schema

The system uses the following Supabase tables (already created in migration):

- `user_subscriptions` - Active subscriptions and their status
- `user_purchases` - Individual attraction and pack purchases
- `user_usage` - Free tier usage tracking (2 attractions limit)
- `attraction_packs` - Predefined attraction bundles
- `iap_products` - Platform-specific product configurations

## Quick Start

### 1. Database Setup

Run the database migration to create all necessary tables and functions:

```bash
# Apply the migration file to your Supabase project
supabase db push
```

Or manually execute the SQL in `supabase/migrations/20241211_purchase_system.sql`.

### 2. Store Configuration

#### Apple App Store Connect

1. Create the following products in App Store Connect:
   - **Subscriptions**: `nuolo_premium_monthly`, `nuolo_premium_yearly`, `nuolo_lifetime`
   - **Attraction Packs**: `pack_nyc_landmarks`, `pack_paris_museums`, `pack_london_royalty`

2. Configure subscription groups and pricing tiers
3. Submit for review and approval

#### Google Play Console

1. Create matching products in Google Play Console:
   - Same product IDs as iOS
   - Configure subscription base plans and offers
   - Set pricing and availability

2. Configure real-time developer notifications
3. Publish the products

### 3. App Integration

The MonetizationProvider is already added to your app layout. The system is ready to use with the following hooks:

```tsx
import { useMonetization, useContentAccess } from './contexts/MonetizationContext';

function MyComponent() {
  const { 
    subscription, 
    entitlements, 
    purchaseSubscription,
    showPaywall,
    setShowPaywall 
  } = useMonetization();
  
  const { generateAudioGuideWithValidation } = useContentAccess();
}
```

## UI Components

### PaywallModal

A comprehensive paywall component with A/B testing support:

```tsx
import { PaywallModal } from './components/ui/PaywallModal';

function MapScreen() {
  const { showPaywall, setShowPaywall, paywallContext } = useMonetization();

  return (
    <View>
      {/* Your map content */}
      
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger={paywallContext?.trigger}
        attractionId={paywallContext?.attractionId}
        attractionName={paywallContext?.attractionName}
      />
    </View>
  );
}
```

### EntitlementStatus

Display user's subscription status in different formats:

```tsx
import { EntitlementStatus } from './components/ui/EntitlementStatus';

// Compact version for headers
<EntitlementStatus variant="compact" />

// Banner version for prominent display
<EntitlementStatus 
  variant="banner" 
  onUpgradePress={() => setShowPaywall(true)} 
/>

// Detailed version for settings/profile
<EntitlementStatus variant="detailed" />
```

## Content Gating

### Audio Guide Generation

Integrate content gating into your audio guide generation:

```tsx
import { useContentAccess } from './contexts/MonetizationContext';

function AudioGuideGenerator() {
  const { generateAudioGuideWithValidation } = useContentAccess();
  const { setShowPaywall } = useMonetization();

  const handleGenerateAudio = async (attractionId: string, attractionName: string) => {
    const result = await generateAudioGuideWithValidation(attractionId, attractionName);
    
    if (result.canGenerate) {
      // Proceed with audio generation
      await yourAudioGenerationFunction(attractionId);
    } else if (result.shouldShowPaywall && result.paywallContext) {
      // Show paywall with context
      setShowPaywall(true, result.paywallContext);
    }
  };

  return (
    <Button 
      title="Generate Audio Guide" 
      onPress={() => handleGenerateAudio(attraction.id, attraction.name)}
    />
  );
}
```

### Manual Access Check

For manual content access validation:

```tsx
const { canAccessAttraction } = useMonetization();

const hasAccess = await canAccessAttraction(attractionId);
if (!hasAccess) {
  setShowPaywall(true, {
    trigger: 'premium_attraction',
    attractionId,
    attractionName
  });
  return;
}

// Proceed with premium content
```

## Subscription Management

### Purchase Flows

```tsx
const { purchaseSubscription, purchasePack, restorePurchases } = useMonetization();

// Purchase subscription
const handleSubscribe = async (type: 'monthly' | 'yearly' | 'lifetime') => {
  const success = await purchaseSubscription(type);
  if (success) {
    // Handle success - paywall closes automatically
    Alert.alert('Welcome to Premium!', 'You now have unlimited access.');
  }
};

// Purchase attraction pack
const handleBuyPack = async (packId: string) => {
  const success = await purchasePack(packId);
  if (success) {
    Alert.alert('Pack Purchased!', 'You now have access to all attractions in this pack.');
  }
};

// Restore previous purchases
const handleRestore = async () => {
  await restorePurchases();
  Alert.alert('Purchases Restored', 'Your purchases have been restored.');
};
```

### Subscription Status

Check subscription status and handle different states:

```tsx
const { subscription, entitlements } = useMonetization();

// Check if user has premium access
if (subscription.isActive && subscription.type !== 'free') {
  // Premium user - unlimited access
}

// Check free tier usage
if (entitlements.remainingFreeAttractions > 0) {
  // User has free guides remaining
}

// Check specific ownership
if (entitlements.ownedAttractions.includes(attractionId)) {
  // User owns this specific attraction
}
```

## Error Handling

The system includes comprehensive error handling:

```tsx
const { error, loading } = useMonetization();

if (error) {
  // Display error message
  Alert.alert('Purchase Error', error);
}

if (loading) {
  // Show loading indicator
  return <ActivityIndicator />;
}
```

## Analytics Integration

Track key monetization events:

```tsx
// Track paywall views
useEffect(() => {
  if (showPaywall) {
    analytics.track('Paywall Viewed', {
      trigger: paywallContext?.trigger,
      attractionId: paywallContext?.attractionId,
    });
  }
}, [showPaywall]);

// Track purchase attempts
const handlePurchase = async (type: string) => {
  analytics.track('Purchase Attempted', { type });
  
  const success = await purchaseSubscription(type);
  
  analytics.track('Purchase Completed', {
    type,
    success,
    error: success ? null : error
  });
};
```

## Testing

### Development Testing

1. **iOS Simulator**: Use sandbox accounts for testing purchases
2. **Android Emulator**: Use test accounts and Google Play Console testing
3. **Real Devices**: Required for actual purchase flow testing

### Test Scenarios

1. **Free Tier**: Test 2-attraction limit enforcement
2. **Purchase Flows**: Test subscription and pack purchases
3. **Restore Purchases**: Test cross-device purchase restoration
4. **Error Handling**: Test network failures and cancelled purchases
5. **Subscription Renewal**: Test automatic subscription renewal

### Debugging

Enable detailed logging by setting environment variables:

```bash
# Enable IAP debugging
EXPO_PUBLIC_IAP_DEBUG=true
```

Check console logs for detailed purchase flow information.

## Production Deployment

### Pre-Launch Checklist

1. **Database**: Migration applied to production Supabase
2. **Products**: All IAP products approved in both stores
3. **Testing**: Complete testing with TestFlight and Google Play Internal Testing
4. **Analytics**: Purchase tracking events implemented
5. **Error Monitoring**: Sentry or similar error tracking configured

### Store Submission

1. **iOS**: Submit with IAP products for App Store review
2. **Android**: Upload AAB with billing permission
3. **Both**: Include subscription management links in app descriptions

### Post-Launch Monitoring

Monitor these key metrics:

- **Conversion Rate**: Free-to-paid user conversion
- **Subscription Retention**: Monthly/yearly retention rates
- **Revenue Per User**: Average revenue per active user
- **Churn Rate**: Subscription cancellation rates
- **Purchase Errors**: Failed transaction rates

## Troubleshooting

### Common Issues

1. **Products Not Loading**: Check product IDs match store configuration
2. **Purchases Not Processing**: Verify Supabase connection and user authentication
3. **Restore Not Working**: Check receipt validation and user ID matching
4. **Free Tier Not Working**: Verify usage tracking function execution

### Error Codes

- `INIT_ERROR`: Failed to initialize IAP service
- `PURCHASE_FAILED`: Purchase transaction failed
- `SUBSCRIPTION_FAILED`: Subscription purchase failed
- `RESTORE_FAILED`: Purchase restoration failed

### Support

For monetization system support:

1. Check console logs for detailed error messages
2. Verify Supabase database schema and permissions
3. Test with sandbox/test accounts first
4. Contact platform support for store-specific issues

## Migration from PurchaseContext

If migrating from the existing PurchaseContext:

1. **Data Migration**: Export existing entitlements to new schema
2. **Code Updates**: Replace `usePurchase()` with `useMonetization()`
3. **Testing**: Verify all purchase flows work with new system
4. **Cleanup**: Remove old PurchaseContext after verification

## Security Considerations

- **Receipt Validation**: Server-side validation recommended for production
- **User Authentication**: Always verify user authentication before purchases
- **Data Protection**: Sensitive purchase data encrypted in transit and at rest
- **Fraud Prevention**: Monitor for unusual purchase patterns

This integration guide provides everything needed to implement and maintain the Nuolo app's monetization system. For additional support or custom requirements, refer to the Expo In-App Purchases documentation and platform-specific IAP guides.