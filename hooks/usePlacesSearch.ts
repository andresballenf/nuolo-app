import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import GooglePlacesService, { PointOfInterest } from '../services/GooglePlacesService';
import Constants from 'expo-constants';

interface UsePlacesSearchOptions {
  onPointsOfInterestUpdate?: (pois: PointOfInterest[], isManualSearch?: boolean) => void;
  autoSearch?: boolean;
  searchRadius?: number;
}

interface UsePlacesSearchReturn {
  pointsOfInterest: PointOfInterest[];
  isSearching: boolean;
  showSearchButton: boolean;
  lastSearchCenter: { lat: number; lng: number } | null;
  searchNearbyPlaces: (location: { lat: number; lng: number }, radius?: number, isManualSearch?: boolean) => Promise<void>;
  searchPlaces: (query: string, location: { lat: number; lng: number }, radius?: number) => Promise<void>;
  checkIfSearchNeeded: (currentLocation: { lat: number; lng: number }) => boolean;
  handleSearchThisArea: (location: { lat: number; lng: number }) => Promise<void>;
  clearResults: () => void;
}

export const usePlacesSearch = (options: UsePlacesSearchOptions = {}): UsePlacesSearchReturn => {
  const {
    onPointsOfInterestUpdate,
    autoSearch = true,
    searchRadius = 1500,
  } = options;

  const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [lastSearchCenter, setLastSearchCenter] = useState<{ lat: number; lng: number } | null>(null);

  const googlePlacesService = useRef<GooglePlacesService | null>(null);
  const lastSearchTime = useRef<number>(0);
  const searchThrottle = 2000; // 2 seconds between searches

  // Initialize Google Places service
  useEffect(() => {
    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || 
                   process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (apiKey) {
      googlePlacesService.current = new GooglePlacesService(apiKey);
    } else {
      console.error('Google Maps API key not found');
      Alert.alert(
        'Configuration Error',
        'Google Maps API key is required for attraction discovery'
      );
    }
  }, []);

  /**
   * Search for nearby tourist attractions
   */
  const searchNearbyPlaces = useCallback(async (
    location: { lat: number; lng: number },
    radius: number = searchRadius,
    isManualSearch: boolean = false
  ): Promise<void> => {
    if (!googlePlacesService.current) {
      console.warn('Google Places service not initialized');
      return;
    }

    // Throttle search requests
    const now = Date.now();
    if (now - lastSearchTime.current < searchThrottle) {
      return;
    }
    lastSearchTime.current = now;

    setIsSearching(true);
    setShowSearchButton(false);

    try {
      const results = await googlePlacesService.current.searchNearbyAttractions(location, radius);
      const filteredResults = googlePlacesService.current.filterTouristAttractions(results);

      setPointsOfInterest(filteredResults);
      setLastSearchCenter(location);
      
      // Notify parent with isManualSearch flag
      onPointsOfInterestUpdate?.(filteredResults, isManualSearch);

      console.log(`Found ${filteredResults.length} attractions near ${location.lat}, ${location.lng}`);
    } catch (error) {
      console.error('Error searching nearby places:', error);
      Alert.alert(
        'Search Error',
        'Unable to find nearby attractions. Please check your internet connection.'
      );
    } finally {
      setIsSearching(false);
    }
  }, [searchRadius]);

  /**
   * Search places with custom query
   */
  const searchPlaces = useCallback(async (
    query: string,
    location: { lat: number; lng: number },
    radius: number = 5000
  ): Promise<void> => {
    if (!googlePlacesService.current) {
      console.warn('Google Places service not initialized');
      return;
    }

    setIsSearching(true);

    try {
      const results = await googlePlacesService.current.searchPlaces(query, location, radius);
      const filteredResults = googlePlacesService.current.filterTouristAttractions(results);

      setPointsOfInterest(filteredResults);
      setLastSearchCenter(location);

      console.log(`Found ${filteredResults.length} results for "${query}"`);
    } catch (error) {
      console.error('Error searching places:', error);
      Alert.alert(
        'Search Error',
        'Unable to search for places. Please try again.'
      );
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * Check if search is needed based on location change
   */
  const checkIfSearchNeeded = useCallback((currentLocation: { lat: number; lng: number }): boolean => {
    if (!lastSearchCenter) return true;

    // Calculate distance from last search center
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      lastSearchCenter.lat,
      lastSearchCenter.lng
    );

    // Show search button if moved more than 1km from last search
    const needsSearch = distance > 1000;
    
    // Only update state if it actually changes to prevent cascading re-renders
    if (needsSearch !== showSearchButton) {
      setShowSearchButton(needsSearch);
    }

    return needsSearch;
  }, [lastSearchCenter, showSearchButton]);

  /**
   * Handle manual "Search this area" action
   */
  const handleSearchThisArea = useCallback(async (location: { lat: number; lng: number }): Promise<void> => {
    await searchNearbyPlaces(location, searchRadius, true); // true = manual search
  }, [searchNearbyPlaces, searchRadius]);

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setPointsOfInterest([]);
    setLastSearchCenter(null);
    setShowSearchButton(false);
    onPointsOfInterestUpdate?.([]);
  }, []);

  // Auto-search when location changes significantly
  useEffect(() => {
    if (!autoSearch) return;

    // This will be triggered by parent component when location changes
  }, [autoSearch]);

  // Remove the automatic notification effect
  // Notifications are now handled directly in searchNearbyPlaces with the isManualSearch flag

  return {
    pointsOfInterest,
    isSearching,
    showSearchButton,
    lastSearchCenter,
    searchNearbyPlaces,
    searchPlaces,
    checkIfSearchNeeded,
    handleSearchThisArea,
    clearResults,
  };
};

/**
 * Calculate distance between two coordinates in meters
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng1 - lng2) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}