import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationConsent {
  granted: boolean;
  precision: 'high' | 'balanced' | 'low';
  timestamp: number;
  version: string; // Privacy policy version
}

interface DataRetention {
  locationData: number; // days to retain location data
  audioData: number; // days to retain audio data
  userPreferences: number; // days to retain preferences
}

interface PrivacySettings {
  locationConsent: LocationConsent | null;
  dataRetention: DataRetention;
  shareWithThirdParties: boolean;
  analyticsConsent: boolean;
  marketingConsent: boolean;
  lastUpdated: number;
}

interface PrivacyContextType {
  privacySettings: PrivacySettings;
  hasLocationConsent: boolean;
  locationPrecision: 'high' | 'balanced' | 'low';
  
  // Consent management
  grantLocationConsent: (precision?: 'high' | 'balanced' | 'low') => Promise<void>;
  revokeLocationConsent: () => Promise<void>;
  updateLocationPrecision: (precision: 'high' | 'balanced' | 'low') => Promise<void>;
  
  // Data management
  updateDataRetention: (settings: Partial<DataRetention>) => Promise<void>;
  deleteUserData: (dataTypes: string[]) => Promise<void>;
  exportUserData: () => Promise<any>;
  
  // Third-party sharing
  updateThirdPartySharing: (allowed: boolean) => Promise<void>;
  updateAnalyticsConsent: (granted: boolean) => Promise<void>;
  updateMarketingConsent: (granted: boolean) => Promise<void>;
  
  // Privacy policy
  isConsentCurrent: () => boolean;
  requiresConsentUpdate: () => boolean;
}

const PRIVACY_POLICY_VERSION = '1.0.0';
const STORAGE_KEYS = {
  PRIVACY_SETTINGS: 'privacy_settings',
  LOCATION_DATA: 'location_data_history',
  AUDIO_DATA: 'audio_data_history',
};

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  locationConsent: null,
  dataRetention: {
    locationData: 30, // 30 days
    audioData: 90, // 90 days
    userPreferences: 365, // 1 year
  },
  shareWithThirdParties: false,
  analyticsConsent: false,
  marketingConsent: false,
  lastUpdated: Date.now(),
};

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS);

  // Load privacy settings on mount
  useEffect(() => {
    loadPrivacySettings();
  }, []);

  const loadPrivacySettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PRIVACY_SETTINGS);
      if (stored) {
        const settings = JSON.parse(stored);
        setPrivacySettings({ ...DEFAULT_PRIVACY_SETTINGS, ...settings });
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
  };

  const savePrivacySettings = async (newSettings: PrivacySettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PRIVACY_SETTINGS, JSON.stringify(newSettings));
      setPrivacySettings(newSettings);
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      throw error;
    }
  };

  const grantLocationConsent = async (precision: 'high' | 'balanced' | 'low' = 'balanced') => {
    const newConsent: LocationConsent = {
      granted: true,
      precision,
      timestamp: Date.now(),
      version: PRIVACY_POLICY_VERSION,
    };

    const newSettings = {
      ...privacySettings,
      locationConsent: newConsent,
      lastUpdated: Date.now(),
    };

    await savePrivacySettings(newSettings);
  };

  const revokeLocationConsent = async () => {
    const newSettings = {
      ...privacySettings,
      locationConsent: null,
      lastUpdated: Date.now(),
    };

    await savePrivacySettings(newSettings);

    // Clear stored location data
    await deleteLocationData();
  };

  const updateLocationPrecision = async (precision: 'high' | 'balanced' | 'low') => {
    if (!privacySettings.locationConsent) {
      throw new Error('Location consent must be granted first');
    }

    const newConsent = {
      ...privacySettings.locationConsent,
      precision,
      timestamp: Date.now(),
    };

    const newSettings = {
      ...privacySettings,
      locationConsent: newConsent,
      lastUpdated: Date.now(),
    };

    await savePrivacySettings(newSettings);
  };

  const updateDataRetention = async (settings: Partial<DataRetention>) => {
    const newSettings = {
      ...privacySettings,
      dataRetention: { ...privacySettings.dataRetention, ...settings },
      lastUpdated: Date.now(),
    };

    await savePrivacySettings(newSettings);
  };

  const deleteUserData = async (dataTypes: string[]) => {
    try {
      const deletePromises = dataTypes.map(async (type) => {
        switch (type) {
          case 'location':
            await deleteLocationData();
            break;
          case 'audio':
            await deleteAudioData();
            break;
          case 'preferences':
            await deletePreferencesData();
            break;
          case 'all':
            await AsyncStorage.clear();
            break;
        }
      });

      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting user data:', error);
      throw error;
    }
  };

  const deleteLocationData = async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.LOCATION_DATA);
  };

  const deleteAudioData = async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUDIO_DATA);
  };

  const deletePreferencesData = async () => {
    // Remove user preferences but keep privacy settings
    const keysToRemove = [
      'user_preferences',
      'onboarding_completed',
      'attraction_history',
    ];
    await AsyncStorage.multiRemove(keysToRemove);
  };

  const exportUserData = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const allData = await AsyncStorage.multiGet(allKeys);
      
      const exportData = {
        exportTimestamp: new Date().toISOString(),
        privacySettings,
        userData: Object.fromEntries(allData.filter(([key, value]) => value !== null)),
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  };

  const updateThirdPartySharing = async (allowed: boolean) => {
    const newSettings = {
      ...privacySettings,
      shareWithThirdParties: allowed,
      lastUpdated: Date.now(),
    };

    await savePrivacySettings(newSettings);
  };

  const updateAnalyticsConsent = async (granted: boolean) => {
    const newSettings = {
      ...privacySettings,
      analyticsConsent: granted,
      lastUpdated: Date.now(),
    };

    await savePrivacySettings(newSettings);
  };

  const updateMarketingConsent = async (granted: boolean) => {
    const newSettings = {
      ...privacySettings,
      marketingConsent: granted,
      lastUpdated: Date.now(),
    };

    await savePrivacySettings(newSettings);
  };

  const isConsentCurrent = (): boolean => {
    if (!privacySettings.locationConsent) return false;
    return privacySettings.locationConsent.version === PRIVACY_POLICY_VERSION;
  };

  const requiresConsentUpdate = (): boolean => {
    return !isConsentCurrent() && privacySettings.locationConsent !== null;
  };

  const hasLocationConsent = privacySettings.locationConsent?.granted || false;
  const locationPrecision = privacySettings.locationConsent?.precision || 'balanced';

  const contextValue: PrivacyContextType = {
    privacySettings,
    hasLocationConsent,
    locationPrecision,
    grantLocationConsent,
    revokeLocationConsent,
    updateLocationPrecision,
    updateDataRetention,
    deleteUserData,
    exportUserData,
    updateThirdPartySharing,
    updateAnalyticsConsent,
    updateMarketingConsent,
    isConsentCurrent,
    requiresConsentUpdate,
  };

  return (
    <PrivacyContext.Provider value={contextValue}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
}