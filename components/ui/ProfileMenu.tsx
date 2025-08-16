import React, { useRef, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';

interface ProfileMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

export const ProfileMenu: React.FC<ProfileMenuProps> = ({
  isVisible,
  onClose,
  onNavigateToSettings,
}) => {
  const { userPreferences, setUserPreferences } = useApp();
  const { preferences: onboardingPreferences } = useOnboarding();
  const { user, isAuthenticated, signOut } = useAuth();
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const handleSignOut = async () => {
    await signOut();
    onClose();
    router.replace('/auth');
  };
  
  const handleSignIn = () => {
    onClose();
    router.push('/auth/login');
  };

  useEffect(() => {
    if (isVisible) {
      // Slide up from bottom
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const handleLanguageChange = (languageCode: string) => {
    setUserPreferences({
      ...userPreferences,
      language: languageCode,
    });
  };

  const currentLanguage = languages.find(lang => lang.code === userPreferences.language) || languages[0];

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View 
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
              },
            ]} 
          />
        </TouchableWithoutFeedback>

        {/* Menu */}
        <Animated.View 
          style={[
            styles.menu,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile & Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* User Info Section */}
            <View style={styles.section}>
              <View style={styles.userInfo}>
                <View style={[styles.avatar, isAuthenticated && styles.avatarAuthenticated]}>
                  {isAuthenticated && user ? (
                    <Text style={styles.avatarInitial}>
                      {user.profile?.fullName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  ) : (
                    <MaterialIcons name="account-circle" size={60} color="#9CA3AF" />
                  )}
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>
                    {user?.profile?.fullName || user?.email?.split('@')[0] || 'Guest User'}
                  </Text>
                  <Text style={styles.userEmail}>
                    {user?.email || 'Sign in for full features'}
                  </Text>
                  {user?.emailVerified === false && (
                    <View style={styles.verificationBadge}>
                      <MaterialIcons name="info" size={12} color="#F59E0B" />
                      <Text style={styles.verificationText}>Email not verified</Text>
                    </View>
                  )}
                </View>
              </View>
              {isAuthenticated ? (
                <TouchableOpacity 
                  style={styles.authButton}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <Text style={styles.authButtonText}>Sign Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.authButton, styles.signInButton]}
                  onPress={handleSignIn}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.authButtonText, styles.signInButtonText]}>Sign In</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Language Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Language</Text>
              <TouchableOpacity style={styles.languageSelector} activeOpacity={0.7}>
                <View style={styles.languageInfo}>
                  <Text style={styles.languageFlag}>{currentLanguage.flag}</Text>
                  <Text style={styles.languageName}>{currentLanguage.name}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Audio Preferences */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Audio Preferences</Text>
              <View style={styles.preferencesList}>
                <View style={styles.preferenceItem}>
                  <Text style={styles.preferenceLabel}>Theme</Text>
                  <Text style={styles.preferenceValue}>{userPreferences.theme}</Text>
                </View>
                <View style={styles.preferenceItem}>
                  <Text style={styles.preferenceLabel}>Audio Length</Text>
                  <Text style={styles.preferenceValue}>{userPreferences.audioLength}</Text>
                </View>
                <View style={styles.preferenceItem}>
                  <Text style={styles.preferenceLabel}>Voice Style</Text>
                  <Text style={styles.preferenceValue}>{userPreferences.voiceStyle}</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsList}>
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                  <MaterialIcons name="history" size={24} color="#6B7280" />
                  <Text style={styles.actionText}>Recent Places</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                  <MaterialIcons name="favorite" size={24} color="#6B7280" />
                  <Text style={styles.actionText}>Saved Locations</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton} 
                  activeOpacity={0.7}
                  onPress={onNavigateToSettings}
                >
                  <MaterialIcons name="settings" size={24} color="#6B7280" />
                  <Text style={styles.actionText}>All Settings</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* App Info */}
            <View style={[styles.section, styles.lastSection]}>
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                <MaterialIcons name="info" size={24} color="#6B7280" />
                <Text style={styles.actionText}>About Nuolo</Text>
                <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
                <MaterialIcons name="help" size={24} color="#6B7280" />
                <Text style={styles.actionText}>Help & Support</Text>
                <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 48,
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  lastSection: {
    borderBottomWidth: 0,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
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
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageFlag: {
    fontSize: 24,
  },
  languageName: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  preferencesList: {
    gap: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  preferenceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  preferenceValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  actionsList: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  avatarAuthenticated: {
    backgroundColor: '#84cc16',
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  verificationText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },
  authButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignSelf: 'flex-start',
  },
  signInButton: {
    backgroundColor: '#84cc16',
  },
  authButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  signInButtonText: {
    color: '#FFFFFF',
  },
});