import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Button } from './Button';

interface ProfileContentProps {
  onResetOnboarding?: () => void;
  onClose?: () => void;
}

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
];

export const ProfileContent: React.FC<ProfileContentProps> = ({
  onResetOnboarding,
  onClose,
}) => {
  const { userPreferences, setUserPreferences } = useApp();
  const { resetOnboarding } = useOnboarding();
  
  const handleLanguageChange = (code: string) => {
    setUserPreferences({ language: code as any });
  };
  
  const handleResetOnboarding = () => {
    resetOnboarding();
    onResetOnboarding?.();
    onClose?.();
  };
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* User Info Section */}
      <View style={styles.section}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <MaterialIcons name="account-circle" size={64} color="#9CA3AF" />
          </View>
          <Text style={styles.userName}>Guest User</Text>
          <Text style={styles.userEmail}>Not signed in</Text>
        </View>
      </View>
      
      {/* Language Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Language</Text>
        <View style={styles.languageGrid}>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageItem,
                userPreferences.language === lang.code && styles.languageItemActive,
              ]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={styles.languageFlag}>{lang.flag}</Text>
              <Text style={[
                styles.languageName,
                userPreferences.language === lang.code && styles.languageNameActive,
              ]}>{lang.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Preferences Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Preferences</Text>
        <View style={styles.preferencesList}>
          <View style={styles.preferenceItem}>
            <MaterialIcons name="palette" size={20} color="#6B7280" />
            <Text style={styles.preferenceLabel}>Theme:</Text>
            <Text style={styles.preferenceValue}>
              {userPreferences.theme.charAt(0).toUpperCase() + userPreferences.theme.slice(1)}
            </Text>
          </View>
          <View style={styles.preferenceItem}>
            <MaterialIcons name="timer" size={20} color="#6B7280" />
            <Text style={styles.preferenceLabel}>Audio Length:</Text>
            <Text style={styles.preferenceValue}>
              {userPreferences.audioLength === 'deep-dive' ? 'Deep Dive' : 
               userPreferences.audioLength.charAt(0).toUpperCase() + userPreferences.audioLength.slice(1)}
            </Text>
          </View>
          <View style={styles.preferenceItem}>
            <MaterialIcons name="record-voice-over" size={20} color="#6B7280" />
            <Text style={styles.preferenceLabel}>Voice Style:</Text>
            <Text style={styles.preferenceValue}>
              {userPreferences.voiceStyle.charAt(0).toUpperCase() + userPreferences.voiceStyle.slice(1)}
            </Text>
          </View>
          <View style={styles.preferenceItem}>
            <MaterialIcons name="battery-charging-full" size={20} color="#6B7280" />
            <Text style={styles.preferenceLabel}>Battery Saver:</Text>
            <Text style={styles.preferenceValue}>
              {userPreferences.batteryOptimization ? 'On' : 'Off'}
            </Text>
          </View>
        </View>
      </View>
      
      {/* Actions */}
      <View style={styles.section}>
        <Button
          title="Reset Preferences"
          onPress={handleResetOnboarding}
          variant="outline"
          size="md"
          style={styles.actionButton}
        />
        <Button
          title="Sign In"
          onPress={() => {}}
          variant="primary"
          size="md"
          style={styles.actionButton}
        />
      </View>
      
      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appVersion}>Nuolo v1.0.0</Text>
        <Text style={styles.appCopyright}>© 2024 Nuolo. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  userInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  languageItemActive: {
    backgroundColor: '#84cc16',
  },
  languageFlag: {
    fontSize: 16,
  },
  languageName: {
    fontSize: 14,
    color: '#6B7280',
  },
  languageNameActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  preferencesList: {
    gap: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preferenceLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  preferenceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  actionButton: {
    marginBottom: 12,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  appVersion: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});