import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { RadioGroup } from '../ui/RadioGroup';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useApp } from '../../contexts/AppContext';

export const LanguageStep: React.FC = () => {
  const { nextStep, previousStep } = useOnboarding();
  const { userPreferences, setUserPreferences } = useApp();

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' },
  ];

  const handleLanguageChange = async (value: string) => {
    await setUserPreferences({ language: value as any });
  };

  const handleNext = () => {
    if (userPreferences.language) {
      nextStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Card variant="gradient" style={styles.card}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="language" size={24} color="#ffffff" />
            </View>
            <Text style={styles.title}>Choose Your Language</Text>
          </View>
          
          <Text style={styles.subtitle}>
            Select your preferred language for audio narration and app interface.
          </Text>
          
          <View style={styles.radioContainer}>
            <RadioGroup
              options={languages}
              value={userPreferences.language}
              onValueChange={handleLanguageChange}
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
              disabled={!userPreferences.language}
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