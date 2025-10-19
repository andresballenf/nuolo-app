import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { AppProvider } from '../contexts/AppContext';
import { AuthProvider } from '../contexts/AuthContext';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { AudioProvider } from '../contexts/AudioContext';
import { PrivacyProvider } from '../contexts/PrivacyContext';
import { MonetizationProvider } from '../contexts/MonetizationContext';
import { MapSettingsProvider } from '../contexts/MapSettingsContext';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { ErrorBoundary } from '../components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PrivacyProvider>
          <AppProvider>
            <MapSettingsProvider>
              <AuthProvider>
                <OnboardingProvider>
                  <AudioProvider>
                    <MonetizationProvider>
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
                    </MonetizationProvider>
                  </AudioProvider>
                </OnboardingProvider>
              </AuthProvider>
            </MapSettingsProvider>
          </AppProvider>
        </PrivacyProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}