import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MapPreferencesMenu } from '../map/MapPreferencesMenu';
import { ProfileMenu } from './ProfileMenu';
import { useAuth } from '../../contexts/AuthContext';

interface TopNavigationBarProps {
  // Search functionality
  isSearching: boolean;
  onSearchThisArea: () => void;
  
  // Map preferences
  mapType: 'satellite' | 'hybrid';
  mapTilt: number;
  onMapTypeChange: (type: 'satellite' | 'hybrid') => void;
  onMapTiltChange: (tilt: number) => void;
  
  // Profile & Settings
  onProfilePress: () => void;
  onSettingsPress?: () => void;
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  isSearching,
  onSearchThisArea,
  mapType,
  mapTilt,
  onMapTypeChange,
  onMapTiltChange,
  onProfilePress,
  onSettingsPress,
}) => {
  // Get auth context
  const { user, isAuthenticated } = useAuth();
  
  // State for menus
  const [showMapPreferences, setShowMapPreferences] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Animation values for button presses
  const searchButtonScale = useRef(new Animated.Value(1)).current;
  const mapButtonScale = useRef(new Animated.Value(1)).current;
  const profileButtonScale = useRef(new Animated.Value(1)).current;
  
  // Get user initial for profile button
  const getUserInitial = () => {
    if (!user) return null;
    if (user.profile?.fullName) {
      return user.profile.fullName.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return null;
  };

  // Animation helper function
  const animateButtonPress = (animValue: Animated.Value, callback?: () => void) => {
    // Add haptic feedback on iOS
    if (Platform.OS === 'ios') {
      // React Native has built-in haptic feedback for iOS
      const ReactNativeHaptic = require('react-native').Haptics;
      ReactNativeHaptic?.impact?.(ReactNativeHaptic.ImpactFeedbackStyle.Light);
    }
    
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback?.();
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        {/* Search Area Button - Pill shaped */}
        <Animated.View
          style={[
            styles.searchButton,
            isSearching && styles.searchButtonSearching,
            {
              transform: [{ scale: searchButtonScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.searchButtonTouchable}
            onPress={() => animateButtonPress(searchButtonScale, onSearchThisArea)}
            disabled={isSearching}
            activeOpacity={1}
          >
            {isSearching ? (
              <View style={styles.searchingContent}>
                <ActivityIndicator size="small" color="#6B7280" />
                <Text style={styles.searchButtonText}>Searching...</Text>
              </View>
            ) : (
              <View style={styles.searchContent}>
                <MaterialIcons name="search" size={18} color="#374151" />
                <Text style={styles.searchButtonText}>Search this area</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Map Preferences Button - Circular */}
        <Animated.View
          style={[
            styles.circularButton,
            {
              transform: [{ scale: mapButtonScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.circularButtonTouchable}
            onPress={() => animateButtonPress(mapButtonScale, () => {
              if (onSettingsPress) {
                onSettingsPress();
              } else {
                setShowMapPreferences(true);
              }
            })}
            activeOpacity={1}
          >
            <MaterialIcons name="layers" size={24} color="#374151" />
          </TouchableOpacity>
        </Animated.View>

        {/* Profile Button - Circular */}
        <Animated.View
          style={[
            styles.circularButton,
            {
              transform: [{ scale: profileButtonScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.circularButtonTouchable}
            onPress={() => animateButtonPress(profileButtonScale, () => {
              if (onProfilePress) {
                onProfilePress();
              } else {
                setShowProfileMenu(true);
              }
            })}
            activeOpacity={1}
          >
            {isAuthenticated && getUserInitial() ? (
              <View style={styles.userInitialContainer}>
                <Text style={styles.userInitial}>{getUserInitial()}</Text>
              </View>
            ) : (
              <MaterialIcons name="account-circle" size={24} color="#374151" />
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Map Preferences Menu */}
      <MapPreferencesMenu
        isVisible={showMapPreferences}
        onClose={() => setShowMapPreferences(false)}
        mapType={mapType}
        mapTilt={mapTilt}
        onMapTypeChange={onMapTypeChange}
        onMapTiltChange={onMapTiltChange}
      />

      {/* Profile Menu */}
      <ProfileMenu
        isVisible={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
        onNavigateToSettings={() => {
          setShowProfileMenu(false);
          // TODO: Navigate to settings page
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 50, // Extra padding for dynamic island
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    alignSelf: 'center',
  },
  searchButton: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 20,
    justifyContent: 'center',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchButtonSearching: {
    backgroundColor: '#F9FAFB',
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  searchButtonTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  circularButtonTouchable: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitialContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#84cc16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});