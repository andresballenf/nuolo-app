import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { LocationService } from '../../services/LocationService';

export const LocationStep: React.FC = () => {
  const { nextStep, previousStep } = useOnboarding();
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Pulse animation for icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(iconPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleRequestLocation = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsRequestingPermission(true);
    
    try {
      const locationService = LocationService.getInstance();
      const hasPermission = await locationService.requestPermissions();
      
      if (hasPermission) {
        setPermissionGranted(true);
        // Test getting current location
        const location = await locationService.getCurrentLocation();
        if (location) {
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          Alert.alert(
            'Location Access Granted',
            'Great! We can now discover amazing attractions near you.',
            [{ text: 'Continue', onPress: nextStep }]
          );
        }
      } else {
        Alert.alert(
          'Location Permission Required',
          'Location access is needed to discover nearby attractions. You can enable it later in Settings.',
          [
            { text: 'Skip for Now', onPress: nextStep },
            { text: 'Try Again', onPress: handleRequestLocation }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert(
        'Location Error',
        'There was an issue accessing your location. You can continue and enable it later.',
        [{ text: 'Continue', onPress: nextStep }]
      );
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSkip = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      'Skip Location Access?',
      'Without location access, you\'ll need to manually search for attractions. You can enable this later in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: nextStep }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Card variant="gradient" style={styles.card}>
        <Animated.View style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <View style={styles.header}>
            <Animated.View style={[
              styles.iconContainer,
              {
                transform: [{ scale: iconPulse }]
              }
            ]}>
              <Icon name="location" size={24} color="#ffffff" />
            </Animated.View>
            <Text style={styles.title}>Enable Location</Text>
          </View>
          
          <Text style={styles.subtitle}>
            Allow Nuolo to access your location to discover amazing attractions and historical sites nearby.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.feature}>
              <Icon name="checkmark-circle" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.featureText}>Find nearby attractions automatically</Text>
            </View>
            <View style={styles.feature}>
              <Icon name="checkmark-circle" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.featureText}>Get personalized recommendations</Text>
            </View>
            <View style={styles.feature}>
              <Icon name="checkmark-circle" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.featureText}>Navigate to points of interest</Text>
            </View>
          </View>

          <View style={styles.privacyNote}>
            <Icon name="shield-checkmark" size={16} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.privacyText}>
              Your location data stays private and is only used to enhance your tour experience.
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <Button
              title="Back"
              onPress={previousStep}
              variant="outline"
              size="md"
              style={styles.backButton}
              textStyle={styles.backButtonText}
            />
            <Button
              title="Enable Location"
              onPress={handleRequestLocation}
              variant="primary"
              size="md"
              style={styles.button}
              loading={isRequestingPermission}
            />
          </View>

          <Button
            title="Skip for Now"
            onPress={handleSkip}
            variant="outline"
            size="sm"
            style={styles.skipButton}
            textStyle={styles.skipButtonText}
          />
        </Animated.View>
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
    flex: 1,
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
  featureList: {
    marginBottom: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  privacyText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  skipButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});