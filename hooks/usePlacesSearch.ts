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
    // SECURITY NOTE: API key parameter kept for backward compatibility with photo URLs
    // All API calls now go through server-side proxy in supabase/functions/maps-proxy
    // Photo URLs still embed the key - consider implementing photo proxy for complete security
    const placeholderKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'PROXIED';
    googlePlacesService.current = new GooglePlacesService(placeholderKey);
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
      Alert.alert(
        'Service Error',
        'Maps service is not ready. Please try again in a moment.'
      );
      return;
    }

    // Validate query
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      console.warn('Empty search query provided');
      return;
    }

    if (trimmedQuery.length < 2) {
      Alert.alert(
        'Invalid Search',
        'Please enter at least 2 characters to search.'
      );
      return;
    }

    setIsSearching(true);
    setShowSearchButton(false);

    try {
      console.log(`Searching for: "${trimmedQuery}" near ${location.lat}, ${location.lng}`);
      const results = await googlePlacesService.current.searchPlaces(trimmedQuery, location, radius);
      const filteredResults = googlePlacesService.current.filterTouristAttractions(results);

      setPointsOfInterest(filteredResults);
      setLastSearchCenter(location);

      onPointsOfInterestUpdate?.(filteredResults, true);

      if (filteredResults.length === 0) {
        Alert.alert(
          'No Results',
          `We couldn't find any attractions matching "${trimmedQuery}". Try a different search term or adjust your location.`,
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Search Nearby', onPress: () => {
              // Trigger nearby search instead
              console.log('Triggering nearby search as fallback');
            }}
          ]
        );
      } else {
        console.log(`Found ${filteredResults.length} results for "${trimmedQuery}"`);
      }
    } catch (error) {
      console.error('Error searching places:', error);

      // Provide more helpful error messages
      let errorMessage = 'Unable to search for places. Please try again.';
      let errorTitle = 'Search Error';

      if (error instanceof Error) {
        if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
          errorTitle = 'Connection Error';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Search timed out. Please try again with a different search term.';
          errorTitle = 'Timeout Error';
        } else if (error.message.includes('quota')) {
          errorMessage = 'Service temporarily unavailable. Please try again later.';
          errorTitle = 'Service Unavailable';
        }
      }

      Alert.alert(errorTitle, errorMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => searchPlaces(query, location, radius) }
      ]);
    } finally {
      setIsSearching(false);
    }
  }, [onPointsOfInterestUpdate]);

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
