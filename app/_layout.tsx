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
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <AppProvider>
          <AuthProvider>
            <MonetizationProvider>
              <PurchaseProvider>
                <OnboardingProvider>
                <AudioProvider>
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
                </AudioProvider>
                </OnboardingProvider>
              </PurchaseProvider>
            </MonetizationProvider>
          </AuthProvider>
        </AppProvider>
      </PrivacyProvider>
    </QueryClientProvider>
  );
}