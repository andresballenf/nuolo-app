import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function AuthScreen() {
  const { signInWithOAuth } = useAuth();

  const handleGetStarted = () => {
    router.push('/auth/signup');
  };

  const handleLogin = () => {
    router.push('/auth/login');
  };

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    try {
      const { error } = await signInWithOAuth(provider);
      if (!error) {
        router.replace('/map');
      }
    } catch (error) {
      console.error('OAuth login error:', error);
    }
  };

  return (
    <LinearGradient
      colors={['#84cc16', '#65a30d']}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.iconContainer}>
              <Icon name="headset" size={56} color="#ffffff" />
            </View>
            <Text style={styles.title}>Nuolo</Text>
            <Text style={styles.subtitle}>
              Discover stories behind every place
            </Text>
          </View>

          {/* Features Section */}
          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <Icon name="location" size={24} color="#ffffff" />
              <Text style={styles.featureText}>Location-based audio tours</Text>
            </View>
            <View style={styles.feature}>
              <Icon name="mic" size={24} color="#ffffff" />
              <Text style={styles.featureText}>Professional narration</Text>
            </View>
            <View style={styles.feature}>
              <Icon name="star" size={24} color="#ffffff" />
              <Text style={styles.featureText}>Personalized experiences</Text>
            </View>
          </View>

          {/* Auth Buttons */}
          <View style={styles.buttonContainer}>
            <Button
              title="Get Started"
              onPress={handleGetStarted}
              variant="secondary"
              size="lg"
              style={[styles.button, styles.primaryButton]}
            />
            
            <TouchableOpacity
              onPress={handleLogin}
              style={styles.loginButton}
            >
              <Text style={styles.loginText}>Already have an account? Sign In</Text>
            </TouchableOpacity>

            {/* Quick Sign In Options */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.oauthContainer}>
              <TouchableOpacity
                style={styles.oauthButton}
                onPress={() => handleOAuthLogin('google')}
              >
                <Icon name="logo-google" size={24} color="#4285f4" />
                <Text style={styles.oauthText}>Continue with Google</Text>
              </TouchableOpacity>
              
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.oauthButton}
                  onPress={() => handleOAuthLogin('apple')}
                >
                  <Icon name="logo-apple" size={24} color="#000000" />
                  <Text style={styles.oauthText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
    backgroundColor: '#84cc16',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 60,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
  },
  featuresContainer: {
    marginVertical: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureText: {
    marginLeft: 16,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
  },
  loginButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loginText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    marginHorizontal: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  oauthContainer: {
    gap: 12,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  oauthText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
});