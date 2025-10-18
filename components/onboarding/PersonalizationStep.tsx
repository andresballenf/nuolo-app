import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { RadioGroup } from '../ui/RadioGroup';
import type { RadioOption } from '../ui/RadioGroup';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useApp } from '../../contexts/AppContext';
import type {
  AudioLength,
  Language,
  Theme,
  VoiceStyle,
} from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { PreferencesService } from '../../services/PreferencesService';
import { Ionicons } from '@expo/vector-icons';

export const PersonalizationStep: React.FC = () => {
  const { nextStep, previousStep } = useOnboarding();
  const { userPreferences, setUserPreferences } = useApp();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  
  // Animations - start visible
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const card1Anim = useRef(new Animated.Value(1)).current;
  const card2Anim = useRef(new Animated.Value(1)).current;
  const card3Anim = useRef(new Animated.Value(1)).current;
  const card4Anim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Simple fade in
    fadeAnim.setValue(0);
    card1Anim.setValue(0);
    card2Anim.setValue(0);
    card3Anim.setValue(0);
    card4Anim.setValue(0);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(card1Anim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(card2Anim, {
        toValue: 1,
        duration: 600,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(card3Anim, {
        toValue: 1,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(card4Anim, {
        toValue: 1,
        duration: 800,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const themes = [
    { value: 'history', label: 'History & Heritage' },
    { value: 'nature', label: 'Nature & Wildlife' },
    { value: 'architecture', label: 'Architecture' },
    { value: 'culture', label: 'Culture & Arts' },
  ] satisfies RadioOption<Theme>[];

  const voiceStyles = [
    { value: 'casual', label: 'Casual & Friendly' },
    { value: 'formal', label: 'Professional' },
    { value: 'energetic', label: 'Energetic' },
    { value: 'calm', label: 'Calm & Relaxing' },
  ] satisfies RadioOption<VoiceStyle>[];

  const audioLengths = [
    { value: 'short', label: 'Quick (1-2 min)' },
    { value: 'medium', label: 'Standard (3-5 min)' },
    { value: 'deep-dive', label: 'Detailed (5+ min)' },
  ] satisfies RadioOption<AudioLength>[];

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' },
  ] satisfies RadioOption<Language>[];

  const handleThemeChange = async (value: Theme) => {
    await setUserPreferences({ theme: value });
  };

  const handleVoiceStyleChange = async (value: VoiceStyle) => {
    await setUserPreferences({ voiceStyle: value });
  };

  const handleAudioLengthChange = async (value: AudioLength) => {
    await setUserPreferences({ audioLength: value });
  };

  const handleLanguageChange = async (value: Language) => {
    await setUserPreferences({ language: value });
  };

  const handleNext = async () => {
    if (user) {
      setSaving(true);
      try {
        // Save preferences to Supabase
        await PreferencesService.saveUserPreferences(user.id, {
          theme: userPreferences.theme,
          audioLength: userPreferences.audioLength,
          voiceStyle: userPreferences.voiceStyle,
          language: userPreferences.language,
          batteryOptimization: userPreferences.batteryOptimization,
        });
      } catch (error) {
        console.error('Error saving preferences:', error);
      } finally {
        setSaving(false);
      }
    }
    nextStep();
  };

  const canContinue = userPreferences.theme && userPreferences.voiceStyle && userPreferences.audioLength;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Personalize Your Experience</Text>
            <Text style={styles.subtitle}>
              Choose your preferences for the best audio tour experience
            </Text>
          </View>
          
          {/* Theme Card */}
          <Animated.View 
            style={[
              styles.card,
              {
                opacity: card1Anim,
                transform: [{
                  translateY: card1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="color-palette-outline" size={20} color="#84cc16" />
              </View>
              <Text style={styles.cardTitle}>Content Theme</Text>
            </View>
            <RadioGroup
              options={themes}
              value={userPreferences.theme}
              onValueChange={handleThemeChange}
            />
          </Animated.View>

          {/* Voice Style Card */}
          <Animated.View 
            style={[
              styles.card,
              {
                opacity: card2Anim,
                transform: [{
                  translateY: card2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="mic-outline" size={20} color="#84cc16" />
              </View>
              <Text style={styles.cardTitle}>Voice Style</Text>
            </View>
            <RadioGroup
              options={voiceStyles}
              value={userPreferences.voiceStyle}
              onValueChange={handleVoiceStyleChange}
            />
          </Animated.View>

          {/* Audio Length Card */}
          <Animated.View 
            style={[
              styles.card,
              {
                opacity: card3Anim,
                transform: [{
                  translateY: card3Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="time-outline" size={20} color="#84cc16" />
              </View>
              <Text style={styles.cardTitle}>Audio Length</Text>
            </View>
            <RadioGroup
              options={audioLengths}
              value={userPreferences.audioLength}
              onValueChange={handleAudioLengthChange}
            />
          </Animated.View>

          {/* Language Card */}
          <Animated.View 
            style={[
              styles.card,
              {
                opacity: card4Anim,
                transform: [{
                  translateY: card4Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="language-outline" size={20} color="#84cc16" />
              </View>
              <Text style={styles.cardTitle}>Language</Text>
            </View>
            <RadioGroup
              options={languages}
              value={userPreferences.language}
              onValueChange={handleLanguageChange}
            />
          </Animated.View>
        </Animated.View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          title="Back"
          onPress={previousStep}
          variant="outline"
          size="md"
          style={styles.backButton}
        />
        <Button
          title="Continue"
          onPress={handleNext}
          variant="primary"
          size="md"
          style={styles.continueButton}
          disabled={!canContinue}
          loading={saving}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  continueButton: {
    flex: 1,
  },
});