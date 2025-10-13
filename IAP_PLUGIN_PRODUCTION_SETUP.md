# Expo IAP - Production Setup Guide

## Overview
Nuolo now uses [`expo-iap`](https://hyochan.github.io/expo-iap/docs/intro), the community-maintained successor to `expo-in-app-purchases`. This module ships with its own config plugin, requires Kotlin 2.x on Android, and expects the StoreKit entitlement to be present in the iOS provisioning profile.

## Current Status
- ✅ **Package Installed**: `expo-iap` (plus `expo-build-properties` for Kotlin override)
- ✅ **MonetizationService**: Migrated to the new API (initConnection, purchaseUpdatedListener, etc.)
- ✅ **Expo Plugins**: `expo-iap` and `expo-build-properties` declared in `app.config.js`
- ⚠️ **Provisioning Profile**: Regenerate after enabling `com.apple.developer.in-app-purchase`

## How It Works

### Config Plugin & Native Dependencies
- `expo-iap` injects the Google Play Billing dependency and `com.android.vending.BILLING` permission automatically.
- `expo-build-properties` pins Kotlin ≥ 2.1.20 so Android builds satisfy Billing v8 requirements.
- On iOS, autolinking works once the StoreKit capability is enabled and the updated provisioning profile is used for EAS builds.

## Configuration

### 1. Install Dependencies
```bash
npm install expo-iap expo-build-properties
```

### 2. Update `app.config.js`
```javascript
plugins: [
  'expo-router',
  ['expo-location', { /* ... */ }],
  ['expo-av', { /* ... */ }],
  'expo-audio',
  'expo-secure-store',
  'expo-font',
  'expo-web-browser',
  'expo-iap',
  [
    'expo-build-properties',
    {
      android: {
        kotlinVersion: '2.1.20'
      }
    }
  ]
],

ios: {
  bundleIdentifier: 'com.nuolo.app',
  entitlements: {
    'com.apple.developer.in-app-payments': ['merchant.com.nuolo.app'],
    'com.apple.developer.in-app-purchase': true
  },
  // ...
},

android: {
  package: 'com.nuolo.app',
  // Billing permission is injected by the plugin but keeping it explicit is fine.
  permissions: ['com.android.vending.BILLING', /* ... */],
  // ...
}
```

### 3. App Store & Play Console
- App Store Connect: enable In-App Purchase capability on `com.nuolo.app`, regenerate the distribution profile, and ensure all products are approved.
- Google Play Console: products must be active in an internal track; no additional manifest edits are required beyond the plugin.

### 4. Testing Strategy

#### Development Testing (Current Status)
```bash
# Local development - IAP functions return test data
nvm use 18
npm run start

# Note: initConnection will fail in Expo Go/simulator
# This is expected - use mock data for development
```

#### TestFlight/Internal Testing
```bash
# Build for TestFlight
eas build --profile production --platform ios

# Native modules are packaged via expo-iap plugin
# Ensure you install the build produced after enabling the StoreKit entitlement
```

#### Testing IAP Functionality
1. **iOS Sandbox Testing**:
   - Create sandbox test users in App Store Connect
   - Sign out of App Store on device
   - Sign in with sandbox account when testing
   - Test purchases, subscriptions, and restoration

2. **Android Testing**:
   - Add test accounts in Google Play Console
   - Use internal testing track
   - Test purchases with test payment methods

### 5. Production Deployment Checklist

#### Pre-Deployment
- [ ] IAP products approved in App Store Connect
- [ ] Google Play products published and active
- [ ] Subscription management URLs configured
- [ ] Receipt validation endpoints tested
- [ ] Store listing compliance (IAP disclosure)
- [ ] Privacy policy updated with IAP information
- [ ] Terms of service include subscription terms

#### Deployment Steps
```bash
# Build production versions (autolinking handles IAP)
eas build --profile production --platform ios
eas build --profile production --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

#### Post-Deployment
- [ ] Monitor IAP transaction success rates
- [ ] Verify subscription renewals
- [ ] Test purchase restoration on fresh installs
- [ ] Monitor error logs for IAP issues
- [ ] Set up revenue monitoring dashboards

### 6. Troubleshooting

#### "Failed to connect to in-app purchase service"
**Cause**: Running on Expo Go or simulator without proper configuration
**Solution**:
- Use physical device with TestFlight or internal testing build
- Ensure IAP products are set up in App Store Connect/Google Play Console
- Verify app is signed with correct provisioning profile
- Check that billing permissions are included

#### "expo-iap plugin not configured"
**Cause**: `expo-iap`/`expo-build-properties` missing from `app.config.js`
**Solution**: Add both plugins, re-run `npm install`, and rebuild with EAS

#### IAP Not Working on Device
1. **iOS**:
   - Verify app is signed with production/distribution certificate
   - Check that products are approved in App Store Connect
   - Ensure device is not jailbroken
   - Sign out and sign in with sandbox account
   - Wait 24-48 hours after product creation for propagation

2. **Android**:
   - Ensure app is uploaded to Play Console (internal testing minimum)
   - Verify billing permission is in manifest
   - Check that test account is added to testers
   - Ensure device has Google Play Store installed and updated

#### Debug Commands
```bash
# Check expo configuration
npx expo config --type introspect

# Validate dependencies
npx expo install --check

# Check for build issues
eas build:configure

# View device logs
npx expo logs
```

### 7. Monitoring and Analytics

#### Production Monitoring
- Track IAP conversion rates
- Monitor failed transactions
- Set up alerts for IAP errors
- Implement purchase analytics
- Track subscription lifecycle events

#### Key Metrics
- Purchase success rate (target: >95%)
- Subscription retention (monthly/yearly)
- Revenue per user (ARPU)
- Churn rate and reasons
- Failed transaction patterns

#### Recommended Tools
- RevenueCat (subscription analytics and management)
- Firebase Analytics (user behavior tracking)
- App Store Analytics / Google Play Console (native analytics)
- Sentry (error tracking)

### 8. Security Considerations

#### Receipt Validation
Always validate receipts server-side:
- iOS: Validate with Apple's verifyReceipt endpoint
- Android: Validate with Google Play Developer API
- Never trust client-side purchase verification alone
- Implement replay attack prevention

#### Best Practices
- Store transaction IDs to prevent duplicate processing
- Implement server-side subscription status checks
- Use webhook notifications for subscription events
- Encrypt sensitive transaction data
- Rate limit IAP endpoints

## Next Steps

1. ✅ **Current**: Package installed, autolinking configured
2. 📋 **Next**: Set up products in App Store Connect / Google Play Console
3. 📋 **Then**: Test on physical device via TestFlight/Internal Testing
4. 📋 **Finally**: Deploy to production and monitor metrics

## Support Resources

- [Expo IAP Documentation](https://hyochan.github.io/expo-iap/docs/intro)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Apple In-App Purchase Programming Guide](https://developer.apple.com/in-app-purchase/)
- [Google Play Billing Integration](https://developer.android.com/google/play/billing/integrate)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)

---

**Note**: The monetization system now depends on the `expo-iap` config plugin, updated StoreKit entitlements, and Kotlin 2.x. Always rebuild with EAS after changing these settings to ensure the native binaries include the proper capabilities.
