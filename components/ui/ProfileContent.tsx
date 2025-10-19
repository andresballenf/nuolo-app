import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../../contexts/AppContext';
import type {
  AudioLength,
  Language,
  Theme,
  VoiceStyle,
} from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMonetization } from '../../contexts/MonetizationContext';
import { Button } from './Button';
import { CreditPackCard } from '../purchase/CreditPackCard';
import { router } from 'expo-router';

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
] as const satisfies Array<{ code: Language; name: string; flag: string }>;

export const ProfileContent: React.FC<ProfileContentProps> = ({
  onResetOnboarding,
  onClose,
}) => {
  const { userPreferences, setUserPreferences } = useApp();
  const { resetOnboarding } = useOnboarding();
  const { user, signOut, isAuthenticated } = useAuth();
  const monetization = useMonetization();
  const {
    subscription,
    entitlements,
    setShowPaywall,
    refreshEntitlements,
    initialized,
    resetFreeCounter,
  } = monetization;
  
  // Modal states for editing preferences
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAudioLengthModal, setShowAudioLengthModal] = useState(false);
  const [showVoiceStyleModal, setShowVoiceStyleModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const themes = [
    { value: 'history', label: 'History', icon: '🏛️' },
    { value: 'nature', label: 'Nature', icon: '🌿' },
    { value: 'architecture', label: 'Architecture', icon: '🏗️' },
    { value: 'culture', label: 'Culture', icon: '🎭' },
    { value: 'general', label: 'General', icon: '🌍' },
  ] satisfies Array<{ value: Theme; label: string; icon: string }>;
  
  const audioLengths = [
    { value: 'short', label: 'Short', description: '30-60 seconds' },
    { value: 'medium', label: 'Medium', description: '1-3 minutes' },
    { value: 'deep-dive', label: 'Deep Dive', description: '3-5 minutes' },
  ] satisfies Array<{ value: AudioLength; label: string; description: string }>;
  
  const voiceStyles = [
    { value: 'casual', label: 'Casual', description: 'Friendly and conversational' },
    { value: 'formal', label: 'Formal', description: 'Professional and informative' },
    { value: 'energetic', label: 'Energetic', description: 'Enthusiastic and dynamic' },
    { value: 'calm', label: 'Calm', description: 'Soothing and peaceful' },
  ] satisfies Array<{ value: VoiceStyle; label: string; description: string }>;
  
  const handleLanguageChange = (code: Language) => {
    void setUserPreferences({ language: code });
  };
  
  const handleThemeChange = async (theme: Theme) => {
    setIsSaving(true);
    try {
      await setUserPreferences({ theme });
      setShowThemeModal(false);
      Alert.alert('Success', 'Theme preference updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update theme preference');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAudioLengthChange = async (length: AudioLength) => {
    setIsSaving(true);
    try {
      await setUserPreferences({ audioLength: length });
      setShowAudioLengthModal(false);
      Alert.alert('Success', 'Audio length preference updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update audio length preference');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleVoiceStyleChange = async (style: VoiceStyle) => {
    setIsSaving(true);
    try {
      await setUserPreferences({ voiceStyle: style });
      setShowVoiceStyleModal(false);
      Alert.alert('Success', 'Voice style preference updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to update voice style preference');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleBatteryOptimizationToggle = async (value: boolean) => {
    setIsSaving(true);
    try {
      await setUserPreferences({ batteryOptimization: value });
      Alert.alert('Success', `Battery saver ${value ? 'enabled' : 'disabled'}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update battery optimization');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleResetOnboarding = () => {
    resetOnboarding();
    onResetOnboarding?.();
    onClose?.();
  };
  
  const handleSignOut = async () => {
    await signOut();
    onClose?.();
    router.replace('/auth');
  };
  
  const handleSignIn = () => {
    onClose?.();
    router.push('/auth/login');
  };

  useEffect(() => {
    if (!initialized) return;
    refreshEntitlements().catch(error => {
      console.error('Failed to refresh entitlements for profile view:', error);
    });
  }, [initialized, refreshEntitlements]);

  const baseFreeCredits = 2;
  const totalCredits = Math.max(0, entitlements.totalAttractionLimit ?? 0);
  const remainingCredits = Math.max(0, entitlements.remainingFreeAttractions ?? 0);
  const hasUnlimitedSubscription = subscription.isActive && subscription.type !== 'free';

  // Calculate bucket values for CreditPackCard with FIFO logic
  // FIFO: Trial credits are consumed first, then purchased credits
  const totalUsed = Math.max(0, totalCredits - remainingCredits);

  // Trial bucket: max 2 credits
  const trialUsed = Math.min(baseFreeCredits, totalUsed);
  const trialAvailable = Math.max(0, baseFreeCredits - trialUsed);

  // Purchased bucket: everything beyond trial credits
  const purchasedTotal = Math.max(0, totalCredits - baseFreeCredits);
  const purchasedUsed = Math.max(0, totalUsed - baseFreeCredits);
  const purchasedAvailable = Math.max(0, purchasedTotal - purchasedUsed);
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* User Info Section */}
      <View style={styles.section}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <MaterialIcons 
              name="account-circle" 
              size={64} 
              color={isAuthenticated ? "#84cc16" : "#9CA3AF"} 
            />
          </View>
          <Text style={styles.userName}>
            {user?.profile?.fullName || user?.email?.split('@')[0] || 'Guest User'}
          </Text>
          <Text style={styles.userEmail}>
            {user?.email || 'Not signed in'}
          </Text>
          {user?.emailVerified === false && (
            <View style={styles.verificationBadge}>
              <MaterialIcons name="info" size={14} color="#F59E0B" />
              <Text style={styles.verificationText}>Email not verified</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Subscription Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>

        {hasUnlimitedSubscription ? (
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <View style={styles.subscriptionInfo}>
                <Text style={styles.subscriptionPlan}>Premium Membership</Text>
                <View style={styles.subscriptionBadge}>
                  <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.subscriptionBadgeText}>Active</Text>
                </View>
              </View>
              <MaterialIcons name="star" size={24} color="#84cc16" />
            </View>

            <View style={styles.subscriptionFeatures}>
              <View style={styles.subscriptionFeature}>
                <MaterialIcons name="check" size={16} color="#84cc16" />
                <Text style={styles.subscriptionFeatureText}>Unlimited audio guides</Text>
              </View>
              <View style={styles.subscriptionFeature}>
                <MaterialIcons name="check" size={16} color="#84cc16" />
                <Text style={styles.subscriptionFeatureText}>All locations worldwide</Text>
              </View>
              <View style={styles.subscriptionFeature}>
                <MaterialIcons name="check" size={16} color="#84cc16" />
                <Text style={styles.subscriptionFeatureText}>Premium voice narration</Text>
              </View>
              <View style={styles.subscriptionFeature}>
                <MaterialIcons name="check" size={16} color="#84cc16" />
                <Text style={styles.subscriptionFeatureText}>Offline download support</Text>
              </View>
            </View>

            {subscription.expiresAt && (
              <Text style={styles.subscriptionExpiry}>
                Renews on {new Date(subscription.expiresAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        ) : (
          <CreditPackCard
            trialAvailable={trialAvailable}
            trialUsed={trialUsed}
            purchasedAvailable={purchasedAvailable}
            purchasedUsed={purchasedUsed}
            onBuyMoreCredits={() => setShowPaywall(true, { trigger: 'manual' })}
            lowThreshold={20}
          />
        )}
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
          <TouchableOpacity style={styles.preferenceItem} onPress={() => setShowThemeModal(true)}>
            <MaterialIcons name="palette" size={20} color="#6B7280" />
            <Text style={styles.preferenceLabel}>Theme:</Text>
            <Text style={styles.preferenceValue}>
              {userPreferences.theme.charAt(0).toUpperCase() + userPreferences.theme.slice(1)}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.preferenceItem} onPress={() => setShowAudioLengthModal(true)}>
            <MaterialIcons name="timer" size={20} color="#6B7280" />
            <Text style={styles.preferenceLabel}>Audio Length:</Text>
            <Text style={styles.preferenceValue}>
              {userPreferences.audioLength === 'deep-dive' ? 'Deep Dive' : 
               userPreferences.audioLength.charAt(0).toUpperCase() + userPreferences.audioLength.slice(1)}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.preferenceItem} onPress={() => setShowVoiceStyleModal(true)}>
            <MaterialIcons name="record-voice-over" size={20} color="#6B7280" />
            <Text style={styles.preferenceLabel}>Voice Style:</Text>
            <Text style={styles.preferenceValue}>
              {userPreferences.voiceStyle.charAt(0).toUpperCase() + userPreferences.voiceStyle.slice(1)}
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          
          <View style={styles.preferenceItem}>
            <MaterialIcons name="battery-charging-full" size={20} color="#6B7280" />
            <Text style={styles.preferenceLabel}>Battery Saver:</Text>
            <Switch
              value={userPreferences.batteryOptimization}
              onValueChange={handleBatteryOptimizationToggle}
              trackColor={{ false: '#E5E7EB', true: '#84cc16' }}
              thumbColor={userPreferences.batteryOptimization ? '#FFFFFF' : '#F3F4F6'}
              disabled={isSaving}
            />
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
        {__DEV__ && (
          <Button
            title="🔧 Reset Free Counter (Dev)"
            onPress={async () => {
              if (!resetFreeCounter) {
                Alert.alert('Info', 'Reset function not available');
                return;
              }

              await resetFreeCounter();
              Alert.alert('Success', 'Free counter has been reset to 2/2');
            }}
            variant="outline"
            size="md"
            style={[styles.actionButton, { backgroundColor: '#FEE2E2' }]}
          />
        )}
        {isAuthenticated ? (
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="secondary"
            size="md"
            style={styles.actionButton}
          />
        ) : (
          <Button
            title="Sign In"
            onPress={handleSignIn}
            variant="primary"
            size="md"
            style={styles.actionButton}
          />
        )}
      </View>
      
      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appVersion}>Nuolo v1.0.0</Text>
        <Text style={styles.appCopyright}>© 2024 Nuolo. All rights reserved.</Text>
      </View>
      
      {/* Bottom spacing to ensure last content is accessible in all sheet states */}
      <View style={{ height: 150 }} />
      
      {/* Theme Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showThemeModal}
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Theme</Text>
            {themes.map((theme) => (
              <TouchableOpacity
                key={theme.value}
                style={[
                  styles.modalOption,
                  userPreferences.theme === theme.value && styles.modalOptionActive,
                ]}
                onPress={() => handleThemeChange(theme.value)}
                disabled={isSaving}
              >
                <Text style={styles.modalOptionIcon}>{theme.icon}</Text>
                <Text style={[
                  styles.modalOptionText,
                  userPreferences.theme === theme.value && styles.modalOptionTextActive,
                ]}>
                  {theme.label}
                </Text>
                {userPreferences.theme === theme.value && (
                  <MaterialIcons name="check" size={20} color="#84cc16" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowThemeModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Audio Length Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAudioLengthModal}
        onRequestClose={() => setShowAudioLengthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Audio Length</Text>
            {audioLengths.map((length) => (
              <TouchableOpacity
                key={length.value}
                style={[
                  styles.modalOption,
                  userPreferences.audioLength === length.value && styles.modalOptionActive,
                ]}
                onPress={() => handleAudioLengthChange(length.value)}
                disabled={isSaving}
              >
                <View style={styles.modalOptionContent}>
                  <Text style={[
                    styles.modalOptionText,
                    userPreferences.audioLength === length.value && styles.modalOptionTextActive,
                  ]}>
                    {length.label}
                  </Text>
                  <Text style={styles.modalOptionDescription}>{length.description}</Text>
                </View>
                {userPreferences.audioLength === length.value && (
                  <MaterialIcons name="check" size={20} color="#84cc16" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAudioLengthModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Voice Style Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showVoiceStyleModal}
        onRequestClose={() => setShowVoiceStyleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Voice Style</Text>
            {voiceStyles.map((style) => (
              <TouchableOpacity
                key={style.value}
                style={[
                  styles.modalOption,
                  userPreferences.voiceStyle === style.value && styles.modalOptionActive,
                ]}
                onPress={() => handleVoiceStyleChange(style.value)}
                disabled={isSaving}
              >
                <View style={styles.modalOptionContent}>
                  <Text style={[
                    styles.modalOptionText,
                    userPreferences.voiceStyle === style.value && styles.modalOptionTextActive,
                  ]}>
                    {style.label}
                  </Text>
                  <Text style={styles.modalOptionDescription}>{style.description}</Text>
                </View>
                {userPreferences.voiceStyle === style.value && (
                  <MaterialIcons name="check" size={20} color="#84cc16" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowVoiceStyleModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    gap: 4,
  },
  verificationText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
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
    paddingVertical: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  modalOptionActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#84cc16',
  },
  modalOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  modalOptionTextActive: {
    color: '#059669',
  },
  modalOptionDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalCancelButton: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  subscriptionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionPlan: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#84cc16',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  subscriptionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subscriptionFeatures: {
    gap: 10,
    marginBottom: 16,
  },
  subscriptionFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionFeatureText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  subscriptionExpiry: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
});
