# RevenueCat Native Paywall Integration

## Summary

Successfully integrated RevenueCat's native paywall UI and fixed the "no singleton instance" errors that were preventing the monetization system from working properly.

## Changes Made

### 1. Fixed RevenueCat Configuration Errors

**Problem**: The app was showing errors:
```
ERROR  [ERROR] Failed to get subscription status
{"message": "There is no singleton instance. Make sure you configure Purchases before trying to get the default instance."}
```

**Root Cause**: `MonetizationService` set `initialized = true` in dev mode without API keys, but never called `Purchases.configure()`. Later code checked `initialized` and proceeded to call RevenueCat methods, which failed because the SDK was never configured.

**Solution**: Added a new `revenueCatConfigured` flag to separate "initialization attempted" from "SDK actually configured".

**File Modified**: `services/MonetizationService.ts`

**Changes**:
- Added `private revenueCatConfigured = false;` flag (line 91)
- Set `this.revenueCatConfigured = true;` after successful `Purchases.configure()` (line 152)
- Updated 10 methods to check `revenueCatConfigured` before calling RevenueCat APIs:
  - `loadOfferings()` - Added early return check
  - `getAvailableProducts()` - Added check before accessing offerings
  - `purchaseSubscription()` - Added check with error logging
  - `purchaseAttractionPack()` - Added check with error logging
  - `purchaseAttractionPackage()` - Added check with error logging
  - `restorePurchases()` - Added check with error throw
  - `getSubscriptionStatus()` - Changed from `initialized` to `revenueCatConfigured`
  - `getUserEntitlements()` - Changed from `initialized` to `revenueCatConfigured`
  - `setUserId()` - Changed from `initialized` to `revenueCatConfigured`
  - `logoutUser()` - Changed from `initialized` to `revenueCatConfigured`
- Reset flag in `cleanup()` and `dispose()` methods

**Expected Behavior**:
- ✅ **Dev mode without API keys**: Gracefully falls back to Supabase-only mode with warning logs, no errors
- ✅ **Expo Go**: Gracefully degrades, no RevenueCat calls attempted
- ✅ **Production with API keys**: Full RevenueCat functionality works normally
- ✅ **Error resilience**: If configure() fails, app continues with Supabase fallbacks

### 2. Integrated RevenueCat Native Paywall UI

**File Created**: `components/ui/RevenueCatPaywallModal.tsx`

**Benefits of Native Paywall**:
- 🎨 Native UI with platform-specific design (iOS/Android)
- 🔄 Automatically syncs with RevenueCat dashboard configuration
- 📊 Built-in A/B testing support
- 💳 Handles purchase flow automatically
- 🚀 No need to manually manage product display or purchase logic
- ✨ Conversion-optimized design by RevenueCat experts

**Component Features**:
- Uses `RevenueCatUI.Paywall` component from `react-native-purchases-ui`
- Automatically displays offerings configured in RevenueCat dashboard
- Handles purchase flow, restore purchases, and dismiss events
- Refreshes entitlements after purchase or restore
- Proper logging for debugging

**File Modified**: `app/map.tsx`
- Changed import from `PaywallModal` to `RevenueCatPaywallModal` (line 11)
- Updated JSX to use `<RevenueCatPaywallModal>` component (lines 926-933)

## How to Use

### 1. Configure Paywall in RevenueCat Dashboard

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to **Paywalls** section
3. Click **Create Paywall** or edit existing
4. Configure:
   - **Template**: Choose a pre-designed template
   - **Offerings**: Select which offering to display
   - **Design**: Customize colors, images, and text
   - **Features**: Highlight product benefits
   - **A/B Testing**: Optional - create variants

### 2. The Native Paywall Will Display Automatically

The paywall will show when:
- User reaches free tier limit (2 free audio guides)
- User tries to access premium content
- Manual trigger via `setShowPaywall(true)` in MonetizationContext

### 3. Test the Paywall

**In Dev Mode (without API keys)**:
- Paywall will not show RevenueCat UI
- Falls back gracefully to Supabase-only entitlement management
- No errors in console

**In Production (with API keys)**:
- Native paywall displays beautifully
- Shows offerings from RevenueCat dashboard
- Handles purchases automatically
- Syncs entitlements after purchase

## Important Notes

### RevenueCat API Keys

Make sure your `app.config.js` or environment variables have:
```javascript
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_YOUR_IOS_KEY
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_YOUR_ANDROID_KEY
```

### Development Build Required

⚠️ **RevenueCat DOES NOT work in Expo Go**

You must use a development build to test purchases:
```bash
# Create development build
npx expo run:ios
# or
npx expo run:android
```

### Testing Purchases

**iOS**:
- Use Sandbox tester accounts from App Store Connect
- Purchases are free in sandbox mode
- Test subscriptions complete much faster

**Android**:
- Use test accounts added in Google Play Console
- License testing mode must be enabled
- Test purchases are free

## Migration Path

### Old Custom Paywall (components/ui/PaywallModal.tsx)

The old custom paywall is still available if needed:
```typescript
import { PaywallModal } from '../components/ui/PaywallModal';
```

### New RevenueCat Native Paywall (components/ui/RevenueCatPaywallModal.tsx)

The new native paywall is now used by default:
```typescript
import { RevenueCatPaywallModal } from '../components/ui/RevenueCatPaywallModal';
```

**Recommendation**: Use the native paywall for production. It's:
- Better designed
- Easier to maintain (no custom UI code)
- A/B tested by RevenueCat experts
- Automatically updated with new features

## Troubleshooting

### "No singleton instance" errors

✅ **Fixed** - The app now properly checks if RevenueCat is configured before calling SDK methods.

### Paywall not showing

1. Check if `revenueCatConfigured` is true (should log "RevenueCat initialization complete")
2. Verify API keys are set in environment variables
3. Ensure you're using a development build (not Expo Go)
4. Check RevenueCat dashboard has an active offering

### Purchases not working

1. Verify products are created in App Store Connect / Google Play Console
2. Verify products are added to RevenueCat dashboard
3. Check RevenueCat dashboard shows products in "Offerings"
4. Ensure test accounts are properly configured
5. Check logs for specific error messages

## Next Steps

1. ✅ RevenueCat errors fixed
2. ✅ Native paywall integrated
3. 🔄 Configure offerings in RevenueCat dashboard
4. 🔄 Design paywall template
5. 🔄 Create products in App Store Connect & Google Play Console
6. 🔄 Test with sandbox accounts
7. 🔄 Launch to production

## Documentation

- [RevenueCat React Native Purchases](https://github.com/revenuecat/react-native-purchases)
- [RevenueCat UI Documentation](https://github.com/revenuecat/react-native-purchases/blob/main/react-native-purchases-ui/README.md)
- [RevenueCat Paywall Builder](https://www.revenuecat.com/docs/tools/paywalls)
- [Testing Purchases Guide](https://www.revenuecat.com/docs/test-and-launch/testing)
