module.exports = {
  expo: {
    name: "Nuolo",
    slug: "nuolo",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "nuolo",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.nuolo.app",
      usesAppleSignIn: true,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Nuolo uses your location to discover nearby attractions and provide location-based audio tours.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Nuolo uses your location to discover nearby attractions and provide location-based audio tours.",
        NSMicrophoneUsageDescription: "Nuolo may access the microphone for voice interactions and audio features.",
        SKAdNetworkItems: [
          {
            SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork"
          }
        ],
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "com.nuolo.app",
              "nuolo"
            ]
          }
        ],
        UIBackgroundModes: [
          "audio"
        ]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#84cc16"
      },
      edgeToEdgeEnabled: true,
      package: "com.nuolo.app",
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "nuolo"
            },
            {
              scheme: "com.nuolo.app"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ],
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "RECORD_AUDIO",
        "INTERNET",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "com.android.vending.BILLING",
        "android.permission.WAKE_LOCK"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Nuolo to use your location to discover nearby attractions."
        }
      ],
      [
        "expo-audio",
        {
          microphonePermission: "Allow Nuolo to access your microphone for audio features."
        }
      ],
      "expo-secure-store",
      "expo-font",
      "expo-web-browser",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.1.20"
          }
        }
      ]
      // RevenueCat (react-native-purchases) does not require a config plugin
      // It works through Expo development builds without plugin configuration
    ],
    extra: {
      router: {},
      eas: {
        projectId: "02e81b2a-f890-4c6e-8607-e4893ec8f63f"
      },
      EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    },
    owner: "andresballen"
  }
};
