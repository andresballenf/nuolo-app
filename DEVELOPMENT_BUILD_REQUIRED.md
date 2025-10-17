# ⚠️ Development Build Required for RevenueCat

## Why You're Seeing Errors

The error `Invariant Violation: new NativeEventEmitter() requires a non-null argument` occurs because **RevenueCat requires native modules** that are not available in Expo Go.

## Solution

You have 3 options to test RevenueCat:

### Option 1: Local Development Build (Fastest)

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

This compiles the native code and installs on simulator/device.

### Option 2: EAS Development Build

```bash
# Build for iOS
eas build --profile development --platform ios

# Build for Android
eas build --profile development --platform android
```

Then install the build on your device.

### Option 3: Continue with Mock Mode (UI Testing Only)

The app will run in Expo Go with RevenueCat in "mock mode":
- ✅ You can test UI and navigation
- ✅ No crashes or errors
- ❌ Actual purchases won't work
- ℹ️ Logs will show: "Running in Expo Go - RevenueCat not available"

## Current Status

The code has been updated to gracefully handle running in Expo Go:
- No crashes when RevenueCat native modules aren't available
- App continues to function
- Logs warnings instead of throwing errors
- Perfect for UI development before setting up RevenueCat dashboard

## When You Need Full Testing

You'll need a development or production build when:
- Testing actual purchases
- Testing subscription management
- Testing restore purchases
- Verifying RevenueCat webhook integration

For now, you can continue developing the UI in Expo Go!
