# iOS Production Build Setup Guide

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/
   - Required for App Store distribution

2. **App Store Connect Access**
   - Will be available after enrolling in Apple Developer Program
   - Used for app submission and management

## Step 1: Apple Developer Account Setup

### If you don't have an Apple Developer account:
1. Go to https://developer.apple.com/programs/
2. Click "Enroll"
3. Sign in with your Apple ID
4. Complete enrollment ($99/year fee)
5. Wait for approval (usually instant, can take up to 48 hours)

### If you already have an account:
- Ensure your membership is active
- Sign in at https://developer.apple.com/

## Step 2: Configure EAS Build Credentials

We'll use EAS to manage credentials automatically. Run this command:

```bash
npx eas credentials
```

Select:
1. Platform: iOS
2. Build Credentials for com.nuolo.app
3. Set up a new Apple Developer account (if first time)

## Step 3: Create App on App Store Connect

1. Go to https://appstoreconnect.apple.com/
2. Click "My Apps" → "+" → "New App"
3. Configure:
   - Platform: iOS
   - Name: Nuolo Audio Tour Guide
   - Primary Language: English
   - Bundle ID: com.nuolo.app
   - SKU: nuolo-app-001 (or any unique identifier)

## Step 4: Update EAS Configuration for Production

The `eas.json` file needs these production settings:

```json
{
  "build": {
    "production": {
      "ios": {
        "buildConfiguration": "Release",
        "distribution": "app-store",
        "autoIncrement": true
      }
    }
  }
}
```

## Step 5: Environment Variables for Production

Create a `.env.production` file with your production values:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_production_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_production_google_maps_key
```

Then configure in EAS:

```bash
npx eas secret:push --scope project --env-file .env.production
```

## Step 6: Build for Production

### For TestFlight/App Store:
```bash
npx eas build --platform ios --profile production
```

### For Ad Hoc distribution (testing on specific devices):
First update `eas.json`:
```json
{
  "build": {
    "production-adhoc": {
      "ios": {
        "buildConfiguration": "Release",
        "distribution": "adhoc"
      }
    }
  }
}
```

Then build:
```bash
npx eas build --platform ios --profile production-adhoc
```

## Step 7: Submit to App Store

After successful build:

```bash
npx eas submit --platform ios
```

This will:
1. Upload to App Store Connect
2. Make available in TestFlight
3. Allow submission for review

## Current Status

- ✅ iOS native project configured
- ✅ Bundle identifier: com.nuolo.app
- ✅ EAS configuration created
- ⏳ Simulator build in progress
- ⏱️ Awaiting Apple Developer credentials
- ⏱️ Awaiting App Store Connect setup

## Next Steps

1. **Immediate**: Ensure Apple Developer account is active
2. **Run**: `npx eas credentials` to set up automated credential management
3. **Create**: App on App Store Connect
4. **Build**: Production version with `npx eas build --platform ios --profile production`
5. **Submit**: To TestFlight for testing

## Troubleshooting

### Common Issues:

1. **"Bundle identifier not available"**
   - Change in `ios/NuoloAudioTourGuide.xcodeproj/project.pbxproj`
   - Update all references to com.nuolo.app

2. **"No provisioning profile"**
   - Run `npx eas credentials`
   - Select "Set up new credentials"

3. **"Build failed - signing"**
   - Ensure Apple Developer account is active
   - Check team ID is correct in Xcode project

4. **Environment variables missing**
   - Use `npx eas secret:list` to verify
   - Re-push with `npx eas secret:push`

## Useful Commands

```bash
# Check build status
npx eas build:list --platform ios

# View build logs
npx eas build:view [build-id]

# Configure credentials
npx eas credentials

# Manage secrets
npx eas secret:list
npx eas secret:push --scope project --env-file .env.production
npx eas secret:delete --scope project SECRET_NAME

# Submit to App Store
npx eas submit --platform ios
```

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [iOS Distribution Guide](https://docs.expo.dev/distribution/app-stores/)
- [App Store Guidelines](https://developer.apple.com/app-store/guidelines/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)