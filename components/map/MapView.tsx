import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, Dimensions, Platform } from 'react-native';
import MapView, { 
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { useApp } from '../../contexts/AppContext';
import { usePlacesSearch } from '../../hooks/usePlacesSearch';
import { PointOfInterest } from '../../services/GooglePlacesService';
import { CustomMarker } from './CustomMarker';
import { 
  calculateZoomLevel, 
  shouldShowLabels, 
  computeLabelPlacement,
  MarkerPosition,
  LabelPlacement 
} from '../../utils/markerOverlap';
import { useMapSettings } from '../../contexts/MapSettingsContext';
import { logger } from '../../lib/logger';

export type SearchAreaHandle = {
  searchThisArea: () => Promise<void>;
  searchByQuery: (query: string) => Promise<void>;
};

interface MapViewComponentProps {
  onPointsOfInterestUpdate?: (pois: PointOfInterest[], isManualSearch?: boolean) => void;
  onMarkerPress?: (poi: PointOfInterest) => void;
  testLocation?: { latitude: number; longitude: number } | null;
  mapType?: 'standard' | 'satellite' | 'hybrid' | 'terrain';
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
  const { settings: mapSettings, isFeatureSupported } = useMapSettings();
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
    searchPlaces,
    checkIfSearchNeeded,
    handleSearchThisArea,
    cancelPendingSearch,
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
    searchThisArea: async () => {
      cancelPendingSearch();
      await handleSearchThisArea(currentCenter);
    },
    searchByQuery: async (query: string) => {
      cancelPendingSearch();
      await searchPlaces(query, currentCenter, 5000);
    },
  }), [handleSearchThisArea, searchPlaces, currentCenter, cancelPendingSearch]);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingSearch();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (regionChangeDebounceRef.current) {
        clearTimeout(regionChangeDebounceRef.current);
      }
    };
  }, [cancelPendingSearch]);

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
        logger.debug('MapView searching attractions at GPS location');
        cancelPendingSearch();
        searchNearbyPlaces({ lat: gpsStatus.latitude, lng: gpsStatus.longitude }, 5000, false);
      }
    }
  }, [gpsStatus.active, gpsStatus.latitude, gpsStatus.longitude, searchNearbyPlaces, initialTilt, cancelPendingSearch]);

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
      logger.debug('Map search button enabled');
    }
  }, [showSearchButton]);

  // Animate camera when tilt setting changes (single animation, no continuous drift)
  const prevTiltRef = useRef<number>(mapSettings.tilt);
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapSettings.tilt === prevTiltRef.current) return;

    const centerLat = gpsStatus.latitude || initialRegion.latitude;
    const centerLng = gpsStatus.longitude || initialRegion.longitude;

    try {
      mapRef.current.animateCamera({
        center: { latitude: centerLat, longitude: centerLng },
        pitch: mapSettings.tilt,
        heading: 0,
        altitude: 800,
        zoom: 17,
      }, { duration: 500 });
      prevTiltRef.current = mapSettings.tilt;
    } catch (e) {
      // Ignore animation errors if map not ready
    }
  }, [mapSettings.tilt, gpsStatus.latitude, gpsStatus.longitude, initialRegion.latitude, initialRegion.longitude, mapRef]);

  // Animate camera to/from 3D when buildings toggle changes
  const prevBuildingsRef = useRef<boolean>(mapSettings.showsBuildings);
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapSettings.showsBuildings === prevBuildingsRef.current) return;

    const centerLat = gpsStatus.latitude || initialRegion.latitude;
    const centerLng = gpsStatus.longitude || initialRegion.longitude;
    const targetPitch = mapSettings.showsBuildings ? Math.max(mapSettings.tilt, 45) : 0;

    try {
      mapRef.current.animateCamera({
        center: { latitude: centerLat, longitude: centerLng },
        pitch: targetPitch,
        heading: 0,
        altitude: 800,
        zoom: 17,
      }, { duration: 500 });
      prevBuildingsRef.current = mapSettings.showsBuildings;
    } catch (e) {
      // Ignore animation errors if map not ready
    }
  }, [mapSettings.showsBuildings, mapSettings.tilt, gpsStatus.latitude, gpsStatus.longitude, initialRegion.latitude, initialRegion.longitude, mapRef]);

  // React to test location changes
  useEffect(() => {
    if (testLocation) {
      logger.debug('Map test location updated', testLocation);
      cancelPendingSearch();
      searchNearbyPlaces({ lat: testLocation.latitude, lng: testLocation.longitude }, 1500, false);
    }
  }, [testLocation, searchNearbyPlaces, cancelPendingSearch]);

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
      logger.error('Error requesting location permission', error);
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
      cancelPendingSearch();
      searchNearbyPlaces(
        { lat: location.coords.latitude, lng: location.coords.longitude },
        5000,
        false
      );
    } catch (error) {
      logger.error('Error getting current location', error);
      setGpsStatus({
        active: false,
        latitude: null,
        longitude: null,
      });
    }
  };

  const handleMapReady = () => {
    logger.debug('Map is ready');
    if (testLocation) {
      cancelPendingSearch();
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
          logger.debug('Map not ready, skipping marker position update');
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
            logger.debug('Map ref not ready for coordinate conversion');
            continue;
          }
          
          // Ensure coordinate is valid
          if (!poi.coordinate || typeof poi.coordinate.latitude !== 'number' || typeof poi.coordinate.longitude !== 'number') {
            logger.warn('Invalid coordinate for POI marker', { poiId: poi.id });
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
            logger.error('Error getting screen position for marker', error, { poiId: poi.id });
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
    const mapProvider = Platform.OS === 'ios' ? 'Apple Maps' : 'Google Maps';
    logger.debug('3D map configuration', {
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
    logger.debug('3D buildings require city coverage with zoom 17-19 and map tilt');
  }, []); // Empty dependency array - only log once on mount

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}  // Use initialRegion for stable positioning
        onMapReady={() => {
          logger.debug('Map ready with 3D support');
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
        showsBuildings={mapSettings.showsBuildings && isFeatureSupported('showsBuildings')}
        showsIndoors={mapSettings.showsIndoors && isFeatureSupported('showsIndoors')}
        showsIndoorLevelPicker={mapSettings.showsIndoorLevelPicker && isFeatureSupported('showsIndoorLevelPicker')}
        showsTraffic={mapSettings.showsTraffic && isFeatureSupported('showsTraffic')}
        showsCompass={mapSettings.showsCompass && isFeatureSupported('showsCompass')}
        showsScale={mapSettings.showsScale && isFeatureSupported('showsScale')}
        showsPointsOfInterest={mapSettings.showsPointsOfInterest && isFeatureSupported('showsPointsOfInterest')}
        mapType={mapType}
        pitchEnabled={mapSettings.pitchEnabled}
        rotateEnabled={mapSettings.rotateEnabled}
        scrollEnabled={mapSettings.scrollEnabled}
        zoomEnabled={mapSettings.zoomEnabled}
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
