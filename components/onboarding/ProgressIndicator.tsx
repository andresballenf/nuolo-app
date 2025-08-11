import React, { useEffect, useRef, memo, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { useOnboarding } from '../../contexts/OnboardingContext';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onStepPress?: (step: number) => void;
  labels?: string[];
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = memo(({
  currentStep,
  totalSteps,
  onStepPress,
  labels = [],
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const stepAnimations = useRef(
    Array(totalSteps).fill(0).map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Animate progress bar
    Animated.spring(progressAnim, {
      toValue: currentStep / totalSteps,
      useNativeDriver: false,
      tension: 50,
      friction: 10,
    }).start();

    // Animate step indicators
    stepAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: index <= currentStep ? 1 : 0,
        duration: 300,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    });
  }, [currentStep, totalSteps]);

  const handleStepPress = useCallback((step: number) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onStepPress && step < currentStep) {
      onStepPress(step);
    }
  }, [onStepPress, currentStep]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View 
            style={[
              styles.progressBarFill,
              { width: progressWidth }
            ]}
          />
        </View>
      </View>

      {/* Step Indicators */}
      <View style={styles.stepsContainer}>
        {Array(totalSteps).fill(0).map((_, index) => {
          const scale = stepAnimations[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.8, 1],
          });
          
          const opacity = stepAnimations[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1],
          });

          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isClickable = index < currentStep;

          return (
            <TouchableOpacity
              key={index}
              style={styles.stepWrapper}
              onPress={() => handleStepPress(index)}
              disabled={!isClickable}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Step ${index + 1}${labels[index] ? `: ${labels[index]}` : ''}`}
              accessibilityHint={
                isActive 
                  ? "Current step" 
                  : isCompleted 
                    ? "Completed step, tap to return"
                    : "Not yet completed"
              }
              accessibilityState={{
                selected: isActive,
                disabled: !isClickable,
              }}
            >
              <Animated.View
                style={[
                  styles.stepIndicator,
                  isActive && styles.activeStep,
                  isCompleted && styles.completedStep,
                  {
                    transform: [{ scale }],
                    opacity,
                  }
                ]}
              >
                <Text style={[
                  styles.stepNumber,
                  (isActive || isCompleted) && styles.activeStepNumber
                ]}>
                  {isCompleted ? '✓' : index + 1}
                </Text>
              </Animated.View>
              {labels[index] && (
                <Text style={[
                  styles.stepLabel,
                  isActive && styles.activeStepLabel,
                  isCompleted && styles.completedStepLabel,
                ]} numberOfLines={1}>
                  {labels[index]}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Current Step Info */}
      <View style={styles.stepInfo}>
        <Text style={styles.stepInfoText}>
          Step {currentStep + 1} of {totalSteps}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
  },
  progressBarContainer: {
    marginBottom: 20,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeStep: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  completedStep: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderColor: '#ffffff',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  activeStepNumber: {
    color: '#84cc16',
  },
  stepLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
    maxWidth: 50,
  },
  activeStepLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  completedStepLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  stepInfo: {
    alignItems: 'center',
  },
  stepInfoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
});