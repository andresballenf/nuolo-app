import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { useOnboarding } from '../../contexts/OnboardingContext';

const tutorialSteps = [
  {
    icon: 'map' as const,
    title: 'Discover Attractions',
    description: 'Explore the map to discover amazing attractions and historical sites near you.',
  },
  {
    icon: 'location' as const,
    title: 'Get Your Location',
    description: 'Allow location access to automatically find interesting places around you.',
  },
  {
    icon: 'information-circle' as const,
    title: 'Learn & Listen',
    description: 'Tap on any attraction to get AI-generated information and audio tours.',
  },
  {
    icon: 'headset' as const,
    title: 'Enjoy Audio Tours',
    description: 'Listen to personalized audio content while exploring each location.',
  },
];

export const TutorialStep: React.FC = () => {
  const { nextStep, previousStep } = useOnboarding();
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);

  const handleNext = () => {
    if (currentTutorialStep < tutorialSteps.length - 1) {
      setCurrentTutorialStep(currentTutorialStep + 1);
    } else {
      nextStep();
    }
  };

  const handlePrevious = () => {
    if (currentTutorialStep > 0) {
      setCurrentTutorialStep(currentTutorialStep - 1);
    } else {
      previousStep();
    }
  };

  const currentStep = tutorialSteps[currentTutorialStep];

  return (
    <SafeAreaView style={styles.container}>
      <Card variant="gradient" style={styles.card}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="school" size={24} color="#ffffff" />
            </View>
            <Text style={styles.title}>How It Works</Text>
          </View>
          
          <Text style={styles.subtitle}>
            Learn how to get the most out of your Nuolo experience.
          </Text>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {tutorialSteps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentTutorialStep && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          {/* Tutorial Step Content */}
          <View style={styles.tutorialContent}>
            <View style={styles.tutorialIconContainer}>
              <Icon name={currentStep.icon} size={48} color="#ffffff" />
            </View>
            
            <Text style={styles.tutorialTitle}>{currentStep.title}</Text>
            <Text style={styles.tutorialDescription}>{currentStep.description}</Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button
              title={currentTutorialStep === 0 ? "Back" : "Previous"}
              onPress={handlePrevious}
              variant="outline"
              size="md"
              style={styles.backButton}
              textStyle={styles.backButtonText}
            />
            <Button
              title={currentTutorialStep === tutorialSteps.length - 1 ? "Finish Tutorial" : "Next"}
              onPress={handleNext}
              variant="primary"
              size="md"
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
    marginBottom: 32,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    backgroundColor: '#ffffff',
    width: 24,
  },
  tutorialContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 40,
  },
  tutorialIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  tutorialTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  tutorialDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
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