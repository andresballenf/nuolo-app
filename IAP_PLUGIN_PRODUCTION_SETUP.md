# Expo In-App Purchases Plugin - Production Setup Guide

## Overview
The `expo-in-app-purchases` plugin currently has configuration issues in development but needs to be properly set up for production builds to enable IAP functionality on iOS and Android.

## Current Status
- ✅ **Package Installed**: `expo-in-app-purchases@^14.5.0`
- ✅ **MonetizationService**: Can import and use IAP functionality
- ❌ **Plugin Configuration**: Currently removed from app.json due to module loading errors
- ✅ **Development Server**: Running without plugin registration

## Production Build Requirements

### 1. Plugin Configuration Options

#### Option A: Development Build (Recommended)
For development builds where you need to test IAP on physical devices:

```bash
# Create development build with IAP plugin
eas build --profile development --platform ios
eas build --profile development --platform android
```

**app.json configuration:**
```json
{
  "expo": {
    "plugins": [
      "expo-router",
      ["expo-location", { ... }],
      ["expo-av", { ... }],
      "expo-audio",
      "expo-secure-store", 
      "expo-font",
      "expo-in-app-purchases"
    ]
  }
}
```

#### Option B: Production Build Only
Add the plugin only when building for production:

**Create separate app.config.js:**
```javascript
const isProduction = process.env.EAS_BUILD_PROFILE === 'production';

export default {
  expo: {
    // ... other config
    plugins: [
      "expo-router",
      ["expo-location", { ... }],
      ["expo-av", { ... }],
      "expo-audio",
      "expo-secure-store",
      "expo-font",
      ...(isProduction ? ["expo-in-app-purchases"] : [])
    ]
  }
};
```

### 2. EAS Build Configuration

**eas.json setup:**
```json
{
  "build": {
    "development": {
      "distribution": "internal",
      "ios": {
        "buildConfiguration": "Debug",
        "bundleIdentifier": "com.nuolo.app.dev"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "buildConfiguration": "Release",
        "bundleIdentifier": "com.nuolo.app.preview"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  }
}
```

### 3. Platform-Specific Setup

#### iOS Configuration
**app.json - iOS section:**
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.nuolo.app",
      "supportsTablet": true,
      "config": {
        "googleMapsApiKey": "AIzaSyDuVcq_dM6rnHNokT_M6WHCi3mN91XXNMk"
      },
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Nuolo uses your location to discover nearby attractions and provide location-based audio tours.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Nuolo uses your location to discover nearby attractions and provide location-based audio tours.",
        "NSMicrophoneUsageDescription": "Nuolo may access the microphone for voice interactions and audio features.",
        "SKAdNetworkItems": [
          {
            "SKAdNetworkIdentifier": "cstr6suwn9.skadnetwork"
          }
        ]
      }
    }
  }
}
```

**App Store Connect Setup:**
1. Create IAP products in App Store Connect
2. Configure subscription groups
3. Set up promotional offers (if needed)
4. Submit products for review

#### Android Configuration
**app.json - Android section:**
```json
{
  "expo": {
    "android": {
      "package": "com.nuolo.app",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION", 
        "RECORD_AUDIO",
        "INTERNET",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "com.android.vending.BILLING"
      ],
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#84cc16"
      }
    }
  }
}
```

**Google Play Console Setup:**
1. Enable Google Play Billing API
2. Create subscription products
3. Create in-app products
4. Configure real-time developer notifications
5. Set up licensing

### 4. Testing Strategy

#### Development Testing
```bash
# 1. Test without plugin (current setup)
nvm use 18
npm run start

# 2. Test with development build
eas build --profile development --platform ios
# Install on device via TestFlight/Internal Testing
```

#### Pre-Production Testing
```bash
# 1. Build with plugin enabled
# Add plugin back to app.json
eas build --profile preview --platform ios
eas build --profile preview --platform android

# 2. Test IAP functionality
# - Test sandbox purchases (iOS)
# - Test with test accounts (Android)
# - Verify receipt validation
# - Test subscription management
```

### 5. Production Deployment Checklist

#### Pre-Deployment
- [ ] IAP products approved in App Store Connect
- [ ] Google Play products published and active
- [ ] Subscription management URLs configured
- [ ] Receipt validation endpoints tested
- [ ] Store listing compliance (IAP disclosure)

#### Deployment Steps
```bash
# 1. Enable plugin in production configuration
# Update app.config.js or app.json

# 2. Build production versions
eas build --profile production --platform ios
eas build --profile production --platform android

# 3. Submit to stores
eas submit --platform ios
eas submit --platform android
```

#### Post-Deployment
- [ ] Monitor IAP transaction success rates
- [ ] Verify subscription renewals
- [ ] Test purchase restoration
- [ ] Monitor error logs for IAP issues

### 6. Troubleshooting Production Issues

#### Common Plugin Issues
1. **"Cannot use import statement outside a module"**
   - Solution: Use development builds instead of Expo Go
   - Ensure plugin is properly configured for the build profile

2. **"Package does not contain a valid config plugin"**
   - Solution: Check expo-in-app-purchases version compatibility
   - Update to latest version if needed
   - Use EAS Build instead of local builds

3. **IAP not working on device**
   - Verify app is signed with production certificate
   - Check App Store Connect / Google Play Console product setup
   - Ensure device is not jailbroken/rooted

#### Debug Commands
```bash
# Check plugin configuration
npx expo config --type introspect

# Validate EAS build setup
eas build:configure

# Check dependencies
npx expo install --check
```

### 7. Alternative Implementation

If the plugin continues to cause issues, consider using React Native's built-in IAP libraries directly:

```bash
# Alternative approach
npm install react-native-iap
# Configure manually without Expo plugin
```

This requires ejecting from Expo managed workflow or using a development build.

### 8. Monitoring and Analytics

#### Production Monitoring
- Track IAP conversion rates
- Monitor failed transactions
- Set up alerts for IAP errors
- Implement purchase analytics

#### Key Metrics
- Purchase success rate (target: >95%)
- Subscription retention (monthly/yearly)
- Revenue per user (ARPU)
- Churn rate and reasons

## Next Steps

1. **Immediate**: Test current setup without plugin on device
2. **Short-term**: Create development build with plugin for device testing
3. **Long-term**: Configure production builds with proper IAP integration

## Support Resources

- [Expo In-App Purchases Documentation](https://docs.expo.dev/versions/latest/sdk/in-app-purchases/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Apple In-App Purchase Programming Guide](https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/StoreKitGuide/)
- [Google Play Billing Integration](https://developer.android.com/google/play/billing/integrate)

---

**Note**: The monetization system implementation is complete and functional. The plugin configuration is only needed for production builds where actual IAP transactions occur.