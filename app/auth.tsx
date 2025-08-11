import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';

export default function AuthScreen() {
  const { signIn } = useAuth();

  const handleSkipAuth = async () => {
    // For development/testing - simulate login
    try {
      await signIn('dev@nuolo.com', 'password');
      router.replace('/map');
    } catch (error) {
      console.log('Skip auth - redirecting anyway');
      router.replace('/map');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card variant="gradient" style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.iconContainer}>
              <Icon name="headset" size={48} color="#ffffff" />
            </View>
            
            <Text style={styles.title}>Welcome to Nuolo</Text>
            <Text style={styles.subtitle}>
              Your personalized audio tour guide
            </Text>

            <View style={styles.buttonContainer}>
              <Button
                title="Continue as Guest"
                onPress={handleSkipAuth}
                variant="secondary"
                size="lg"
                style={styles.button}
              />
              
              <Text style={styles.developmentNote}>
                🔧 Development Mode: Authentication is bypassed for testing
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#84cc16',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
  },
  cardContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    marginBottom: 16,
  },
  developmentNote: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});