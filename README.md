# Nuolo - React Native App

Audio tour guide app built with Expo and React Native.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS Simulator (Mac) or Android Studio
- Expo Go app on your phone

### Installation & Running

```bash
# Navigate to the mobile app directory
cd nuolo-app

# Install dependencies (if not already done)
yarn install

# Start the development server
npx expo start
```

### Testing Options

#### 📱 On Physical Device (Recommended)
1. Install **Expo Go** from App Store (iOS) or Play Store (Android)
2. Scan the QR code from terminal/browser
3. App will load on your device

#### 💻 On Simulator/Emulator
```bash
# iOS Simulator (Mac only)
npx expo start --ios

# Android Emulator
npx expo start --android

# Web browser (limited functionality)
npx expo start --web
```

## 🧪 Current Features to Test

### ✅ Navigation
- Tab navigation between Map, Audio, and Settings
- Authentication flow (currently mocked)
- Onboarding modal presentation

### ✅ Map Integration
- Google Maps with satellite view
- User location tracking (requires permission)
- GPS status display

### ✅ Core Services
- Location permission handling
- AsyncStorage for user preferences
- Supabase integration setup

### 🔄 In Development
- Google Places API for nearby attractions
- Audio playback with expo-audio
- Full onboarding flow
- Attraction details UI

## 🛠️ Development Commands

```bash
# Type checking
npx tsc --noEmit

# Clear Metro cache
npx expo start --clear

# View logs
npx expo logs

# Build for production
npx expo build
```

## 📝 Environment Setup

Create a `.env` file with:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

## 🔧 Troubleshooting

### Common Issues
1. **Metro bundler cache**: Run `npx expo start --clear`
2. **iOS Simulator**: Ensure Xcode is installed and updated
3. **Android Emulator**: Check Android Studio AVD is running
4. **Maps not loading**: Verify Google Maps API key

### Permissions
- **Location**: Required for GPS and nearby attractions
- **Audio**: Required for audio playback features

## 📊 Project Status

- ✅ Core architecture and navigation
- ✅ Maps integration with location services  
- ✅ Supabase authentication setup
- ✅ AsyncStorage for persistence
- 🔄 Audio system implementation
- 🔄 Google Places integration
- 🔄 UI component migration from web app