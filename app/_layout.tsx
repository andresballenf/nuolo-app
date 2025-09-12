import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { AppProvider } from '../contexts/AppContext';
import { AuthProvider } from '../contexts/AuthContext';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { AudioProvider } from '../contexts/AudioContext';
import { PrivacyProvider } from '../contexts/PrivacyContext';
import { PurchaseProvider } from '../contexts/PurchaseContext';
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
                    <PurchaseProvider>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="auth" />
                        <Stack.Screen name="auth/login" />
                        <Stack.Screen name="auth/signup" />
                        <Stack.Screen name="auth/reset-password" />
                        <Stack.Screen name="map" />
                      </Stack>
                      <OnboardingFlow />
                      <StatusBar style="light" backgroundColor="#84cc16" />
                    </PurchaseProvider>
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