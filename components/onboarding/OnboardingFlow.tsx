import React, { useRef, useEffect } from 'react';
import { Modal, View, StyleSheet, StatusBar, Animated, Dimensions, PanResponder, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import { WelcomeStep } from './WelcomeStep';
import { LanguageStep } from './LanguageStep';
import { InterestsStep } from './InterestsStep';
import { AudioPrefsStep } from './AudioPrefsStep';
import { LocationStep } from './LocationStep';
import { PrivacyStep } from './PrivacyStep';
import { TutorialStep } from './TutorialStep';
import { CompletionStep } from './CompletionStep';
import { ProgressIndicator } from './ProgressIndicator';
import { ErrorBoundary } from '../ui/ErrorBoundary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const OnboardingFlow: React.FC = () => {
  const { 
    currentStep, 
    currentStepIndex,
    totalSteps,
    hasCompletedOnboarding,
    nextStep,
    previousStep,
    goToStepIndex,
    getStepLabels
  } = useOnboarding();
  const { user } = useAuth();
  
  // Animation references
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const gestureX = useRef(new Animated.Value(0)).current;

  // Only show onboarding if user is authenticated and hasn't completed onboarding
  const shouldShow = user && !hasCompletedOnboarding;
  
  // Animate step transitions
  useEffect(() => {
    if (shouldShow) {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        // Reset position and fade in
        slideAnim.setValue(SCREEN_WIDTH);
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 10,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [currentStep]);
  
  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && 
               Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        // Allow swiping but with resistance
        gestureX.setValue(gestureState.dx * 0.5);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = SCREEN_WIDTH * 0.25;
        
        if (gestureState.dx > swipeThreshold && currentStepIndex > 0) {
          // Swipe right - go to previous step
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          previousStep();
        } else if (gestureState.dx < -swipeThreshold && currentStepIndex < totalSteps - 1) {
          // Swipe left - go to next step
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          nextStep();
        }
        
        // Spring back to center
        Animated.spring(gestureX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 10,
        }).start();
      },
    })
  ).current;

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep />;
      case 'language':
        return <LanguageStep />;
      case 'interests':
        return <InterestsStep />;
      case 'audioPrefs':
        return <AudioPrefsStep />;
      case 'location':
        return <LocationStep />;
      case 'privacy':
        return <PrivacyStep />;
      case 'tutorial':
        return <TutorialStep />;
      case 'completion':
        return <CompletionStep />;
      default:
        return <WelcomeStep />;
    }
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <Modal
      visible={shouldShow}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <StatusBar barStyle="light-content" backgroundColor="#84cc16" translucent={false} />
      <SafeAreaProvider>
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.error('Onboarding error:', error, errorInfo);
            // Could send to analytics service here
          }}
        >
          <View style={styles.container}>
          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <ProgressIndicator
              currentStep={currentStepIndex}
              totalSteps={totalSteps}
              onStepPress={goToStepIndex}
              labels={getStepLabels()}
            />
          </View>
          
          {/* Animated Step Content */}
          <Animated.View 
            style={[
              styles.stepContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { translateX: Animated.add(slideAnim, gestureX) }
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            {renderCurrentStep()}
          </Animated.View>
        </View>
        </ErrorBoundary>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#84cc16',
  },
  progressContainer: {
    position: 'absolute',
    top: Platform.select({ ios: 50, android: 30 }),
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flex: 1,
  },
});