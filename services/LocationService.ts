import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  precision?: 'high' | 'balanced' | 'low';
}

export interface LocationServiceConfig {
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
  privacyMode: 'high' | 'balanced' | 'low';
}

export interface PrivacySettings {
  precision: 'high' | 'balanced' | 'low';
  consentGranted: boolean;
}

export class LocationService {
  private static instance: LocationService | null = null;
  private watchSubscription: Location.LocationSubscription | null = null;
  private config: LocationServiceConfig = {
    accuracy: Location.Accuracy.Balanced, // Default to balanced for privacy
    timeInterval: 10000, // 10 seconds - less frequent for privacy
    distanceInterval: 50, // 50 meters - larger interval for privacy
    privacyMode: 'balanced',
  };
  private privacySettings: PrivacySettings = {
    precision: 'balanced',
    consentGranted: false,
  };

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  // Privacy-aware configuration
  updatePrivacySettings(settings: PrivacySettings): void {
    this.privacySettings = settings;
    this.updateConfigForPrivacy();
  }

  private updateConfigForPrivacy(): void {
    const { precision } = this.privacySettings;
    
    switch (precision) {
      case 'high':
        this.config.accuracy = Location.Accuracy.High;
        this.config.timeInterval = 5000; // 5 seconds
        this.config.distanceInterval = 10; // 10 meters
        break;
      case 'balanced':
        this.config.accuracy = Location.Accuracy.Balanced;
        this.config.timeInterval = 10000; // 10 seconds
        this.config.distanceInterval = 50; // 50 meters
        break;
      case 'low':
        this.config.accuracy = Location.Accuracy.Low;
        this.config.timeInterval = 30000; // 30 seconds
        this.config.distanceInterval = 100; // 100 meters
        break;
    }
    
    this.config.privacyMode = precision;
  }

  private applyLocationPrivacy(location: LocationData): LocationData {
    // Apply coordinate obfuscation based on privacy settings
    const { precision } = this.privacySettings;
    let obfuscatedLocation = { ...location };

    switch (precision) {
      case 'low':
        // Reduce precision to ~1km accuracy
        obfuscatedLocation.latitude = Math.round(location.latitude * 100) / 100;
        obfuscatedLocation.longitude = Math.round(location.longitude * 100) / 100;
        break;
      case 'balanced':
        // Reduce precision to ~100m accuracy
        obfuscatedLocation.latitude = Math.round(location.latitude * 1000) / 1000;
        obfuscatedLocation.longitude = Math.round(location.longitude * 1000) / 1000;
        break;
      case 'high':
        // Full precision (no obfuscation)
        break;
    }

    obfuscatedLocation.precision = precision;
    return obfuscatedLocation;
  }

  private checkConsentRequired(): boolean {
    if (!this.privacySettings.consentGranted) {
      console.error('Location access attempted without user consent');
      return false;
    }
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      // Check privacy consent first
      if (!this.checkConsentRequired()) {
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      // Try to get location with privacy-aware settings
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: this.config.accuracy,
          mayShowUserSettingsDialog: true,
        });
      } catch (error) {
        console.log('Primary accuracy failed, trying fallback...', error);
        // Fallback to balanced accuracy
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: true,
        });
      }

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };

      // Apply privacy obfuscation
      return this.applyLocationPrivacy(locationData);
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  async startWatching(
    callback: (location: LocationData) => void,
    errorCallback?: (error: Error) => void
  ): Promise<boolean> {
    try {
      // Check privacy consent first
      if (!this.checkConsentRequired()) {
        errorCallback?.(new Error('Location access requires user consent'));
        return false;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        errorCallback?.(new Error('Location permission not granted'));
        return false;
      }

      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: this.config.accuracy,
          timeInterval: this.config.timeInterval,
          distanceInterval: this.config.distanceInterval,
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          };

          // Apply privacy obfuscation before calling callback
          const privacyAwareLocation = this.applyLocationPrivacy(locationData);
          callback(privacyAwareLocation);
        }
      );

      return true;
    } catch (error) {
      console.error('Error starting location watch:', error);
      errorCallback?.(error as Error);
      return false;
    }
  }

  stopWatching(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }

  updateConfig(config: Partial<LocationServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async isLocationEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('Error checking location services:', error);
      return false;
    }
  }

  // Test locations for development
  static getTestLocations() {
    return {
      paris: { latitude: 48.8566, longitude: 2.3522 },
      nyc: { latitude: 40.7128, longitude: -74.0060 },
      tokyo: { latitude: 35.6762, longitude: 139.6503 },
      rome: { latitude: 41.9028, longitude: 12.4964 },
      cairo: { latitude: 30.0444, longitude: 31.2357 },
      cincinnati: { latitude: 39.1031, longitude: -84.5120 },
    };
  }
}