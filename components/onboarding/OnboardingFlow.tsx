import React, { useRef, useEffect } from 'react';
import { Modal, View, StyleSheet, StatusBar, Animated, Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import { WelcomeStep } from './WelcomeStep';
import { PersonalizationStep } from './PersonalizationStep';
import { PermissionsStep } from './PermissionsStep';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const OnboardingFlow: React.FC = () => {
  const { 
    currentStep, 
    currentStepIndex,
    totalSteps,
    hasCompletedOnboarding,
  } = useOnboarding();
  const { user } = useAuth();
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Only show onboarding if user is authenticated and hasn't completed onboarding
  const shouldShow = user && !hasCompletedOnboarding;
  
  // Initial animation on mount
  useEffect(() => {
    if (shouldShow) {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [shouldShow]);
  
  // Animate step transitions
  useEffect(() => {
    if (shouldShow && currentStepIndex > 0) {
      // Only animate on step changes, not initial mount
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [currentStep]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep />;
      case 'personalization':
        return <PersonalizationStep />;
      case 'permissions':
        return <PermissionsStep />;
      default:
        return <WelcomeStep />;
    }
  };

  const renderProgressDots = () => {
    return (
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === currentStepIndex && styles.progressDotActive,
              index < currentStepIndex && styles.progressDotCompleted,
            ]}
          />
        ))}
      </View>
    );
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <Modal
      visible={shouldShow}
      animationType="fade"
      presentationStyle="fullScreen"
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaProvider>
        <View style={styles.container}>
          {/* Progress Dots */}
          {renderProgressDots()}
          
          {/* Animated Step Content */}
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {renderCurrentStep()}
          </Animated.View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: '#84cc16',
  },
  progressDotCompleted: {
    backgroundColor: '#84cc16',
    opacity: 0.5,
  },
  stepContainer: {
    flex: 1,
  },
});