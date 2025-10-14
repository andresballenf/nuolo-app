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
        // SECURITY: Google Maps API key now handled server-side via Edge Function proxy
        // Client no longer needs direct API access
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
        ]
      },
      entitlements: {
        "com.apple.developer.in-app-payments": [
          "merchant.com.nuolo.app"
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
        "com.android.vending.BILLING"
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
        "expo-av",
        {
          microphonePermission: "Allow Nuolo to access your microphone for audio features."
        }
      ],
      "expo-audio",
      "expo-secure-store",
      "expo-font",
      "expo-web-browser",
      "expo-iap",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "2.1.20"
          }
        }
      ]
    ],
    extra: {
      router: {},
      eas: {
        projectId: "02e81b2a-f890-4c6e-8607-e4893ec8f63f"
      }
    },
    owner: "andresballen"
  }
};
