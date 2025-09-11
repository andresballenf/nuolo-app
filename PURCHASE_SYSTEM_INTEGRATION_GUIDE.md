# Nuolo Purchase System Integration Guide

## Overview

This comprehensive purchase and subscription system provides:

- **Free Tier**: 2 attraction audio guides included
- **Paywall**: Non-intrusive presentation when limit reached
- **Package Purchases**: Individual attraction bundles
- **Subscriptions**: Unlimited access plans
- **Restoration**: Cross-device purchase recovery
- **Management**: Full subscription lifecycle
- **Analytics**: A/B testing and conversion tracking

## Architecture Overview

### Context Hierarchy
```
QueryClientProvider
└── PrivacyProvider
    └── AppProvider
        └── AuthProvider
            └── PurchaseProvider  ← New addition
                └── OnboardingProvider
                    └── AudioProvider
```

### Core Components

1. **PurchaseContext** - Global state management
2. **PaywallModal** - Purchase flow presentation
3. **SubscriptionManager** - Account management interface
4. **EntitlementStatus** - User status indicators
5. **PurchaseRestoreFlow** - Purchase restoration workflow

## Quick Start

### 1. Install Dependencies

```bash
npm install expo-in-app-purchases date-fns expo-linear-gradient react-native-reanimated
```

### 2. Configure App Store Products

**iOS (App Store Connect):**
- `com.nuolo.subscription.monthly` - Monthly Premium
- `com.nuolo.subscription.yearly` - Yearly Premium
- `com.nuolo.package.city_highlights` - City Highlights Package
- `com.nuolo.package.museums` - Museums Package
- `com.nuolo.package.architecture` - Architecture Package

**Android (Google Play Console):**
- Same product IDs as iOS
- Configure billing permissions in `app.json`

### 3. Database Setup

Run the migration:
```bash
cd supabase
npx supabase db push
```

### 4. Basic Integration

```tsx
import { usePurchaseIntegration } from '../hooks/usePurchaseIntegration';

function AttractionCard({ attraction }: { attraction: PointOfInterest }) {
  const {
    getAttractionCTA,
    handleAttractionInteraction,
  } = usePurchaseIntegration();

  const cta = getAttractionCTA(attraction.id);

  return (
    <View>
      <Text>{attraction.name}</Text>
      <Button
        title={cta.text}
        onPress={() => handleAttractionInteraction(attraction, cta.action)}
        variant={cta.variant}
        disabled={cta.disabled}
      />
    </View>
  );
}
```

## Component Usage

### PaywallModal

```tsx
import { PaywallModal } from '../components/purchase';

function MapScreen() {
  const { paywallVisible, hidePaywall } = usePaywallFlow();

  return (
    <>
      {/* Your map content */}
      <PaywallModal
        visible={paywallVisible}
        onClose={hidePaywall}
      />
    </>
  );
}
```

### EntitlementStatus

```tsx
import { EntitlementStatus } from '../components/purchase';

// Banner variant - shows for urgent states
<EntitlementStatus variant="banner" />

// Compact variant - always visible status
<EntitlementStatus variant="compact" />

// Detailed variant - full information display
<EntitlementStatus variant="detailed" showUpgradeButton={true} />
```

### SubscriptionManager

```tsx
import { SubscriptionManager } from '../components/purchase';

function AccountScreen() {
  return (
    <SubscriptionManager
      onUpgrade={() => {
        // Custom upgrade flow
      }}
      onManageBilling={() => {
        // Custom billing management
      }}
    />
  );
}
```

## Integration Points

### 1. Audio Guide Generation

```tsx
function AudioGuideButton({ attraction }: { attraction: PointOfInterest }) {
  const { generateAudioGuideWithValidation } = usePurchaseIntegration();

  const handleGenerate = async () => {
    const success = await generateAudioGuideWithValidation(attraction, {
      language: 'en',
      audioLength: 'medium',
      voiceStyle: 'casual',
    });
    
    if (success) {
      console.log('Audio guide generated successfully');
    }
  };

  return (
    <Button title="Generate Audio Guide" onPress={handleGenerate} />
  );
}
```

### 2. Bottom Sheet Integration

```tsx
import { MaterialBottomSheet } from '../components/ui/MaterialBottomSheet';
import { EntitlementStatus } from '../components/purchase';

function MapWithBottomSheet() {
  return (
    <>
      {/* Map content */}
      
      {/* Status banner */}
      <EntitlementStatus variant="banner" />
      
      <MaterialBottomSheet
        contentType="attractions"
        attractions={attractions}
        // ... other props
      />
    </>
  );
}
```

### 3. Navigation Integration

```tsx
function TabNavigator() {
  const { entitlements } = usePurchase();

  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Map" 
        component={MapScreen} 
      />
      <Tab.Screen
        name="Premium"
        component={SubscriptionScreen}
        options={{
          tabBarBadge: entitlements.status === 'free' ? '!' : undefined,
        }}
      />
    </Tab.Navigator>
  );
}
```

## Advanced Features

### A/B Testing

The system includes automatic A/B testing for pricing display:

```tsx
// Variant A: Standard pricing
"$59.99/year"

// Variant B: Monthly equivalent
"$4.99/month (billed annually)"
```

Access the variant in your components:
```tsx
const { pricingVariant } = usePurchase();
```

### Analytics Integration

Track purchase events:
```tsx
const { paywallVisible, paywallTrigger } = usePaywallFlow();

useEffect(() => {
  if (paywallVisible) {
    // Track paywall display
    analytics.track('paywall_shown', {
      trigger: paywallTrigger,
      user_status: entitlements.status,
    });
  }
}, [paywallVisible, paywallTrigger]);
```

### Error Handling

```tsx
const { purchaseError, clearError } = usePurchase();

if (purchaseError) {
  return (
    <PurchaseErrorState
      variant="payment"
      title="Purchase Failed"
      message={purchaseError.userFriendly}
      onAction={clearError}
    />
  );
}
```

## Customization

### Theme Integration

All components use your existing color scheme:
- Primary color: `#84cc16`
- Component variants: `primary`, `secondary`, `outline`
- Consistent with existing `Button` and `MaterialBottomSheet` patterns

### Localization

```tsx
// Update product descriptions based on user language
const { userPreferences } = useApp();
const localizedPlans = subscriptionPlans.map(plan => ({
  ...plan,
  description: getLocalizedDescription(plan.id, userPreferences.language),
}));
```

### Custom Purchase Flows

```tsx
function CustomPurchaseFlow() {
  const { purchaseSubscription, purchasePackage } = usePurchase();
  
  const handleCustomPurchase = async (productId: string) => {
    // Add custom validation
    if (!validatePurchaseConditions()) {
      return;
    }
    
    // Custom analytics
    trackCustomPurchaseStart(productId);
    
    // Execute purchase
    const success = productId.includes('subscription')
      ? await purchaseSubscription(productId)
      : await purchasePackage(productId);
    
    if (success) {
      trackCustomPurchaseSuccess(productId);
    }
  };

  return (
    // Your custom UI
    <></>
  );
}
```

## Security Considerations

### Server-Side Validation

**Important**: Implement server-side receipt validation for production:

```typescript
// Server-side function
async function validatePurchase(transactionId: string, receipt: string) {
  // Validate with Apple/Google
  const isValid = await validateWithStore(receipt);
  
  if (isValid) {
    // Update user entitlements in database
    await updateUserEntitlements(userId, transactionData);
  }
  
  return isValid;
}
```

### Data Protection

- Purchase data is encrypted in transit
- User entitlements use Row Level Security (RLS)
- No sensitive payment data stored locally
- Receipt validation data properly secured

## Testing

### Test Products

Configure test products in App Store Connect/Google Play Console for development:

```typescript
const TEST_PRODUCT_IDS = {
  MONTHLY_TEST: 'com.nuolo.test.monthly',
  YEARLY_TEST: 'com.nuolo.test.yearly',
  PACKAGE_TEST: 'com.nuolo.test.package',
};
```

### Integration Testing

```tsx
// Test component with mock context
function TestPurchaseFlow() {
  return (
    <MockPurchaseProvider initialState={{ status: 'free', freeGuidesUsed: 1 }}>
      <PurchaseIntegratedExample />
    </MockPurchaseProvider>
  );
}
```

## Performance Optimization

### Lazy Loading

```tsx
const PaywallModal = lazy(() => import('../components/purchase/PaywallModal'));
const SubscriptionManager = lazy(() => import('../components/purchase/SubscriptionManager'));
```

### Caching

```tsx
// React Query integration for product data
const { data: products } = useQuery(['products'], fetchProducts, {
  staleTime: 1000 * 60 * 60, // 1 hour
  cacheTime: 1000 * 60 * 60 * 24, // 24 hours
});
```

## Deployment Checklist

### App Store Submission

- [ ] Configure In-App Purchase products
- [ ] Set up App Store Connect banking/tax info
- [ ] Submit for review with purchase functionality
- [ ] Test with TestFlight sandbox accounts

### Google Play Submission

- [ ] Configure Google Play Console products
- [ ] Set up merchant account
- [ ] Upload signed AAB with billing permissions
- [ ] Test with license testers

### Production Setup

- [ ] Run database migrations
- [ ] Configure environment variables
- [ ] Set up analytics tracking
- [ ] Implement server-side receipt validation
- [ ] Monitor purchase success rates

## Troubleshooting

### Common Issues

**1. Products not loading:**
- Check product IDs match exactly
- Verify App Store Connect/Google Play configuration
- Ensure app version matches store listing

**2. Purchases failing:**
- Check device payment method setup
- Verify sandbox vs production environment
- Review receipt validation logic

**3. Restore not working:**
- Ensure same Apple ID/Google account
- Check product IDs in restore logic
- Verify subscription status in store

**4. Paywall not showing:**
- Check entitlement logic in `usePurchaseIntegration`
- Verify context provider hierarchy
- Review modal visibility state management

## Support

For implementation support:

1. Check the `PurchaseIntegratedExample.tsx` for complete usage patterns
2. Review hook implementations in `usePurchaseIntegration.ts`
3. Test with the provided database schema and seed data
4. Use the loading states and error components for user feedback

The system is designed to be production-ready with proper error handling, accessibility compliance, and platform-specific optimizations.