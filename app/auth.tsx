import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

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
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* TODO: Add language selector here in the future */}

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/images/nuolo-logo.png')}
              style={[
                styles.logo,
                { width: styles.logo.width * 0.7, height: styles.logo.height * 0.7 }
              ]}
              resizeMode="contain"
            />
          </View>

          {/* Hero Image */}
          <View style={styles.heroImageContainer}>
            <Image 
              source={require('../assets/images/florence-hero.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Explore the world with</Text>
            <Text style={styles.titleBold}>Nuolo Audio Guides</Text>
            <Text style={styles.subtitle}>
              Discover hidden gems and fascinating stories with audio guides curated to your interests.
            </Text>
          </View>

          {/* Features Section */}
          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="headset-outline" size={22} color="#374151" />
              </View>
              <Text style={styles.featureText}>Immersive Audio Experiences</Text>
            </View>
            
            <View style={styles.feature}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="heart-outline" size={22} color="#374151" />
              </View>
              <Text style={styles.featureText}>Stories customized to your interests</Text>
            </View>
            
            <View style={styles.feature}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="globe-outline" size={22} color="#374151" />
              </View>
              <Text style={styles.featureText}>Any attraction, anywhere in the world</Text>
            </View>
          </View>

          {/* Spacer */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Fixed Auth Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleLogin}
            style={styles.loginButton}
            activeOpacity={0.7}
          >
            <Text style={styles.loginText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  languageButton: {
    position: 'absolute',
    top: 10,
    right: 24,
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  logo: {
    width: width * 0.5,
    height: 60,
  },
  heroImageContainer: {
    width: width,
    height: width * 0.65,
    marginBottom: 25,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
  },
  titleBold: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    width: '100%',
    paddingHorizontal: 34,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  featureIconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
  },
  signUpButton: {
    backgroundColor: '#84cc16',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#84cc16',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});