# iOS Build Fix Guide

## The Issue
The iOS build is failing due to CocoaPods installation errors. This is a common issue with Expo SDK 53 and certain native dependencies.

## Solution Steps

### Option 1: Build Without Native Code Changes (Recommended)

Since you have a managed Expo workflow, try building without the iOS directory:

```bash
# 1. Remove the iOS directory
rm -rf ios

# 2. Build using EAS (this will handle native code generation on the server)
npx eas build --platform ios --profile production
```

### Option 2: Fix and Keep Native iOS Directory

If you need to keep the native iOS code:

```bash
# 1. Clear and regenerate iOS directory
rm -rf ios
npx create-expo-app --template

# 2. Or try with explicit Expo version
npx expo prebuild --platform ios --npm
```

### Option 3: Use Simulator Build First

Test with a simulator build (doesn't require Apple certificates):

```bash
npx eas build --platform ios --profile simulator
```

## Build Commands

### For Production (App Store):
```bash
npx eas build --platform ios --profile production
```

### For Testing (Internal):
```bash
npx eas build --platform ios --profile production-adhoc  
```

### Check Build Status:
```bash
npx eas build:list --platform ios --limit 5
```

## Common Fixes

### If "Unknown error" persists:

1. **Update dependencies:**
```bash
npm update
npx expo install --fix
```

2. **Clear caches:**
```bash
rm -rf node_modules
rm -rf ios
npm install
```

3. **Use specific Node version:**
```bash
# Use Node 20 LTS
nvm use 20
```

## Build Configuration Updates

The `eas.json` has been updated with:
- Resource class set to `m-medium` for better build performance
- `EXPO_NO_CAPABILITY_SYNC` flag to prevent capability sync issues
- Proper distribution settings for each profile

## Next Steps

1. **Remove iOS directory**: `rm -rf ios`
2. **Start new build**: `npx eas build --platform ios --profile production`
3. **Monitor build**: Check logs at the provided URL
4. **Once successful**: Submit to TestFlight with `npx eas submit --platform ios --latest`

## Alternative: Expo Go Testing

While fixing the build, you can test the app using Expo Go:

```bash
npx expo start
```

Then scan the QR code with Expo Go app on your iPhone.

## Support

If builds continue to fail:
1. Check logs at: https://expo.dev/accounts/andresballen/projects/nuolo/builds/
2. Visit: https://expo.dev/eas for status updates
3. Contact support with build ID

## Build Environment Details

- Expo SDK: 53.0.0
- React Native: 0.79.5
- Node: Use version 20.x
- EAS CLI: Latest version
- Build resource: m-medium (faster builds)