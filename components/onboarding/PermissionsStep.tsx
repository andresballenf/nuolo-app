import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Button } from '../ui/Button';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Ionicons } from '@expo/vector-icons';

export const PermissionsStep: React.FC = () => {
  const { completeOnboarding, previousStep } = useOnboarding();
  const [locationGranted, setLocationGranted] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Check existing permissions
    checkLocationPermission();
    
    // Entrance animation
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(iconAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(cardAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationGranted(status === 'granted');
  };

  const requestLocationPermission = async () => {
    setCheckingPermission(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === 'granted');
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location access is needed to provide you with audio tours based on your location. You can enable it later in Settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    } finally {
      setCheckingPermission(false);
    }
  };

  const handleComplete = () => {
    completeOnboarding();
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Location Permission?',
      'You can still use Nuolo, but you\'ll need to manually search for locations instead of automatic detection.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: completeOnboarding },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Animated.View 
          style={[
            styles.centerContent,
            { opacity: fadeAnim }
          ]}
        >
          {/* Icon */}
          <Animated.View 
            style={[
              styles.iconContainer,
              {
                transform: [{
                  scale: iconAnim,
                }]
              }
            ]}
          >
            <View style={[
              styles.iconCircle,
              locationGranted && styles.iconCircleGranted
            ]}>
              <Ionicons 
                name={locationGranted ? "checkmark-circle" : "location-outline"} 
                size={48} 
                color={locationGranted ? "#FFFFFF" : "#84cc16"} 
              />
            </View>
          </Animated.View>
          
          {/* Title */}
          <Text style={styles.title}>
            {locationGranted ? "You're All Set!" : "Enable Location"}
          </Text>
          
          {/* Description */}
          <Text style={styles.description}>
            {locationGranted 
              ? "Location access is enabled. Nuolo will automatically provide audio tours as you explore."
              : "Allow Nuolo to access your location to automatically discover interesting places around you."
            }
          </Text>

          {/* Permission Card */}
          {!locationGranted && (
            <Animated.View 
              style={[
                styles.permissionCard,
                {
                  opacity: cardAnim,
                  transform: [{
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.permissionItem}>
                <Ionicons name="navigate-circle-outline" size={24} color="#84cc16" />
                <Text style={styles.permissionText}>Discover nearby attractions</Text>
              </View>
              <View style={styles.permissionItem}>
                <Ionicons name="map-outline" size={24} color="#84cc16" />
                <Text style={styles.permissionText}>Get location-based audio tours</Text>
              </View>
              <View style={styles.permissionItem}>
                <Ionicons name="walk-outline" size={24} color="#84cc16" />
                <Text style={styles.permissionText}>Track your exploration journey</Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {locationGranted ? (
            <>
              <Button
                title="Back"
                onPress={previousStep}
                variant="outline"
                size="md"
                style={styles.backButton}
              />
              <Button
                title="Start Exploring"
                onPress={handleComplete}
                variant="primary"
                size="md"
                style={styles.primaryButton}
              />
            </>
          ) : (
            <>
              <Button
                title="Enable Location"
                onPress={requestLocationPermission}
                variant="primary"
                size="lg"
                style={styles.fullButton}
                loading={checkingPermission}
              />
              <Button
                title="Skip for Now"
                onPress={handleSkip}
                variant="outline"
                size="md"
                style={styles.skipButton}
              />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#84cc16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircleGranted: {
    backgroundColor: '#84cc16',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  permissionCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 12,
    flex: 1,
  },
  buttonContainer: {
    paddingBottom: 32,
    gap: 12,
  },
  fullButton: {
    shadowColor: '#84cc16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  skipButton: {
    backgroundColor: 'transparent',
    borderColor: '#E5E7EB',
  },
  backButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  primaryButton: {
    flex: 1,
    shadowColor: '#84cc16',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});