# iOS Production Build Commands

## After setting up Apple Developer Account:

### 1. Configure Credentials
```bash
# This will guide you through setting up certificates and provisioning profiles
npx eas credentials --platform ios
```

### 2. Build for App Store
```bash
# Production build for App Store/TestFlight
npx eas build --platform ios --profile production
```

### 3. Build for Internal Testing (Ad Hoc)
```bash
# For testing on specific devices without TestFlight
npx eas build --platform ios --profile production-adhoc
```

### 4. Submit to App Store
```bash
# After build completes successfully
npx eas submit --platform ios --latest
```

## Check Build Status
```bash
npx eas build:list --platform ios --limit 5
```

## View Build Details
```bash
npx eas build:view [build-id]
```

## Current Configuration:
- Bundle ID: com.nuolo.app
- App Name: Nuolo Audio Tour Guide
- Version: 1.0.0
- Build profiles configured: production, production-adhoc, simulator, development, preview

## Environment Variables
Make sure to set your production environment variables:
```bash
# Create .env.production file with:
EXPO_PUBLIC_SUPABASE_URL=your_production_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_production_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_production_api_key

# Then push to EAS:
npx eas secret:push --scope project --env-file .env.production
```