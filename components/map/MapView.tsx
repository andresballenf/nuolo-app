import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import MapView, { 
  Marker, 
  PROVIDER_GOOGLE, 
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

interface MapViewComponentProps {
  onPointsOfInterestUpdate?: (pois: PointOfInterest[]) => void;
  onMarkerPress?: (poi: PointOfInterest) => void;
  testLocation?: { latitude: number; longitude: number } | null;
  mapType?: 'standard' | 'satellite' | 'hybrid';
  initialTilt?: number;
  initialZoom?: number;
  triggerGPS?: number;
  onSearchStateChange?: (showButton: boolean, isSearching: boolean) => void;
  onSearchAreaRequest?: React.MutableRefObject<any>;
}

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4324,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MapViewComponent({
  onPointsOfInterestUpdate,
  onMarkerPress,
  testLocation,
  mapType = 'satellite',
  initialTilt = 45,
  initialZoom = 20,
  triggerGPS = 0,
  onSearchStateChange,
  onSearchAreaRequest,
}: MapViewComponentProps) {
  const { gpsStatus, setGpsStatus } = useApp();
  const [initialRegion] = useState<Region>(DEFAULT_REGION);
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);
  const mapRef = useRef<MapView>(null);
  const [markerPositions, setMarkerPositions] = useState<{ [key: string]: { x: number; y: number } }>({});
  const [labelPlacement, setLabelPlacement] = useState<LabelPlacement>({});
  const screenWidth = Dimensions.get('window').width;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>();
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
  React.useImperativeHandle(onSearchAreaRequest, () => ({
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
  useEffect(() => {
    if (gpsStatus.active && gpsStatus.latitude && gpsStatus.longitude) {
      const newRegion: Region = {
        latitude: gpsStatus.latitude,
        longitude: gpsStatus.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      setCurrentCenter({ lat: gpsStatus.latitude, lng: gpsStatus.longitude });
      
      // Animate to the GPS location
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
      
      console.log('MapView responded to GPS activation, will search for attractions');
      
      // Search for attractions at GPS location with larger radius (5km)
      searchNearbyPlaces({ lat: gpsStatus.latitude, lng: gpsStatus.longitude }, 5000);
    }
  }, [gpsStatus.active, gpsStatus.latitude, gpsStatus.longitude, searchNearbyPlaces]);

  // Handle test location
  useEffect(() => {
    if (testLocation) {
      const newRegion: Region = {
        latitude: testLocation.latitude,
        longitude: testLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      
      // Animate to test location instead of setting region state
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }
    }
  }, [testLocation]);

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
      searchNearbyPlaces({ lat: testLocation.latitude, lng: testLocation.longitude });
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

      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }

      // Update GPS status in global context
      setGpsStatus({
        active: true,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Search for attractions at current location with larger radius (5km)
      searchNearbyPlaces(
        { lat: location.coords.latitude, lng: location.coords.longitude },
        5000
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
        1500
      );
    }
  };

  const handleRegionChangeComplete = (newRegion: Region) => {
    // Update zoom level for radius calculation
    const zoom = calculateZoomLevel(newRegion.latitudeDelta);
    setCurrentZoom(zoom);

    // Update current center for business logic (search, etc.)
    const centerLocation = { lat: newRegion.latitude, lng: newRegion.longitude };
    setCurrentCenter(centerLocation);
    
    // Check if we need to show "Search this area" button
    checkIfSearchNeeded(centerLocation);
    
    // Update marker positions and check overlaps
    updateMarkerPositions();
  };

  // Ensure label visibility updates when zoom level changes
  useEffect(() => {
    updateMarkerPositions();
  }, [currentZoom, updateMarkerPositions]);

  const updateMarkerPositions = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      if (!mapRef.current || pointsOfInterest.length === 0) return;

      const positions: { [key: string]: { x: number; y: number } } = {};
      const markerPositionsList: MarkerPosition[] = [];

      // Get screen positions for all markers
      for (const poi of pointsOfInterest) {
        try {
          const screenPos = await mapRef.current.pointForCoordinate(poi.coordinate);
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
          console.error('Error getting screen position for marker:', error);
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
  }, [pointsOfInterest, selectedPOI, currentZoom, screenWidth]);

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

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={gpsStatus.active}
        showsMyLocationButton={true}
        mapType={mapType}
        pitchEnabled={true}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        // Removed camera prop to avoid conflicts with initialRegion
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