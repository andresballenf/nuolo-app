# Nuolo Purchase System Integration Guide

## Overview

Nuolo monetization is built around `MonetizationContext` and RevenueCat native paywalls.

- **Free tier**: 2 attraction audio guides included
- **Official paywall**: `RevenueCatPaywallModal`
- **Packages**: consumable credits (`basic_package`, `standard_package`, `premium_package`)
- **Subscription**: `unlimited_monthly`
- **Restore flow**: cross-device purchase recovery
- **Management UI**: subscription + entitlement components under `components/purchase`

## Architecture Overview

### Provider Hierarchy

```text
QueryClientProvider
└── PrivacyProvider
    └── AppProvider
        └── MapSettingsProvider
            └── AuthProvider
                └── OnboardingProvider
                    └── AudioProvider
                        └── MonetizationProvider
```

### Core Modules

1. **MonetizationContext** (`contexts/MonetizationContext.tsx`) - single source of truth for subscription/entitlements and paywall visibility
2. **RevenueCatPaywallModal** (`components/ui/RevenueCatPaywallModal.tsx`) - official paywall UI
3. **Purchase integration hooks** (`hooks/usePurchaseIntegration.ts`) - compatibility layer + flow helpers
4. **Purchase UI components** (`components/purchase/*`) - status, restore, and subscription management
5. **MonetizationService** (`services/MonetizationService.ts`) - RevenueCat + Supabase orchestration

## Quick Start

### 1. Environment Variables

Set RevenueCat keys in your environment:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxx
```

### 2. Basic Access-Control Integration

```tsx
import { usePurchaseIntegration } from '../hooks/usePurchaseIntegration';

function AttractionCard({ attraction }: { attraction: PointOfInterest }) {
  const {
    getAttractionCTA,
    handleAttractionInteraction,
  } = usePurchaseIntegration();

  const cta = getAttractionCTA(attraction.id);

  return (
    <Button
      title={cta.text}
      onPress={() => handleAttractionInteraction(attraction, cta.action)}
      variant={cta.variant}
      disabled={cta.disabled}
    />
  );
}
```

### 3. Official Paywall Wiring

```tsx
import { RevenueCatPaywallModal } from '../components/ui/RevenueCatPaywallModal';
import { useMonetization } from '../contexts/MonetizationContext';

function MapScreen() {
  const { showPaywall, setShowPaywall, paywallContext } = useMonetization();

  return (
    <>
      {/* map and content */}
      <RevenueCatPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        trigger={paywallContext?.trigger}
        attractionId={paywallContext?.attractionId}
        attractionName={paywallContext?.attractionName}
      />
    </>
  );
}
```

## Component Usage

### EntitlementStatus

```tsx
import { EntitlementStatus } from '../components/purchase';

<EntitlementStatus variant="banner" />
<EntitlementStatus variant="compact" />
<EntitlementStatus variant="detailed" showUpgradeButton={true} />
```

### SubscriptionManager

```tsx
import { SubscriptionManager } from '../components/purchase';

function AccountScreen() {
  return <SubscriptionManager />;
}
```

### PurchaseRestoreFlow

```tsx
import { PurchaseRestoreFlow } from '../components/purchase';

<PurchaseRestoreFlow />
```

## Integration Points

### 1. Audio Guide Generation Guard

```tsx
import { useContentAccess, useMonetization } from '../contexts/MonetizationContext';
import { useAudio } from '../contexts/AudioContext';

function AudioGuideButton({ attraction }: { attraction: PointOfInterest }) {
  const { generateAudioGuideWithValidation } = useContentAccess();
  const { setShowPaywall, recordAttractionUsage } = useMonetization();
  const { generateAudioGuide } = useAudio();

  const handleGenerate = async () => {
    const validation = await generateAudioGuideWithValidation(attraction.id, attraction.name);

    if (!validation.canGenerate) {
      if (validation.shouldShowPaywall) {
        setShowPaywall(true, validation.paywallContext);
      }
      return;
    }

    const success = await generateAudioGuide(attraction);
    if (success && validation.shouldRecordUsage) {
      await recordAttractionUsage(attraction.id);
    }
  };

  return <Button title="Generate Audio Guide" onPress={handleGenerate} />;
}
```

### 2. Navigation Badge Example

```tsx
import { useMonetization } from '../contexts/MonetizationContext';

function TabNavigator() {
  const { entitlements, subscription } = useMonetization();
  const isFree = !subscription.isActive && !entitlements.hasUnlimitedAccess;

  return (
    <Tab.Navigator>
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen
        name="Premium"
        component={SubscriptionScreen}
        options={{ tabBarBadge: isFree ? '!' : undefined }}
      />
    </Tab.Navigator>
  );
}
```

### 3. Subscription and Package Actions

```tsx
import { useSubscriptionManagement } from '../hooks/usePurchaseIntegration';

function UpgradeCTA() {
  const {
    handleSubscriptionPurchase,
    handlePackagePurchase,
    purchaseError,
    isLoading,
  } = useSubscriptionManagement();

  if (purchaseError) {
    return <Text>{purchaseError.userFriendly}</Text>;
  }

  return (
    <>
      <Button title="Go Unlimited" disabled={isLoading} onPress={() => handleSubscriptionPurchase('unlimited_monthly')} />
      <Button title="Buy Basic Package" disabled={isLoading} onPress={() => handlePackagePurchase('basic_package')} />
    </>
  );
}
```

## Testing

### Required Runtime

RevenueCat purchases and native paywalls require a development build or production build (not Expo Go).

```bash
npx expo run:ios
# or
npx expo run:android
```

### Functional Checks

- Trigger paywall via free-tier exhaustion and verify `RevenueCatPaywallModal` appears
- Complete a sandbox purchase and confirm entitlement refresh
- Restore purchases and confirm subscription/package restoration
- Verify free-tier users are blocked at limit and prompted with paywall

## Performance Optimization

### Lazy Loading

```tsx
const SubscriptionManager = lazy(() => import('../components/purchase/SubscriptionManager'));
const PurchaseRestoreFlow = lazy(() => import('../components/purchase/PurchaseRestoreFlow'));
```

### Caching

Keep product/entitlement data cache-friendly through React Query and explicit `refreshEntitlements()` on purchase/restore events.

## Deployment Checklist

### App Store / Play Store

- [ ] `nuolo_unlimited_monthly` product configured and active
- [ ] Package products configured and active (`nuolo_basic_package`, `nuolo_standard_package`, `nuolo_premium_package`)
- [ ] RevenueCat offerings and paywall template published
- [ ] Sandbox/test accounts validated

### App Configuration

- [ ] RevenueCat API keys set in EAS environment
- [ ] `npm run check:repo` passing
- [ ] Webhook flow verified (`supabase/functions/revenuecat-webhook`)

## Troubleshooting

### Common Issues

1. **Paywall not shown**: Verify `showPaywall` state and `MonetizationProvider` mount
2. **Products not loaded**: Confirm products are attached to active RevenueCat offering
3. **Purchase fails**: Check platform store setup and development-build runtime
4. **Restore fails**: Confirm test account and app store account consistency

### Recommended Debug Path

1. Inspect `MonetizationContext` `error` and logs
2. Validate `MonetizationService.initialize()` success and RevenueCat configuration
3. Confirm `RevenueCatPaywallModal` is the only paywall entrypoint
4. Re-run `npm run check:official-paywall` and `npm run check:legacy-purchase-imports`
