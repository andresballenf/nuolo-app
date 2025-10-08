import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams<{ token_hash?: string; type?: string }>();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkEmailVerification();
  }, []);

  const checkEmailVerification = async () => {
    try {
      // Check if user is already authenticated from the deep link
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session check error:', sessionError);
        setError('Failed to verify email');
      } else if (session) {
        // User is authenticated via the email verification link
        console.log('Email verified successfully, session established');
        setSuccess(true);

        // Redirect to map after a short delay
        setTimeout(() => {
          router.replace('/map');
        }, 2000);
      } else {
        // No session found - link is invalid or expired
        setError('Invalid verification link');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#84cc16" />
          <Text style={styles.loadingText}>Verifying your email...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="close-circle" size={64} color="#ef4444" />
          </View>

          <Text style={styles.title}>Verification Failed</Text>
          <Text style={styles.message}>{error}</Text>

          <Text style={styles.hint}>
            The verification link may have expired or already been used.
          </Text>

          <Button
            title="Go to Login"
            onPress={() => router.replace('/auth/login')}
            variant="primary"
            size="lg"
            style={styles.button}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="checkmark-circle" size={64} color="#84cc16" />
          </View>

          <Text style={styles.title}>Email Verified!</Text>
          <Text style={styles.message}>
            Your email has been successfully verified.
          </Text>

          <Text style={styles.hint}>
            Redirecting you to the app...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  hint: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  button: {
    width: '100%',
  },
});
