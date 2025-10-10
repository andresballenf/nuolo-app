# Expo In-App Purchases - Production Setup Guide

## Overview
The `expo-in-app-purchases` package uses React Native's autolinking system and **does not require** a config plugin. The package just needs to be installed as a dependency.

## Current Status
- ✅ **Package Installed**: `expo-in-app-purchases@^14.5.0` in package.json
- ✅ **MonetizationService**: Can import and use IAP functionality
- ✅ **Plugin Configuration**: NOT needed - uses autolinking
- ✅ **Development Server**: Running normally
- ✅ **Production Builds**: Native modules linked automatically via autolinking

## How It Works

### Autolinking
React Native (and Expo) automatically links native modules during the build process. You only need:
1. Package installed in `package.json` dependencies
2. Native permissions configured in app.config.js (iOS entitlements, Android permissions)

### No Plugin Required
Unlike some Expo packages, `expo-in-app-purchases` does NOT have a config plugin. Do not add it to the `plugins` array in app.config.js - it will cause errors.

## Configuration

### 1. Package Installation (Already Done)
```bash
npm install expo-in-app-purchases
```

### 2. iOS Configuration (Already Done)
**app.config.js - iOS section:**
```javascript
ios: {
  bundleIdentifier: "com.nuolo.app",
  entitlements: {
    "com.apple.developer.in-app-payments": [
      "merchant.com.nuolo.app"
    ]
  },
  infoPlist: {
    // ... other permissions
  }
}
```

**App Store Connect Setup:**
1. Create IAP products in App Store Connect
2. Configure subscription groups
3. Set up promotional offers (if needed)
4. Submit products for review
5. Configure payment processing and banking info

### 3. Android Configuration (Already Done)
**app.config.js - Android section:**
```javascript
android: {
  package: "com.nuolo.app",
  permissions: [
    "com.android.vending.BILLING",
    // ... other permissions
  ]
}
```

**Google Play Console Setup:**
1. Enable Google Play Billing API
2. Create subscription products
3. Create in-app products
4. Configure real-time developer notifications
5. Set up licensing
6. Configure payment profile

### 4. Testing Strategy

#### Development Testing (Current Status)
```bash
# Local development - IAP functions return test data
nvm use 18
npm run start

# Note: IAP.connectAsync() will fail in Expo Go/simulator
# This is expected - use mock data for development
```

#### TestFlight/Internal Testing
```bash
# Build for TestFlight
eas build --profile production --platform ios

# Native modules are automatically included
# No plugin configuration needed
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

#### "Package does not contain a valid config plugin"
**Cause**: Attempting to add expo-in-app-purchases to plugins array
**Solution**: Remove it from plugins array - it uses autolinking, not a config plugin

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

- [Expo In-App Purchases Documentation](https://docs.expo.dev/versions/latest/sdk/in-app-purchases/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Apple In-App Purchase Programming Guide](https://developer.apple.com/in-app-purchase/)
- [Google Play Billing Integration](https://developer.android.com/google/play/billing/integrate)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)

---

**Note**: The monetization system implementation is complete and functional. No plugin configuration is needed - the native modules are automatically linked during the build process. IAP functionality will work in TestFlight/production builds once products are configured in the respective stores.
