# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npx expo start

# Platform-specific development
npx expo start --ios          # iOS Simulator (Mac only)
npx expo start --android      # Android Emulator  
npx expo start --web          # Web browser (limited functionality)

# Type checking
npx tsc --noEmit

# Clear Metro bundler cache
npx expo start --clear

# View development logs
npx expo logs

# Production build
npx expo build
```

## Architecture Overview

This is **Nuolo**, an **Expo-based React Native audio tour guide app** with the following key architectural patterns:

### Core Stack
- **Expo Router** for file-based navigation (`app/` directory)
- **React Query** (@tanstack/react-query) for server state management
- **Context API** for global app state (GPS, audio, auth, onboarding)
- **Supabase** for backend services and authentication
- **TypeScript** with strict mode enabled

### Context Architecture
The app uses a layered context provider structure in `app/_layout.tsx`:
```
QueryClientProvider > AppProvider > AuthProvider > OnboardingProvider > AudioProvider
```

**Key Contexts:**
- `AppContext`: GPS status, user preferences, attraction selection, bottom sheet state
- `AudioContext`: Audio playback state and controls
- `AuthContext`: User authentication and session management  
- `OnboardingContext`: First-time user experience flow

### Service Layer Pattern
Singleton services in `services/` handle external integrations:
- `LocationService`: GPS tracking with expo-location
- `AudioService`: Base64 audio file handling with expo-file-system
- `GooglePlacesService`: Places API integration for attractions
- `AttractionInfoService`: Attraction data and audio content generation

### Component Structure
- `components/ui/`: Reusable UI components (Button, BottomSheet, Cards)
- `components/map/`: Map-specific components (CustomMarker, MapView, SearchThisAreaButton)
- `components/audio/`: Audio player components (FloatingAudioPlayer, MiniPlayerOverlay)
- `components/onboarding/`: Multi-step onboarding flow components

## Key Integration Points

### Environment Variables Required
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key  
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### Location Services
- Uses expo-location with HIGH accuracy GPS tracking
- Implements singleton LocationService with permission handling
- Test locations available for development in LocationService.getTestLocations()

### Audio System
- Base64 audio content converted to local files via expo-file-system
- Audio playback managed through expo-audio integration in components
- Supports multiple audio formats (MP3, WAV, OGG, AAC)

### State Persistence
- User preferences saved to AsyncStorage via custom storage utility (`lib/utils.ts`)
- Supabase session persistence configured with AsyncStorage

## Navigation Structure

File-based routing with Expo Router:
- `app/index.tsx` - Main map screen
- `app/auth.tsx` - Authentication screen  
- `app/map.tsx` - Map interface
- `app/onboarding/index.tsx` - Onboarding modal

## Development Notes

- Entry point is `index.ts` (not App.tsx - that's legacy Expo)
- Uses Expo's new architecture (`"newArchEnabled": true`)
- React Native Maps configured for both iOS and Android
- Location permissions configured in app.json for both platforms
- Audio permissions configured for microphone access