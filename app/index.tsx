import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding } from '../contexts/OnboardingContext';

export default function IndexScreen() {
  const { user, loading: authLoading } = useAuth();
  const { hasCompletedOnboarding, loading: onboardingLoading } = useOnboarding();

  console.log('Index screen - Auth loading:', authLoading, 'User:', !!user);
  console.log('Index screen - Onboarding loading:', onboardingLoading, 'Completed:', hasCompletedOnboarding);

  // Show loading while checking auth and onboarding status
  if (authLoading || onboardingLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#84cc16" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // In dev mode with auth bypassed, go directly to map
  if (user) {
    return <Redirect href="/map" />;
  }

  // Otherwise go to auth
  return <Redirect href="/auth" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
});