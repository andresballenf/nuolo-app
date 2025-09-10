# App Store Connect Setup for Nuolo

## Quick Setup Guide

### 1. Create App on App Store Connect

Go to: https://appstoreconnect.apple.com/

1. Click **"My Apps"**
2. Click **"+"** button → **"New App"**
3. Fill in these details:

**New App Information:**
- **Platforms**: ☑️ iOS
- **Name**: Nuolo Audio Tour Guide
- **Primary Language**: English (U.S.)
- **Bundle ID**: Select or create `com.nuolo.app`
- **SKU**: nuolo-001 (or any unique identifier)
- **User Access**: Full Access

Click **"Create"**

### 2. Configure App Information

Once created, go to your app and configure:

**General Information:**
- **Category**: Travel
- **Secondary Category**: Education
- **Content Rights**: Does not contain third-party content

**Age Rating:**
- Click "Set Age Rating"
- Answer questionnaire (likely 4+)

**Pricing and Availability:**
- **Price**: Free (or your chosen price)
- **Availability**: Select countries

### 3. Prepare for Submission

**Version Information** (1.0):
- **Description**: 
```
Nuolo is your personal AI-powered audio tour guide that transforms any location into an immersive storytelling experience. Simply explore your surroundings and let Nuolo automatically detect nearby attractions, monuments, and points of interest to deliver engaging audio narratives.

Features:
• Automatic attraction detection using GPS
• AI-generated audio tours in multiple languages
• Rich historical and cultural information
• Offline mode for downloaded tours
• Interactive map with points of interest
• Personalized recommendations based on your interests

Perfect for travelers, history enthusiasts, and curious explorers who want to discover the hidden stories behind the places they visit.
```

- **Keywords**: audio tour, travel guide, tourism, GPS guide, city tour, museum guide, sightseeing
- **Support URL**: https://nuolo.app/support (update with your URL)
- **Marketing URL**: https://nuolo.app (update with your URL)

**Screenshots** (Required):
- 6.7" Display (iPhone 15 Pro Max): 1290 x 2796
- 6.5" Display (iPhone 14 Plus): 1284 x 2778  
- 5.5" Display (iPhone 8 Plus): 1242 x 2208
- 12.9" iPad Pro: 2048 x 2732

**App Privacy:**
- Click "Manage" under Privacy Policy
- Add privacy policy URL
- Complete privacy questionnaire

### 4. TestFlight Setup

1. Go to **TestFlight** tab
2. Click **"+"** next to "Internal Testing"
3. Create a new Internal Group
4. Add tester emails
5. Once build is uploaded, it will appear here

## After Credentials Setup

Once you've configured credentials either via web or terminal, run:

```bash
# Start the production build
npx eas build --platform ios --profile production

# Monitor build status
npx eas build:list --platform ios --limit 1

# Once complete, submit to TestFlight
npx eas submit --platform ios --latest
```

## Build Commands Reference

```bash
# Check build status
npx eas build:list --platform ios

# View specific build
npx eas build:view [build-id]

# Download build artifact
npx eas build:download --platform ios --id [build-id]

# Submit to App Store
npx eas submit --platform ios --latest

# Or submit specific build
npx eas submit --platform ios --id [build-id]
```

## Checklist

- [ ] Apple Developer account active
- [ ] Credentials configured in EAS
- [ ] App created on App Store Connect
- [ ] Bundle ID matches (com.nuolo.app)
- [ ] App information filled out
- [ ] Privacy policy added
- [ ] Screenshots prepared
- [ ] Build completed successfully
- [ ] Submitted to TestFlight
- [ ] Internal testers added

## Support Links

- [EAS Build](https://docs.expo.dev/build/introduction/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)