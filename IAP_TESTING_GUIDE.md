# In-App Purchase Testing Guide for Nuolo

## Overview
This guide will help you properly test in-app purchases in the Nuolo app. IAP testing requires specific setup and cannot be done in Expo Go.

## Prerequisites

### 1. App Store Connect Setup (iOS)
- Products must be created in App Store Connect
- Product IDs must **exactly match** the code (case-sensitive):
  - `nuolo_unlimited_monthly` (auto-renewable subscription)
  - `nuolo_basic_package` (non-consumable)
  - `nuolo_standard_package` (non-consumable)
  - `nuolo_premium_package` (non-consumable)
- Products must be in "Ready to Submit" or "Approved" status
- At least one screenshot uploaded for each product

### 2. Sandbox Tester Account (iOS)
1. Go to App Store Connect → Users and Access → Sandbox Testers
2. Click "+ " to create a new sandbox tester
3. Use a **unique email** (doesn't need to be real)
4. Remember the password
5. **Do NOT** sign in to App Store with this account before testing

### 3. Google Play Console Setup (Android)
- Products created with matching IDs
- License test account added in Google Play Console
- App in Internal Testing track (minimum)

## Build Requirements

### ❌ Will NOT Work:
- Expo Go
- Expo development builds without config plugin
- Simulators (iOS Simulator cannot make purchases)

### ✅ Will Work:
- TestFlight builds (iOS)
- Internal Testing builds (Android)
- EAS preview/production builds on physical devices

## Step-by-Step Testing Process

### iOS Testing (TestFlight)

#### Step 1: Build for TestFlight
```bash
# Ensure app.config.js includes both "expo-iap" and "expo-build-properties" plugins
# Install the build produced after enabling StoreKit capability

# Build for iOS
eas build --profile preview --platform ios

# Or production build
eas build --profile production --platform ios
```

#### Step 2: Submit to TestFlight
```bash
# If you have automatic submission enabled, build will auto-upload
# Otherwise, submit manually via App Store Connect
```

#### Step 3: Install on Device
1. Install TestFlight app from App Store
2. Accept TestFlight invitation email
3. Install Nuolo from TestFlight

#### Step 4: Prepare Device for Testing
**CRITICAL STEPS:**
1. Open Settings app
2. Tap your name at the top
3. Tap "Media & Purchases"
4. Tap "Sign Out" (signs out of App Store only, not iCloud)
5. **DO NOT** sign in yet

#### Step 5: Test Purchase Flow
1. Open Nuolo app
2. Trigger a purchase (hit free limit or manual paywall)
3. App Store prompt will appear
4. **Now** sign in with your sandbox tester account
5. Complete the purchase
6. Watch console logs for detailed IAP flow

#### Step 6: Monitor Logs
Open Xcode → Window → Devices and Simulators → Select Device → View Device Logs

Look for `[IAP]` prefixed logs:
```
[IAP] Starting initialization...
[IAP] Attempting to connect to store...
[IAP] ✓ Connected to store
[IAP] Base product IDs: ["nuolo_unlimited_monthly", ...]
[IAP] Requesting 4 total products from store
[IAP] ✅ Successfully loaded 4 products
```

### Android Testing (Internal Testing)

#### Step 1: Build for Android
```bash
eas build --profile preview --platform android
```

#### Step 2: Upload to Play Console
1. Go to Google Play Console
2. Select your app
3. Go to Testing → Internal testing
4. Create a new release
5. Upload the AAB file from EAS build
6. Add license test email under testers

#### Step 3: Install and Test
1. Accept internal testing invitation
2. Install app from Play Store link
3. Complete purchase flow
4. Check logcat for `[IAP]` logs

## Expected Console Output

### Successful Connection:
```
[IAP] Starting initialization...
[IAP] Attempting to connect to store...
[IAP] initConnection returned: CONNECTED
[IAP] ✓ Connected to store
[IAP] Loading products...
[IAP] Base product IDs: ["nuolo_unlimited_monthly", "nuolo_basic_package", "nuolo_standard_package", "nuolo_premium_package"]
[IAP] Requesting 4 total products from store: [...]
[IAP] ✅ Successfully loaded 4 products:
[IAP]   - nuolo_unlimited_monthly: $9.99 (Nuolo Unlimited Monthly)
[IAP]   - nuolo_basic_package: $4.99 (Basic Package)
[IAP]   - nuolo_standard_package: $9.99 (Standard Package)
[IAP]   - nuolo_premium_package: $14.99 (Premium Package)
[IAP] ✅ Initialization complete
```

### Missing Plugin Error:
```
[IAP] ❌ Failed to initialize: Error: Failed to connect to in-app purchase service...
[IAP] 2. Missing expo-iap plugin or build properties configuration
[IAP] Run: eas build --profile preview --platform ios
```

### Product Not Found:
```
[IAP] ✅ Successfully loaded 2 products:
[IAP]   - nuolo_unlimited_monthly: $9.99 (Nuolo Unlimited Monthly)
[IAP]   - nuolo_basic_package: $4.99 (Basic Package)
[IAP] ⚠️ 2 products not found in store:
[IAP]   - nuolo_standard_package
[IAP]   - nuolo_premium_package
[IAP] Possible causes:
[IAP] 1. Product IDs don't match App Store Connect/Play Console exactly
[IAP] 2. Products not approved or in "Ready to Submit" status
[IAP] 3. Running in wrong region/store
```

## Common Issues & Solutions

### Issue: "Failed to connect to in-app purchase service"
**Cause:** Build missing StoreKit entitlement / expo-iap plugin / sandbox login
**Solution:**
1. Verify `expo-iap` and `expo-build-properties` exist in `app.config.js`
2. Regenerate the provisioning profile with `com.apple.developer.in-app-purchase`
3. Run `eas build --profile preview --platform ios`
4. Sign into the device with a sandbox tester before retrying

### Issue: "Products not found"
**Cause:** Product IDs don't match or not approved
**Solution:**
1. Verify exact product IDs in App Store Connect
2. Check product status (must be "Ready to Submit" minimum)
3. Check you're signed in with sandbox account, not production

### Issue: "Purchase failed with code: 2"
**Cause:** Not in sandbox mode or user cancelled
**Solution:**
1. Sign out of App Store in Settings
2. Trigger purchase in app
3. Sign in with sandbox account when prompted

### Issue: "Already connected" error
**Cause:** Multiple contexts trying to connect
**Solution:** Already fixed - PurchaseContext is marked as legacy

### Issue: Testing in Expo Go
**Error:** IAP module not available
**Solution:** Cannot test in Expo Go - must use EAS build

## Verifying Product IDs

### In App Store Connect:
1. Go to My Apps → Nuolo → In-App Purchases
2. Click on each product
3. Copy the Product ID exactly
4. Compare with `MonetizationService.ts` PRODUCT_IDS constant

### In Code:
Check `/services/MonetizationService.ts` lines 76-99:
```typescript
private static readonly PRODUCT_IDS = {
  UNLIMITED_MONTHLY: 'nuolo_unlimited_monthly',
  BASIC_PACKAGE: 'nuolo_basic_package',
  STANDARD_PACKAGE: 'nuolo_standard_package',
  PREMIUM_PACKAGE: 'nuolo_premium_package',
};
```

## Testing Checklist

### Before Building:
- [ ] `expo-iap` and `expo-build-properties` plugins in `app.config.js`
- [ ] Product IDs match App Store Connect exactly
- [ ] Products approved in App Store Connect
- [ ] Sandbox tester created

### During Build:
- [ ] Use EAS build (not Expo Go)
- [ ] Use `preview` or `production` profile
- [ ] Build for physical device

### Before Testing:
- [ ] Sign out of App Store in Settings
- [ ] Install from TestFlight
- [ ] Enable console logging

### During Testing:
- [ ] Trigger paywall/purchase
- [ ] Sign in with sandbox account
- [ ] Check `[IAP]` logs
- [ ] Verify purchase completes

### After Testing:
- [ ] Check entitlements updated
- [ ] Verify Supabase records created
- [ ] Test restore purchases

## Debug Commands

View iOS logs:
```bash
# Install app on device via TestFlight, then:
npx react-native log-ios
```

View Android logs:
```bash
# Install via Internal Testing, then:
npx react-native log-android
# or
adb logcat | grep -i "IAP"
```

## Support

If issues persist after following this guide:
1. Check console logs for `[IAP]` messages
2. Verify all prerequisites are met
3. Ensure using EAS build, not Expo Go
4. Confirm product IDs match exactly

## Quick Reference

**Sandbox Testing Account**: Create in App Store Connect → Users and Access → Sandbox Testers
**Sign Out Location**: Settings → [Your Name] → Media & Purchases → Sign Out
**Build Command**: `eas build --profile preview --platform ios`
**Log Viewing**: Xcode → Window → Devices → View Device Logs
**Product IDs**: Must match App Store Connect exactly (case-sensitive)
