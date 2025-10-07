import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { AppProvider } from '../contexts/AppContext';
import { AuthProvider } from '../contexts/AuthContext';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { AudioProvider } from '../contexts/AudioContext';
import { PrivacyProvider } from '../contexts/PrivacyContext';
import { MonetizationProvider } from '../contexts/MonetizationContext';
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
        console.log('Deep link received:', { hostname, path, queryParams });

        // Handle email confirmation (signup verification)
        if (path === 'auth/confirm') {
          const { token_hash, type } = queryParams as Record<string, string>;
          if (token_hash && type === 'email') {
            router.push(`/auth/confirm?token_hash=${token_hash}&type=${type}`);
          }
        }

        // Handle password reset
        if (path === 'auth/reset-password' || path === 'auth/update-password') {
          const { token_hash, type } = queryParams as Record<string, string>;
          if (token_hash && type === 'recovery') {
            router.push(`/auth/update-password?token_hash=${token_hash}&type=${type}`);
          }
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
          </AppProvider>
        </PrivacyProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}