import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, Dimensions, Platform } from 'react-native';
import MapView, { 
  Marker, 
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT, 
  Region, 
  MapViewProps as RNMapViewProps 
} from 'react-native-maps';
import * as Location from 'expo-location';
import { useApp } from '../../contexts/AppContext';
import { usePlacesSearch } from '../../hooks/usePlacesSearch';
import { PointOfInterest } from '../../services/GooglePlacesService';
import { SearchThisAreaButton } from './SearchThisAreaButton';
import { CustomMarker } from './CustomMarker';
import { 
  calculateZoomLevel, 
  shouldShowLabels, 
  computeLabelPlacement,
  MarkerPosition,
  LabelPlacement 
} from '../../utils/markerOverlap';

export type SearchAreaHandle = {
  searchThisArea: () => Promise<void>;
};

interface MapViewComponentProps {
  onPointsOfInterestUpdate?: (pois: PointOfInterest[], isManualSearch?: boolean) => void;
  onMarkerPress?: (poi: PointOfInterest) => void;
  testLocation?: { latitude: number; longitude: number } | null;
  mapType?: 'satellite' | 'hybrid';
  initialTilt?: number;
  initialZoom?: number;
  triggerGPS?: number;
  onSearchStateChange?: (showButton: boolean, isSearching: boolean) => void;
  onSearchAreaRequest?: React.MutableRefObject<SearchAreaHandle | null>;
  mapRef?: React.MutableRefObject<MapView | null>;
}

// Calculate delta for zoom level 17
const ZOOM_17_DELTA = 0.005; // Approximate delta for zoom 17

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4324,
  latitudeDelta: ZOOM_17_DELTA,
  longitudeDelta: ZOOM_17_DELTA,
};

export default function MapViewComponent({
  onPointsOfInterestUpdate,
  onMarkerPress,
  testLocation,
  mapType = 'hybrid',
  initialTilt = 60,
  initialZoom = 17,  // Optimal for 3D buildings
  triggerGPS = 0,
  onSearchStateChange,
  onSearchAreaRequest,
  mapRef: externalMapRef,
}: MapViewComponentProps) {
  const { gpsStatus, setGpsStatus } = useApp();
  // Use user location for initial region if available, otherwise use default
  const [initialRegion] = useState<Region>(() => {
    if (gpsStatus.active && gpsStatus.latitude && gpsStatus.longitude) {
      return {
        latitude: gpsStatus.latitude,
        longitude: gpsStatus.longitude,
        latitudeDelta: ZOOM_17_DELTA,
        longitudeDelta: ZOOM_17_DELTA,
      };
    }
    return DEFAULT_REGION;
  });
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);
  const internalMapRef = useRef<MapView | null>(null);
  const mapRef = externalMapRef || internalMapRef;
  const [markerPositions, setMarkerPositions] = useState<{ [key: string]: { x: number; y: number } }>({});
  const [labelPlacement, setLabelPlacement] = useState<LabelPlacement>({});
  const screenWidth = Dimensions.get('window').width;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [currentCenter, setCurrentCenter] = useState<{ lat: number; lng: number }>({
    lat: DEFAULT_REGION.latitude,
    lng: DEFAULT_REGION.longitude,
  });

  // Initialize Google Places search
  const {
    pointsOfInterest,
    isSearching,
    showSearchButton,
    searchNearbyPlaces,
    checkIfSearchNeeded,
    handleSearchThisArea,
  } = usePlacesSearch({
    onPointsOfInterestUpdate,
    autoSearch: true,
    searchRadius: 1500,
  });

  // Notify parent about search state changes
  useEffect(() => {
    onSearchStateChange?.(showSearchButton, isSearching);
  }, [showSearchButton, isSearching, onSearchStateChange]);

  // Store search function for parent to call
  React.useImperativeHandle(onSearchAreaRequest, (): SearchAreaHandle => ({
    searchThisArea: () => handleSearchThisArea(currentCenter)
  }), [handleSearchThisArea, currentCenter]);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  // React to GPS trigger changes
  useEffect(() => {
    if (triggerGPS > 0) {
      requestLocationPermission();
    }
  }, [triggerGPS]);

  // React to GPS status changes - when GPS becomes active with location data
  const hasSearchedGPS = useRef(false);
  const hasInitiallyAnimated = useRef(false);
  useEffect(() => {
    if (gpsStatus.active && gpsStatus.latitude && gpsStatus.longitude) {
      setCurrentCenter({ lat: gpsStatus.latitude, lng: gpsStatus.longitude });
      
      // Animate to user location with 3D view on first GPS lock
      if (!hasInitiallyAnimated.current && mapRef.current) {
        hasInitiallyAnimated.current = true;
        mapRef.current.animateCamera({
          center: {
            latitude: gpsStatus.latitude,
            longitude: gpsStatus.longitude,
          },
          pitch: initialTilt, // 60 degrees for 3D
          heading: 0,
          altitude: 800,
          zoom: 17,  // Always zoom 17
        }, { duration: 1000 });
      }
      
      // Search for attractions only once
      if (!hasSearchedGPS.current) {
        hasSearchedGPS.current = true;
        console.log('MapView: Searching for attractions at user location');
        searchNearbyPlaces({ lat: gpsStatus.latitude, lng: gpsStatus.longitude }, 5000, false);
      }
    }
  }, [gpsStatus.active, gpsStatus.latitude, gpsStatus.longitude, searchNearbyPlaces, initialTilt]);

  // Handle test location
  useEffect(() => {
    if (testLocation) {
      setCurrentCenter({ lat: testLocation.latitude, lng: testLocation.longitude });
      
      // Animate to test location with 3D camera at zoom 17
      if (mapRef.current) {
        mapRef.current.animateCamera({
          center: {
            latitude: testLocation.latitude,
            longitude: testLocation.longitude,
          },
          pitch: initialTilt, // 60 degrees for 3D
          heading: 0,
          altitude: 800,
          zoom: 17,  // Always zoom 17 for 3D buildings
        }, { duration: 1000 });
      }
    }
  }, [testLocation, initialTilt]);

  // Only show search button message once on initial load
  const hasShownInitialSearch = useRef(false);
  useEffect(() => {
    if (showSearchButton && !hasShownInitialSearch.current) {
      hasShownInitialSearch.current = true;
      console.log('Initial search button state - ready to search');
    }
  }, [showSearchButton]);

  // React to test location changes
  useEffect(() => {
    if (testLocation) {
      console.log('Test location updated:', testLocation);
      searchNearbyPlaces({ lat: testLocation.latitude, lng: testLocation.longitude }, 1500, false);
    }
  }, [testLocation, searchNearbyPlaces]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location permission is required to show nearby attractions.',
          [{ text: 'OK' }]
        );
        return;
      }

      getCurrentLocation();
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newRegion: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setCurrentCenter({ lat: location.coords.latitude, lng: location.coords.longitude });

      // Animate to user location with 3D view
      if (mapRef.current) {
        mapRef.current.animateCamera({
          center: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          pitch: initialTilt, // 60 degrees for 3D
          heading: 0,
          altitude: 800,
          zoom: 17,  // Always zoom 17
        }, { duration: 1000 });
      }

      // Update GPS status in global context
      setGpsStatus({
        active: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Search for attractions at current location with larger radius (5km) - not manual search
      searchNearbyPlaces(
        { lat: location.coords.latitude, lng: location.coords.longitude },
        5000,
        false
      );
    } catch (error) {
      console.error('Error getting current location:', error);
      setGpsStatus({
        active: false,
        latitude: null,
        longitude: null,
      });
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleMapReady = () => {
    console.log('Map is ready');
    if (testLocation) {
      searchNearbyPlaces(
        { lat: testLocation.latitude, lng: testLocation.longitude },
        1500,
        false
      );
    }
  };

  // Debounce timer for region changes to prevent excessive updates
  const regionChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  
  const handleRegionChangeComplete = (newRegion: Region) => {
    // Clear any pending debounced calls
    if (regionChangeDebounceRef.current) {
      clearTimeout(regionChangeDebounceRef.current);
    }
    
    // Update zoom level immediately for visual feedback
    const zoom = calculateZoomLevel(newRegion.latitudeDelta);
    setCurrentZoom(zoom);
    
    // Debounce the expensive operations to prevent cascading re-renders
    regionChangeDebounceRef.current = setTimeout(() => {
      // Update current center for business logic (search, etc.)
      const centerLocation = { lat: newRegion.latitude, lng: newRegion.longitude };
      setCurrentCenter(centerLocation);
      
      // Check if we need to show "Search this area" button
      checkIfSearchNeeded(centerLocation);
      
      // Update marker positions and check overlaps
      updateMarkerPositions();
    }, 500); // 500ms debounce - adjust as needed for smoothness
  };

  // Ensure label visibility updates when zoom level changes
  // Moved this after the updateMarkerPositions definition to fix temporal dead zone

  const updateMarkerPositions = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (!mapRef.current || pointsOfInterest.length === 0) return;
      
      // Additional check to ensure map is ready
      try {
        // Test if the map is ready by checking if we can get the region
        const region = await mapRef.current.getMapBoundaries?.();
        if (!region) {
          console.warn('Map not ready yet, skipping marker position update');
          return;
        }
      } catch (e) {
        // Map might not be ready, skip this update
        return;
      }

      const positions: { [key: string]: { x: number; y: number } } = {};
      const markerPositionsList: MarkerPosition[] = [];

      // Get screen positions for all markers
      for (const poi of pointsOfInterest) {
        try {
          // Ensure mapRef.current exists and has the pointForCoordinate method
          if (!mapRef.current || !mapRef.current.pointForCoordinate) {
            console.warn('Map ref not ready for coordinate conversion');
            continue;
          }
          
          // Ensure coordinate is valid
          if (!poi.coordinate || typeof poi.coordinate.latitude !== 'number' || typeof poi.coordinate.longitude !== 'number') {
            console.warn(`Invalid coordinate for POI ${poi.id}`);
            continue;
          }
          
          let screenPos;
          try {
            screenPos = await mapRef.current.pointForCoordinate(poi.coordinate);
          } catch (innerError) {
            // Handle null conversion error specifically
            if (innerError instanceof TypeError && innerError.message.includes('Cannot convert null')) {
              // Map view might not be ready or marker is outside visible area
              continue;
            }
            throw innerError;
          }
          
          // Ensure screenPos is valid
          if (!screenPos || typeof screenPos.x !== 'number' || typeof screenPos.y !== 'number') {
            continue;
          }
          
          positions[poi.id] = screenPos;
          markerPositionsList.push({
            id: poi.id,
            x: screenPos.x,
            y: screenPos.y,
            width: selectedPOI?.id === poi.id ? 44 : 40,
            height: selectedPOI?.id === poi.id ? 44 : 40,
            isSelected: selectedPOI?.id === poi.id,
          });
        } catch (error) {
          // Only log non-null conversion errors
          if (!(error instanceof TypeError && error.message.includes('Cannot convert null'))) {
            console.error('Error getting screen position for marker:', error);
          }
        }
      }

      setMarkerPositions(positions);

      // Compute placement and visibility if labels should be shown
      if (shouldShowLabels(currentZoom)) {
        const placement = computeLabelPlacement(markerPositionsList, screenWidth);
        setLabelPlacement(placement);
      } else {
        setLabelPlacement({});
      }
    }, 300); // 300ms debounce
  }, [pointsOfInterest, selectedPOI, currentZoom, screenWidth, mapRef]);

  // Ensure label visibility updates when zoom level changes
  useEffect(() => {
    updateMarkerPositions();
  }, [currentZoom, updateMarkerPositions]);

  // Trigger position updates when points of interest change
  useEffect(() => {
    if (pointsOfInterest.length > 0) {
      // Small delay to ensure markers are rendered
      const timer = setTimeout(() => {
        updateMarkerPositions();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pointsOfInterest, updateMarkerPositions]);

  // Also update when selected POI changes
  useEffect(() => {
    updateMarkerPositions();
  }, [selectedPOI, updateMarkerPositions]);

  const handleMarkerPress = (poi: PointOfInterest) => {
    setSelectedPOI(poi);
    onMarkerPress?.(poi);
  };

  // Log 3D configuration for debugging - only on mount
  React.useEffect(() => {
    const mapProvider = Platform.OS === 'ios' ? 'PROVIDER_DEFAULT (Apple Maps)' : 'PROVIDER_GOOGLE (Google Maps)';
    console.log('🏗️ 3D Map Configuration:', {
      mapType,
      tilt: initialTilt,
      zoom: initialZoom,
      showsBuildings: true,
      provider: mapProvider,
      platform: Platform.OS,
      camera: {
        pitch: initialTilt,
        zoom: 17,
        altitude: 800
      }
    });
    console.log('💡 Note: 3D buildings require:');
    console.log('  - Major city location (Paris, NYC, Tokyo, etc.)');
    console.log('  - Zoom level 17-19');
    console.log('  - Tilt/pitch of 45-60 degrees');
    console.log('  - Hybrid or satellite map type');
  }, []); // Empty dependency array - only log once on mount

  // Use initialRegion instead of camera to prevent drift
  const [hasInitialized, setHasInitialized] = useState(false);
  
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}  // Use initialRegion for stable positioning
        onMapReady={() => {
          console.log('✅ Map ready with 3D building support');
          // Set initial 3D camera with tilt when map is ready
          if (mapRef.current) {
            const centerLat = gpsStatus.latitude || initialRegion.latitude;
            const centerLng = gpsStatus.longitude || initialRegion.longitude;
            
            mapRef.current.animateCamera({
              center: {
                latitude: centerLat,
                longitude: centerLng,
              },
              pitch: initialTilt, // 60 degrees for 3D
              heading: 0,
              altitude: 800,
              zoom: 17,  // Always zoom 17
            }, { duration: 500 });
          }
          handleMapReady();
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={gpsStatus.active}
        showsMyLocationButton={true}
        showsBuildings={true}  // Enable 3D buildings
        showsIndoors={true}    // Enable indoor maps
        showsIndoorLevelPicker={false}  // Don't show indoor level picker
        showsTraffic={false}   // Keep map clean
        showsCompass={true}    // Show compass for orientation
        mapType={mapType}
        pitchEnabled={true}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        toolbarEnabled={false}  // Disable default toolbar for cleaner UI
        // Removed camera prop to prevent continuous updates and drift
      >
        {pointsOfInterest.map((poi) => (
          <CustomMarker
            key={poi.id}
            poi={poi}
            isSelected={selectedPOI?.id === poi.id}
            onPress={handleMarkerPress}
            mapType={mapType}
            showLabel={shouldShowLabels(currentZoom)}
            labelVisible={labelPlacement[poi.id]?.visible || false}
            labelSide={labelPlacement[poi.id]?.position || 'right'}
            markerScreenPosition={markerPositions[poi.id]}
          />
        ))}
      </MapView>

      {/* Search button is now in TopNavigationBar */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});