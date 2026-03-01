import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useCallback, useRef } from 'react';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { View, AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { parseDeepLink } from '../lib/deepLink';
import { AppProvider } from '../contexts/AppContext';
import { AuthProvider } from '../contexts/AuthContext';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { AudioProvider } from '../contexts/AudioContext';
import { PrivacyProvider } from '../contexts/PrivacyContext';
import { MonetizationProvider } from '../contexts/MonetizationContext';
import { MapSettingsProvider } from '../contexts/MapSettingsContext';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { TelemetryService } from '../services/TelemetryService';
import { runStartupHealthChecks } from '../services/RuntimeHealthService';
import { initializeErrorTracking, shutdownErrorTracking } from '../services/ErrorTrackingService';
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

const DEEP_LINK_HISTORY_LIMIT = 100;
const MIN_SESSION_TOKEN_LENGTH = 20;

const isLikelySessionToken = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length >= MIN_SESSION_TOKEN_LENGTH;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });
  const handledDeepLinks = useRef<Set<string>>(new Set());
  const deepLinkQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    initializeErrorTracking();
    runStartupHealthChecks();
    TelemetryService.increment('session_start');

    TelemetryService.startAutoFlush();

    const appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        TelemetryService.flush().catch(() => {});
      }
    });

    return () => {
      appStateSubscription.remove();
      TelemetryService.stopAutoFlush();
      TelemetryService.flush().catch(() => {});
      shutdownErrorTracking();
    };
  }, []);

  const processDeepLink = useCallback(async (url: string) => {
    if (!url) return;

    if (handledDeepLinks.current.has(url)) {
      TelemetryService.increment('auth_deep_link_duplicate_ignored');
      return;
    }
    handledDeepLinks.current.add(url);
    if (handledDeepLinks.current.size > DEEP_LINK_HISTORY_LIMIT) {
      handledDeepLinks.current.clear();
      handledDeepLinks.current.add(url);
    }

    try {
      const parsed = parseDeepLink(url);
      logger.info('Deep link received', {
        path: parsed.path,
        hasQueryParams: Object.keys(parsed.queryParams).length > 0,
        hasSessionTokens: parsed.hasSessionTokens,
      });

      const accessToken = parsed.hashParams.access_token ?? parsed.queryParams.access_token;
      const refreshToken = parsed.hashParams.refresh_token ?? parsed.queryParams.refresh_token;
      const hasValidSessionTokens =
        isLikelySessionToken(accessToken) && isLikelySessionToken(refreshToken);

      if (parsed.hasSessionTokens && !hasValidSessionTokens) {
        TelemetryService.increment('auth_deep_link_invalid_session_tokens');
        logger.warn('Deep link contained invalid session token payload', {
          path: parsed.path,
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(refreshToken),
        });
      }

      if (hasValidSessionTokens) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          TelemetryService.increment('auth_deep_link_session_set_failure');
          logger.error('Failed to set session from deep link', error, {
            path: parsed.path,
          });
        } else {
          TelemetryService.increment('auth_deep_link_session_set_success');
        }
      }

      switch (parsed.path) {
        case 'auth/confirm':
          router.replace('/auth/confirm');
          return;
        case 'auth/reset-password':
        case 'auth/update-password':
          router.replace('/auth/update-password');
          return;
        case 'auth/callback':
          TelemetryService.increment('auth_oauth_callback_received');
          if (hasValidSessionTokens) {
            router.replace('/map');
          }
          return;
        default:
          return;
      }
    } catch (error) {
      TelemetryService.increment('auth_deep_link_handler_error');
      logger.error('Error handling deep link', error, { url });
    }
  }, []);

  const handleDeepLink = useCallback((event: { url: string }) => {
    const url = event.url;
    if (!url) {
      return Promise.resolve();
    }

    const next = deepLinkQueueRef.current
      .catch(() => {
        // Keep queue alive if a prior item failed.
      })
      .then(async () => {
        await processDeepLink(url);
      });

    deepLinkQueueRef.current = next;
    return next;
  }, [processDeepLink]);

  // Handle deep links from email confirmation and password reset
  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL()
      .then(url => {
        if (url) {
          return handleDeepLink({ url });
        }
        return undefined;
      })
      .catch(error => {
        logger.error('Failed to read initial deep link URL', error);
      });

    return () => subscription.remove();
  }, [handleDeepLink]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      // Hide native splash once our first render has been laid out
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        logger.warn('Unable to hide splash screen', error);
      }
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
            <MapSettingsProvider>
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

                        <DiagnosticsOverlay />
                      </View>
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
