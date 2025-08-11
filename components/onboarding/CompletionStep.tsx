import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const CompletionStep: React.FC = () => {
  const { completeOnboarding, previousStep } = useOnboarding();

  const handleComplete = () => {
    completeOnboarding();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Card variant="gradient" style={styles.card}>
        <View style={styles.content}>
          <View style={styles.celebrationContainer}>
            <View style={styles.iconContainer}>
              <Icon name="checkmark-circle" size={64} color="#ffffff" />
            </View>
            
            <Text style={styles.title}>You're All Set!</Text>
            
            <Text style={styles.subtitle}>
              Welcome to Nuolo! Your personalized audio tour experience is ready to begin.
            </Text>

            <View style={styles.featuresContainer}>
              <View style={styles.feature}>
                <Icon name="location" size={20} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.featureText}>Location-based discovery</Text>
              </View>
              <View style={styles.feature}>
                <Icon name="headset" size={20} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.featureText}>AI-generated audio tours</Text>
              </View>
              <View style={styles.feature}>
                <Icon name="language" size={20} color="rgba(255, 255, 255, 0.9)" />
                <Text style={styles.featureText}>Personalized content</Text>
              </View>
            </View>

            <View style={styles.encouragementContainer}>
              <Text style={styles.encouragementText}>
                🎉 Ready to explore the world around you with personalized audio guides!
              </Text>
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button
              title="Back"
              onPress={previousStep}
              variant="outline"
              size="md"
              style={styles.backButton}
              textStyle={styles.backButtonText}
            />
            <Button
              title="Start Exploring"
              onPress={handleComplete}
              variant="primary"
              size="lg"
              style={styles.button}
            />
          </View>
        </View>
      </Card>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(132, 204, 22, 0.1)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  celebrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  featuresContainer: {
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
    fontWeight: '500',
  },
  encouragementContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  encouragementText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 2,
  },
  backButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});