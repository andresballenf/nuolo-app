Manual QA: Map Settings and 3D Buildings

Prerequisites
- Run the app: npx expo start (use iOS simulator or Android emulator)
- Ensure app has location permission (or enable Test Mode from the DEV panel)

QA Steps
1) Live Toggling
- Open the top-right menu (layers icon) or open the bottom-sheet Settings (Map Settings)
- Toggle Traffic: roads should overlay live (Android + iOS Google)
- Toggle Indoor Maps: indoor floor plans appear in supported venues
- Toggle Indoor Level Picker (Android only): floor-picker UI shows/hides in indoor venues
- Toggle Compass (iOS): compass needle appears/disappears when rotating the map
- Toggle Points of Interest (iOS): POI labels/icons hide/show
- Toggle 3D Buildings: buildings extrusions appear/disappear when camera pitch >= 45 and zoom ~17

2) 3D Buildings
- Jump to a supported city via DEV panel (e.g., New York, Paris, Tokyo)
- Set Map Type to Hybrid or Satellite
- Set Tilt to 60°
- Verify buildings extrude; toggle 3D Buildings Off to flatten (pitch animates to 0°)

3) Gestures
- Disable Pitch/Rotate/Zoom/Scroll and verify the map interaction updates immediately
- Re-enable all gestures and verify normal behavior

4) Persistence
- Change several settings (map type, 3D Buildings, traffic)
- Kill and relaunch the app: settings should persist (AsyncStorage)

5) Platform Guards
- iOS: "Terrain" and "Scale" should be unavailable; "Compass" and "POIs" should be available
- Android: "Terrain" appears; "Compass", "POIs", and "Scale" show "Unsupported"

Notes
- Google Maps provider is forced for both platforms (react-native-maps PROVIDER_GOOGLE via CocoaPods/Gradle)
- If 3D buildings do not appear, ensure camera: zoom ~17 and tilt >= 45, and test in a major city

Troubleshooting
- If toggles do not apply: check logs; ensure MapSettingsProvider wraps the app in app/_layout.tsx
- Clear Metro cache: npx expo start --clear
- Reset local prefs: use AsyncStorage inspector or reinstall the app
