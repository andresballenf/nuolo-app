import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { RadioGroup } from '../ui/RadioGroup';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useApp } from '../../contexts/AppContext';

export const InterestsStep: React.FC = () => {
  const { nextStep, previousStep } = useOnboarding();
  const { userPreferences, setUserPreferences } = useApp();

  const interests = [
    { value: 'history', label: 'History' },
    { value: 'nature', label: 'Nature' },
    { value: 'architecture', label: 'Architecture' },
    { value: 'culture', label: 'Culture' },
  ];

  const handleInterestChange = async (value: string) => {
    await setUserPreferences({ theme: value as any });
  };

  const handleNext = () => {
    if (userPreferences.theme) {
      nextStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Card variant="gradient" style={styles.card}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="book" size={24} color="#ffffff" />
            </View>
            <Text style={styles.title}>What Interests You?</Text>
          </View>
          
          <Text style={styles.subtitle}>
            Choose your main interest to personalize your audio tour experience.
          </Text>
          
          <View style={styles.radioContainer}>
            <RadioGroup
              options={interests}
              value={userPreferences.theme}
              onValueChange={handleInterestChange}
            />
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
              title="Continue"
              onPress={handleNext}
              variant="primary"
              size="md"
              style={styles.button}
              disabled={!userPreferences.theme}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 24,
    marginBottom: 24,
  },
  radioContainer: {
    marginBottom: 32,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
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