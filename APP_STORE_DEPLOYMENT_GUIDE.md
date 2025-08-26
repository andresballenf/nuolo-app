# 📱 Nuolo App Store & Google Play Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Initial Setup](#phase-1-initial-setup)
4. [Phase 2: App Store Assets](#phase-2-app-store-assets)
5. [Phase 3: Security & Credentials](#phase-3-security--credentials)
6. [Phase 4: Build Configuration](#phase-4-build-configuration)
7. [Phase 5: Testing](#phase-5-testing)
8. [Phase 6: Store Submission](#phase-6-store-submission)
9. [Phase 7: Post-Launch](#phase-7-post-launch)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides complete instructions for deploying the Nuolo audio tour guide app to the iOS App Store and Google Play Store using Expo and EAS Build.

**Current App Status:**
- App Name: Nuolo - Audio Tour Guide
- Bundle ID (iOS): `com.nuolo.app`
- Package Name (Android): `com.nuolo.app`
- Version: 1.0.0
- EAS Project ID: `02e81b2a-f890-4c6e-8607-e4893ec8f63f`

---

## Prerequisites

### Required Accounts
- [ ] **Expo Account**: Sign up at [expo.dev](https://expo.dev)
- [ ] **Apple Developer Account**: $99/year at [developer.apple.com](https://developer.apple.com)
- [ ] **Google Play Developer Account**: $25 one-time at [play.google.com/console](https://play.google.com/console)

### Required Tools
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to your Expo account
eas login

# Verify installation
eas --version
```

---

## Phase 1: Initial Setup

### 1.1 Create EAS Configuration

Create `eas.json` in your project root:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_ENV": "preview"
      }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "internal"
      }
    }
  }
}
```

### 1.2 Update app.json for Production

Add/update these fields in `app.json`:

```json
{
  "expo": {
    "name": "Nuolo - Audio Tour Guide",
    "slug": "nuolo",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#84cc16"
    },
    "updates": {
      "fallbackToCacheTimeout": 0,
      "url": "https://u.expo.dev/02e81b2a-f890-4c6e-8607-e4893ec8f63f"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.nuolo.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Nuolo uses your location to discover nearby attractions and provide location-based audio tours.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Nuolo uses your location to discover nearby attractions and provide location-based audio tours.",
        "NSMicrophoneUsageDescription": "Nuolo may access the microphone for voice interactions and audio features.",
        "ITSAppUsesNonExemptEncryption": false
      },
      "config": {
        "usesNonExemptEncryption": false
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#84cc16"
      },
      "package": "com.nuolo.app",
      "versionCode": 1,
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "RECORD_AUDIO",
        "INTERNET"
      ]
    }
  }
}
```

### 1.3 Configure Environment Variables

Create `.env.production`:
```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_production_google_maps_key
EXPO_PUBLIC_SUPABASE_URL=your_production_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_anon_key
EXPO_PUBLIC_ENV=production
```

Set up EAS Secrets for sensitive data:
```bash
# Set secrets that shouldn't be in code
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value "your_key"
eas secret:create --scope project --name SUPABASE_URL --value "your_url"
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "your_key"
```

---

## Phase 2: App Store Assets

### 2.1 App Icons

#### iOS Icon Requirements
- **Size**: 1024x1024px
- **Format**: PNG
- **Transparency**: Not allowed
- **Corners**: Square (Apple adds rounded corners)

#### Android Icon Requirements
- **Adaptive Icon**: 
  - Foreground: 512x512px PNG with transparency
  - Background: 512x512px PNG or solid color
- **Legacy Icon**: 512x512px PNG

### 2.2 Screenshots

#### iOS Screenshots Required
| Device | Size | Quantity |
|--------|------|----------|
| iPhone 6.7" | 1290 × 2796 | 3-10 |
| iPhone 6.5" | 1242 × 2688 | 3-10 |
| iPhone 5.5" | 1242 × 2208 | Optional |
| iPad 12.9" | 2048 × 2732 | 3-10 |

#### Android Screenshots Required
| Type | Size | Quantity |
|------|------|----------|
| Phone | 1080 × 1920 minimum | 2-8 |
| Tablet 7" | 1280 × 720 minimum | Optional |
| Tablet 10" | 1920 × 1080 minimum | Optional |

### 2.3 App Store Metadata

#### iOS App Store Connect
- **App Name**: Nuolo - Audio Tour Guide (30 chars max)
- **Subtitle**: Discover stories around you (30 chars)
- **Keywords**: audio,tour,guide,travel,explore,attractions,tourism (100 chars)
- **Description**: (4000 chars max)
- **Category**: Primary: Travel, Secondary: Education
- **Age Rating**: 4+

#### Google Play Store
- **Title**: Nuolo - Audio Tour Guide (30 chars)
- **Short Description**: Discover local attractions with AI-powered audio tours (80 chars)
- **Full Description**: (4000 chars max)
- **Category**: Travel & Local
- **Content Rating**: Everyone

### 2.4 Additional Required Assets

#### Feature Graphic (Google Play)
- Size: 1024 × 500px
- Format: PNG or JPG

#### App Preview Video (Optional)
- iOS: 15-30 seconds, 1080×1920 or higher
- Android: 30 seconds max, 720p minimum

---

## Phase 3: Security & Credentials

### 3.1 iOS Credentials

#### Automatic Management (Recommended)
```bash
# EAS will handle certificates and provisioning profiles
eas credentials
```

#### Manual Setup (If needed)
1. Create App ID in Apple Developer Portal
2. Generate Distribution Certificate
3. Create Provisioning Profile
4. Download and configure in EAS

### 3.2 Android Credentials

#### Generate Keystore
```bash
# EAS will generate automatically on first build
eas build --platform android

# Or generate manually
keytool -genkeypair -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

#### Configure in eas.json
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle",
        "credentialsSource": "local"
      }
    }
  }
}
```

### 3.3 API Key Security

#### Google Maps API Restrictions
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to APIs & Services → Credentials
3. Add restrictions:
   - **iOS**: Bundle ID restriction (`com.nuolo.app`)
   - **Android**: Package name + SHA-1 fingerprint
   - **APIs**: Restrict to Places API, Maps SDK

#### Supabase Production Setup
1. Create production project at [supabase.com](https://supabase.com)
2. Configure Row-Level Security (RLS)
3. Set up Edge Function environment variables
4. Configure allowed domains for authentication

---

## Phase 4: Build Configuration

### 4.1 Build Commands

#### Development Build
```bash
# iOS development build
eas build --platform ios --profile development

# Android development build
eas build --platform android --profile development
```

#### Preview Build (TestFlight/Internal Testing)
```bash
# iOS preview build
eas build --platform ios --profile preview

# Android preview build (APK)
eas build --platform android --profile preview
```

#### Production Build
```bash
# iOS production build
eas build --platform ios --profile production

# Android production build (AAB)
eas build --platform android --profile production

# Build both platforms
eas build --platform all --profile production
```

### 4.2 Platform-Specific Configuration

#### iOS Specific
```json
{
  "ios": {
    "bundleIdentifier": "com.nuolo.app",
    "buildNumber": "1",
    "appleTeamId": "YOUR_TEAM_ID",
    "config": {
      "usesNonExemptEncryption": false
    }
  }
}
```

#### Android Specific
```json
{
  "android": {
    "package": "com.nuolo.app",
    "versionCode": 1,
    "googleServicesFile": "./google-services.json",
    "intentFilters": [
      {
        "action": "VIEW",
        "category": ["DEFAULT", "BROWSABLE"],
        "data": {
          "scheme": "nuolo"
        }
      }
    ]
  }
}
```

---

## Phase 5: Testing

### 5.1 Local Testing

```bash
# Run on iOS Simulator
npm run ios

# Run on Android Emulator
npm run android

# Test production build locally
npx expo start --no-dev --minify
```

### 5.2 Device Testing

#### iOS TestFlight
1. Build with preview profile
2. Upload to TestFlight:
```bash
eas submit --platform ios --latest
```
3. Add internal testers
4. Submit for external testing review

#### Android Internal Testing
1. Build APK or AAB
2. Upload to Play Console:
```bash
eas submit --platform android --latest
```
3. Create internal testing release
4. Share testing link with testers

### 5.3 Testing Checklist

- [ ] **Location Permissions**: Test permission flows on fresh install
- [ ] **Audio Playback**: Verify audio works with different network conditions
- [ ] **Offline Mode**: Test app behavior without internet
- [ ] **Deep Linking**: Test `nuolo://` URL scheme
- [ ] **Push Notifications**: If implemented, test delivery
- [ ] **Biometric Authentication**: Test Face ID/Touch ID/Fingerprint
- [ ] **Different OS Versions**: Test on minimum supported versions
- [ ] **Tablet Support**: Verify layout on tablets
- [ ] **Accessibility**: Test with VoiceOver/TalkBack

---

## Phase 6: Store Submission

### 6.1 iOS App Store Submission

#### Prepare in App Store Connect
1. Create new app
2. Fill in app information:
   - App name and subtitle
   - Categories
   - Age rating questionnaire
   - Pricing (free/paid)
3. Upload screenshots and app preview
4. Add description and keywords
5. Configure app privacy details

#### Submit Build
```bash
# Submit latest build
eas submit --platform ios --latest

# Or submit specific build
eas submit --platform ios --id=BUILD_ID
```

#### App Review Guidelines
- Review typically takes 24-48 hours
- Common rejection reasons:
  - Incomplete functionality
  - Crashes or bugs
  - Misleading metadata
  - Privacy policy issues
  - Guideline violations

### 6.2 Google Play Store Submission

#### Prepare in Play Console
1. Create new application
2. Set up store listing:
   - Title and descriptions
   - Graphics and screenshots
   - Categorization
   - Contact details
3. Complete content rating questionnaire
4. Set up pricing and distribution
5. Complete data safety form

#### Submit Build
```bash
# Submit to internal testing track
eas submit --platform android --latest --track internal

# Submit to production
eas submit --platform android --latest --track production
```

#### Play Store Review
- Review typically takes 2-24 hours
- Common issues:
  - Policy violations
  - Metadata issues
  - Permission justifications
  - Data safety discrepancies

### 6.3 Required Legal Documents

#### Privacy Policy
Must include:
- What data is collected
- How data is used
- Data sharing practices
- Data retention
- User rights (GDPR/CCPA)
- Contact information

Host at: `https://your-domain.com/privacy`

#### Terms of Service
Must include:
- User agreements
- Acceptable use
- Intellectual property
- Disclaimers
- Limitation of liability

Host at: `https://your-domain.com/terms`

---

## Phase 7: Post-Launch

### 7.1 Monitoring Setup

#### Crash Reporting (Sentry)
```bash
npm install sentry-expo

# Configure in App.js
import * as Sentry from 'sentry-expo';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  enableInExpoDevelopment: false,
  debug: false
});
```

#### Analytics (Optional)
```bash
# Install analytics
npm install expo-analytics-segment

# Or Firebase
npm install expo-firebase-analytics
```

### 7.2 Over-The-Air Updates

#### Configure OTA Updates
```json
{
  "expo": {
    "updates": {
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 30000
    }
  }
}
```

#### Publish Updates
```bash
# Publish update to production
eas update --branch production --message "Bug fixes and improvements"

# Publish with specific channel
eas update --channel production --message "v1.0.1 hotfix"
```

### 7.3 Version Management

#### iOS Version Bumping
- **Version**: User-facing version (1.0.0)
- **Build Number**: Incremental integer (1, 2, 3...)

#### Android Version Bumping
- **versionName**: User-facing version (1.0.0)
- **versionCode**: Incremental integer (1, 2, 3...)

```bash
# Bump version automatically
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0
```

---

## Troubleshooting

### Common iOS Issues

#### "Missing Push Notification Entitlement"
Add to `app.json`:
```json
{
  "ios": {
    "entitlements": {
      "aps-environment": "production"
    }
  }
}
```

#### "App Store Connect API Key Issues"
```bash
# Generate API key in App Store Connect
# Users and Access → Keys → App Store Connect API

# Configure in eas.json
{
  "submit": {
    "production": {
      "ios": {
        "ascApiKeyPath": "./AuthKey_XXXXX.p8",
        "ascApiKeyIssuerId": "xxxxx-xxxxx-xxxxx",
        "ascApiKeyId": "XXXXXXXXXX"
      }
    }
  }
}
```

### Common Android Issues

#### "Upload key is invalid"
```bash
# Reset upload key in Play Console
# Setup → App integrity → App signing
```

#### "Version code already exists"
Increment `versionCode` in `app.json`

#### "APK size too large"
Use App Bundle (AAB) format instead of APK

### Build Failures

#### Clear cache and rebuild
```bash
# Clear Expo cache
expo start -c

# Clear EAS cache
eas build --clear-cache --platform all
```

#### Check build logs
```bash
# View build details
eas build:list

# View specific build log
eas build:view BUILD_ID
```

---

## Quick Reference Commands

```bash
# Setup
npm install -g eas-cli
eas login
eas build:configure

# Development
eas build --platform ios --profile development
eas build --platform android --profile development

# Testing
eas build --platform all --profile preview
eas submit --platform ios --latest
eas submit --platform android --latest --track internal

# Production
eas build --platform all --profile production
eas submit --platform ios --latest
eas submit --platform android --latest --track production

# Updates
eas update --branch production --message "Update description"

# Monitoring
eas build:list
eas build:view BUILD_ID
eas credentials
```

---

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)
- [App Store Guidelines](https://developer.apple.com/app-store/guidelines/)
- [Google Play Policies](https://play.google.com/console/about/policies/)
- [Apple Developer Portal](https://developer.apple.com)
- [Google Play Console](https://play.google.com/console)

---

## Checklist Summary

### Pre-Launch Checklist
- [ ] EAS CLI installed and configured
- [ ] Developer accounts created (Apple/Google)
- [ ] eas.json configured
- [ ] Environment variables set
- [ ] App icons created (1024x1024 for iOS, 512x512 for Android)
- [ ] Screenshots prepared
- [ ] Privacy policy and terms of service hosted
- [ ] API keys secured and restricted
- [ ] Production Supabase configured

### Build & Test Checklist
- [ ] Development builds tested
- [ ] Preview builds tested on TestFlight/Internal Testing
- [ ] All permissions tested
- [ ] Offline functionality verified
- [ ] Different device sizes tested
- [ ] Accessibility tested

### Submission Checklist
- [ ] Store listings completed
- [ ] Metadata and descriptions added
- [ ] Content rating completed
- [ ] Data safety form filled (Android)
- [ ] App privacy details added (iOS)
- [ ] Production build submitted
- [ ] App review passed

### Post-Launch Checklist
- [ ] Crash reporting configured
- [ ] Analytics tracking (optional)
- [ ] OTA updates configured
- [ ] User feedback monitored
- [ ] Performance metrics tracked

---

*Last Updated: December 2024*
*For Nuolo v1.0.0*