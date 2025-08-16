import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface LocationServiceConfig {
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
}

export class LocationService {
  private static instance: LocationService | null = null;
  private watchSubscription: Location.LocationSubscription | null = null;
  private config: LocationServiceConfig = {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000, // 5 seconds
    distanceInterval: 10, // 10 meters
  };

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
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
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      // Try to get location with fallback strategies
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: this.config.accuracy,
          timeout: 10000,
          mayShowUserSettingsDialog: true,
        });
      } catch (error) {
        console.log('Primary accuracy failed, trying fallback...', error);
        // Fallback to balanced accuracy
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 15000,
          mayShowUserSettingsDialog: true,
        });
      }

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };
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
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
          });
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