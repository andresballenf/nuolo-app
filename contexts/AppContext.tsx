import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage } from '../lib/utils';
import { PreferencesService } from '../services/PreferencesService';
import { supabase } from '../lib/supabase';

type Theme = 'history' | 'nature' | 'architecture' | 'culture';
type AudioLength = 'short' | 'medium' | 'deep-dive';
type Language = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
type VoiceStyle = 'casual' | 'formal' | 'energetic' | 'calm';

interface GpsStatus {
  active: boolean;
  locked: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  lastUpdated: Date | null;
}

interface UserPreferences {
  theme: Theme;
  audioLength: AudioLength;
  language: Language;
  voiceStyle: VoiceStyle;
  batteryOptimization: boolean;
  locationLock?: boolean;
  autoFix?: boolean;
}

interface SelectedAttraction {
  id: string;
  name: string;
  position: {
    lat: number;
    lng: number;
  };
  description?: string;
  rating?: number;
}

interface AppContextType {
  gpsStatus: GpsStatus;
  userPreferences: UserPreferences;
  selectedAttraction: SelectedAttraction | null;
  isBottomSheetOpen: boolean;
  setGpsStatus: (status: Partial<GpsStatus>) => void;
  setUserPreferences: (preferences: Partial<UserPreferences>) => void;
  setSelectedAttraction: (attraction: SelectedAttraction | null) => void;
  setIsBottomSheetOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const USER_PREFERENCES_KEY = 'userPreferences';

export function AppProvider({ children }: { children: ReactNode }) {
  const [gpsStatus, setGpsStatusState] = useState<GpsStatus>({
    active: false,
    locked: false,
    latitude: null,
    longitude: null,
    accuracy: null,
    lastUpdated: null,
  });

  const [userPreferences, setUserPreferencesState] = useState<UserPreferences>({
    theme: 'history',
    audioLength: 'medium',
    language: 'en',
    voiceStyle: 'casual',
    batteryOptimization: false,
  });

  const [selectedAttraction, setSelectedAttraction] = useState<SelectedAttraction | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load preferences on mount and auth state change
  useEffect(() => {
    loadUserPreferences();
    
    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        loadSupabasePreferences(session.user.id);
      } else {
        setCurrentUserId(null);
        // Fall back to local storage preferences
        loadUserPreferences();
      }
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        loadSupabasePreferences(session.user.id);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const loadUserPreferences = async () => {
    try {
      const savedPreferences = await storage.getObject<UserPreferences>(USER_PREFERENCES_KEY);
      if (savedPreferences) {
        setUserPreferencesState(savedPreferences);
      }
    } catch (error) {
      console.error('Error loading user preferences from local storage:', error);
    }
  };

  const loadSupabasePreferences = async (userId: string) => {
    try {
      const supabasePrefs = await PreferencesService.getUserPreferences(userId);
      if (supabasePrefs) {
        const preferences: UserPreferences = {
          theme: supabasePrefs.theme as Theme,
          audioLength: supabasePrefs.audioLength as AudioLength,
          language: supabasePrefs.language as Language,
          voiceStyle: supabasePrefs.voiceStyle as VoiceStyle,
          batteryOptimization: supabasePrefs.batteryOptimization,
        };
        setUserPreferencesState(preferences);
        // Also save to local storage for offline access
        await storage.setObject(USER_PREFERENCES_KEY, preferences);
      } else {
        // No preferences in Supabase yet, use local or defaults
        loadUserPreferences();
      }
    } catch (error) {
      console.error('Error loading preferences from Supabase:', error);
      // Fall back to local storage
      loadUserPreferences();
    }
  };

  const setGpsStatus = (status: Partial<GpsStatus>) => {
    setGpsStatusState(prev => ({ ...prev, ...status }));
  };

  const setUserPreferences = async (preferences: Partial<UserPreferences>) => {
    const newPreferences = { ...userPreferences, ...preferences };
    setUserPreferencesState(newPreferences);
    
    try {
      // Save to local storage first
      await storage.setObject(USER_PREFERENCES_KEY, newPreferences);
      
      // If user is logged in, also save to Supabase
      if (currentUserId) {
        const supabasePrefs = {
          theme: newPreferences.theme,
          audioLength: newPreferences.audioLength,
          voiceStyle: newPreferences.voiceStyle,
          language: newPreferences.language,
          batteryOptimization: newPreferences.batteryOptimization,
        };
        await PreferencesService.saveUserPreferences(currentUserId, supabasePrefs);
      }
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  };

  return (
    <AppContext.Provider
      value={{
        gpsStatus,
        userPreferences,
        selectedAttraction,
        isBottomSheetOpen,
        setGpsStatus,
        setUserPreferences,
        setSelectedAttraction,
        setIsBottomSheetOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}