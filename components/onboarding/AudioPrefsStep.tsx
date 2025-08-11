import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { RadioGroup } from '../ui/RadioGroup';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useApp } from '../../contexts/AppContext';

export const AudioPrefsStep: React.FC = () => {
  const { nextStep, previousStep } = useOnboarding();
  const { userPreferences, setUserPreferences } = useApp();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const section1Anim = useRef(new Animated.Value(0)).current;
  const section2Anim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(section1Anim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(section2Anim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          delay: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const voiceStyles = [
    { value: 'casual', label: 'Casual' },
    { value: 'formal', label: 'Formal' },
    { value: 'energetic', label: 'Energetic' },
    { value: 'calm', label: 'Calm' },
  ];

  const audioLengths = [
    { value: 'short', label: 'Short (1-2 minutes)' },
    { value: 'medium', label: 'Medium (3-5 minutes)' },
    { value: 'deep-dive', label: 'Deep Dive (5+ minutes)' },
  ];

  const handleVoiceStyleChange = async (value: string) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    await setUserPreferences({ voiceStyle: value as any });
  };

  const handleAudioLengthChange = async (value: string) => {
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
    await setUserPreferences({ audioLength: value as any });
  };

  const handleNext = () => {
    if (userPreferences.voiceStyle && userPreferences.audioLength) {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      nextStep();
    }
  };
  
  const handleBack = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    previousStep();
  };

  const canContinue = userPreferences.voiceStyle && userPreferences.audioLength;

  return (
    <SafeAreaView style={styles.container}>
      <Card variant="gradient" style={styles.card}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <Animated.View style={[
            styles.content,
            { opacity: fadeAnim }
          ]}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Icon name="volume-high" size={24} color="#ffffff" />
              </View>
              <Text style={styles.title}>Audio Preferences</Text>
            </View>
            
            <Text style={styles.subtitle}>
              Customize your audio tour experience with your preferred voice style and content length.
            </Text>
            
            <Animated.View style={[
              styles.section,
              {
                opacity: section1Anim,
                transform: [{ 
                  translateY: section1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}>
              <Text style={styles.sectionTitle}>Voice Style</Text>
              <RadioGroup
                options={voiceStyles}
                value={userPreferences.voiceStyle}
                onValueChange={handleVoiceStyleChange}
              />
            </Animated.View>

            <Animated.View style={[
              styles.section,
              {
                opacity: section2Anim,
                transform: [{ 
                  translateY: section2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}>
              <Text style={styles.sectionTitle}>Audio Length</Text>
              <RadioGroup
                options={audioLengths}
                value={userPreferences.audioLength}
                onValueChange={handleAudioLengthChange}
              />
            </Animated.View>
            
            <View style={styles.buttonContainer}>
              <Button
                title="Back"
                onPress={handleBack}
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
                disabled={!canContinue}
              />
            </View>
          </Animated.View>
        </ScrollView>
      </Card>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(132, 204, 22, 0.1)',
    padding: 20,
  },
  card: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 20,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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