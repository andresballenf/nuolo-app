import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const WelcomeStep: React.FC = () => {
  const { nextStep } = useOnboarding();
  
  // Animation values
  const iconScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Entrance animation sequence
    Animated.sequence([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 50,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 400,
          delay: 100,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          tension: 65,
          friction: 8,
          delay: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Announce screen content for screen readers
      AccessibilityInfo.announceForAccessibility(
        "Welcome to Nuolo setup. Step 1 of 8. Get started with your personalized audio guide experience."
      );
    });
  }, []);
  
  const handleGetStarted = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    nextStep();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Card variant="gradient" style={styles.card}>
        <View style={styles.content}>
          <Animated.View style={[
            styles.iconContainer,
            {
              transform: [{ scale: iconScale }]
            }
          ]}>
            <Icon name="headset" size={48} color="#ffffff" />
          </Animated.View>
          
          <Animated.Text style={[
            styles.title,
            { opacity: titleOpacity }
          ]}>
            Welcome to Nuolo
          </Animated.Text>
          
          <Animated.Text style={[
            styles.subtitle,
            { opacity: subtitleOpacity }
          ]}>
            Your personalized audio guide for exploring the world around you.
            Let's set up your experience in a few quick steps.
          </Animated.Text>
          
          <Animated.View style={[
            styles.buttonContainer,
            {
              transform: [{ scale: buttonScale }]
            }
          ]}>
            <Button
              title="Get Started"
              onPress={handleGetStarted}
              variant="primary"
              size="lg"
              style={styles.button}
            />
          </Animated.View>
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
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
  },
});