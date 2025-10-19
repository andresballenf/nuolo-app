import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useCallback, useState } from 'react';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { supabase } from '../lib/supabase';
import { AppProvider } from '../contexts/AppContext';
import { AuthProvider } from '../contexts/AuthContext';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { AudioProvider } from '../contexts/AudioContext';
import { PrivacyProvider } from '../contexts/PrivacyContext';
import { MonetizationProvider } from '../contexts/MonetizationContext';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TelemetryService } from '../services/TelemetryService';
import { DiagnosticsOverlay } from '../components/diagnostics/DiagnosticsOverlay';

// Keep native splash screen visible until our JS tree has mounted and laid out
SplashScreen.preventAutoHideAsync().catch(() => {
  // ignore if called multiple times
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
  queryCache: new QueryCache({
    onSuccess: (_data, query) => {
      TelemetryService.logReactQueryEvent({
        type: 'query',
        key: query.queryHash,
        status: 'success',
      });
    },
    onError: (error, query) => {
      TelemetryService.logReactQueryEvent({
        type: 'query',
        key: query.queryHash,
        status: 'error',
        errorMessage: (error as any)?.message,
      });
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      TelemetryService.logReactQueryEvent({
        type: 'mutation',
        key: String(mutation.mutationId),
        status: 'success',
      });
    },
    onError: (error, _vars, _ctx, mutation) => {
      TelemetryService.logReactQueryEvent({
        type: 'mutation',
        key: String(mutation.mutationId),
        status: 'error',
        errorMessage: (error as any)?.message,
      });
    },
  }),
});

const splashIcon = require('../assets/splash-icon.png');
const iconSource = Image.resolveAssetSource(splashIcon);
const screenWidth = Dimensions.get('window').width;
const targetIconWidth = screenWidth * 0.5;
const targetIconHeight = targetIconWidth * (iconSource.height / iconSource.width);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  const [showInAppSplash, setShowInAppSplash] = useState(true);

  // Handle deep links from email confirmation and password reset
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      try {
        const { hostname, path, queryParams } = Linking.parse(event.url);

        // Parse hash fragment for session tokens (Supabase returns them in URL hash)
        const hashParams: Record<string, string> = {};
        if (event.url.includes('#')) {
          const hashString = event.url.split('#')[1];
          if (hashString) {
            hashString.split('&').forEach(param => {
              const [key, value] = param.split('=');
              if (key && value) {
                hashParams[key] = decodeURIComponent(value);
              }
            });
          }
        }

        console.log('Deep link received:', {
          hostname,
          path,
          queryParams,
          hashParams,
          fullUrl: event.url
        });

        // If we have session tokens in hash, set the session
        if (hashParams.access_token && hashParams.refresh_token) {
          console.log('Setting session from URL tokens');
          const { error } = await supabase.auth.setSession({
            access_token: hashParams.access_token,
            refresh_token: hashParams.refresh_token,
          });

          if (error) {
            console.error('Error setting session from URL:', error);
          } else {
            console.log('Session set successfully from URL');
          }
        }

        // Handle email confirmation (signup verification)
        if (path === 'auth/confirm') {
          // Session should already be set from hash params above
          router.push('/auth/confirm');
        }

        // Handle password reset
        if (path === 'auth/reset-password' || path === 'auth/update-password') {
          // Session should already be set from hash params above
          router.push('/auth/update-password');
        }

        // Handle OAuth callback
        if (path === 'auth/callback') {
          const { access_token, refresh_token } = queryParams as Record<string, string>;
          if (access_token && refresh_token) {
            // OAuth callback will be handled by AuthContext's onAuthStateChange
            router.replace('/map');
          }
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle initial URL if app was closed and opened via deep link
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => subscription.remove();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // Hide native splash once our first render has been laid out
      await SplashScreen.hideAsync();
      // Keep the in-app splash for a brief moment to avoid perceptible flicker
      setTimeout(() => setShowInAppSplash(false), 120);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Keep native splash on screen until fonts are loaded
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PrivacyProvider>
          <AppProvider>
            <AuthProvider>
              <OnboardingProvider>
                <AudioProvider>
                  <MonetizationProvider>
                    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="auth" />
                        <Stack.Screen name="auth/login" />
                        <Stack.Screen name="auth/signup" />
                        <Stack.Screen name="auth/reset-password" />
                        <Stack.Screen name="auth/confirm" />
                        <Stack.Screen name="auth/update-password" />
                        <Stack.Screen name="map" />
                      </Stack>
                      <OnboardingFlow />
                      <StatusBar style="light" backgroundColor="#84cc16" />

                      {showInAppSplash && (
                        <View style={styles.splashContainer}>
                          <Image
                            source={splashIcon}
                            style={{ width: targetIconWidth, height: targetIconHeight }}
                            resizeMode="contain"
                          />
                        </View>
                      )}

                      <DiagnosticsOverlay />
                    </View>
                  </MonetizationProvider>
                </AudioProvider>
              </OnboardingProvider>
            </AuthProvider>
          </AppProvider>
        </PrivacyProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
