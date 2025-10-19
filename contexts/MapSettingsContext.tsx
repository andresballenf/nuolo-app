import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { storage } from '../lib/utils';

export type MapType = 'satellite' | 'hybrid' | 'terrain';

export interface MapSettings {
  mapType: MapType;
  tilt: number; // pitch in degrees
  showsTraffic: boolean;
  showsBuildings: boolean;
  showsCompass: boolean;
  showsScale: boolean; // iOS Apple Maps only (not supported with Google provider)
  showsIndoors: boolean;
  showsIndoorLevelPicker: boolean; // Android only
  showsPointsOfInterest: boolean; // iOS only
  pitchEnabled: boolean;
  rotateEnabled: boolean;
  scrollEnabled: boolean;
  zoomEnabled: boolean;
}

export interface MapSettingsContextType {
  settings: MapSettings;
  setSettings: (updates: Partial<MapSettings>) => Promise<void>;
  isFeatureSupported: (feature: keyof MapSettings) => boolean;
}

export const DEFAULT_SETTINGS: MapSettings = {
  mapType: 'hybrid',
  tilt: 60,
  showsTraffic: false,
  showsBuildings: true,
  showsCompass: true,
  showsScale: false,
  showsIndoors: true,
  showsIndoorLevelPicker: false,
  showsPointsOfInterest: true,
  pitchEnabled: true,
  rotateEnabled: true,
  scrollEnabled: true,
  zoomEnabled: true,
};

export const mergeMapSettings = (current: MapSettings, updates: Partial<MapSettings>): MapSettings => ({
  ...current,
  ...updates,
});

const STORAGE_KEY = 'mapSettings';

const MapSettingsContext = createContext<MapSettingsContextType | undefined>(undefined);

export const MapSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettingsState] = useState<MapSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getObject<MapSettings>(STORAGE_KEY);
        if (saved) {
          setSettingsState({ ...DEFAULT_SETTINGS, ...saved });
        }
      } catch (e) {
        console.warn('Failed to load map settings from storage', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setSettings = async (updates: Partial<MapSettings>) => {
    const next = mergeMapSettings(settings, updates);
    setSettingsState(next);
    try {
      await storage.setObject(STORAGE_KEY, next);
    } catch (e) {
      console.warn('Failed to persist map settings', e);
    }
  };

  // Feature support based on provider/platform
  // We always use Google provider across platforms in this app
  const isFeatureSupported = (feature: keyof MapSettings): boolean => {
    switch (feature) {
      case 'showsTraffic':
        return true; // Google maps supports traffic on both platforms
      case 'showsBuildings':
        return true; // Google supports 3D buildings
      case 'showsCompass':
        // RN Maps showsCompass is iOS only with Apple provider; with Google provider,
        // it renders a compass on iOS; Android Google Maps shows a default compass when rotating
        return Platform.OS === 'ios';
      case 'showsScale':
        // Not supported with Google provider; Apple-only
        return false;
      case 'showsIndoors':
        return true;
      case 'showsIndoorLevelPicker':
        return Platform.OS === 'android';
      case 'showsPointsOfInterest':
        // iOS only
        return Platform.OS === 'ios';
      case 'pitchEnabled':
      case 'rotateEnabled':
      case 'scrollEnabled':
      case 'zoomEnabled':
        return true;
      case 'mapType':
      case 'tilt':
        return true;
      default:
        return true;
    }
  };

  const value = useMemo(() => ({ settings, setSettings, isFeatureSupported }), [settings]);

  // Render children immediately; components should handle default values before load
  return (
    <MapSettingsContext.Provider value={value}>
      {children}
    </MapSettingsContext.Provider>
  );
};

export const useMapSettings = (): MapSettingsContextType => {
  const ctx = useContext(MapSettingsContext);
  if (!ctx) throw new Error('useMapSettings must be used within MapSettingsProvider');
  return ctx;
};
